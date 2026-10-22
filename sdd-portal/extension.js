"use strict";

const vscode = require("vscode");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { ALLOWED, validateInput, decodeResult, extractStory } = require("./bridge");
const { McpClient } = require("./mcp");
const { registeredStoryTools, VsCodeAlmClient } = require("./alm");
const { AlmOAuth } = require("./oauth");
const { loadContext, persist } = require("./canonical");
const { startRuntime, runArchitect } = require("./architect-runtime");

function activate(context) {
  const output = vscode.window.createOutputChannel("SDD Studio");
  context.subscriptions.push(output);
  let server;
  let origin;
  let secret;
  let model;
  let runtime;
  let almClient;
  let sapClient;
  let busy = false;
  let opening = false;
  let guidanceRoot;
  const jobs = new Set();

  function report(error) {
    output.appendLine(`ERROR: ${error.message}`);
  }

  async function resolveTool(suffix, token) {
    if (!ALLOWED.has(suffix)) throw new Error("Operation is not permitted by the read-only portal.");
    const client = suffix === "item_details_tool" ? almClient : sapClient;
    if (!client) throw new Error("MCP connection not configured. Run SDD Studio: Configure MCP Connections in VS Code.");
    const matches = (await client.listTools(token)).filter(tool => tool.name.endsWith(suffix));
    if (matches.length !== 1) throw new Error(`Expected one ${suffix} tool on the configured MCP server; found ${matches.length}.`);
    return { name: matches[0].name, client };
  }

  async function invoke(suffix, input, token) {
    token.throwIfCancellationRequested?.();
    if (token.isCancellationRequested) throw new Error("Request cancelled.");
    const { name, client } = await resolveTool(suffix, token);
    if (suffix !== "item_details_tool" && suffix !== "abapfs_get_connected_systems" && input.connectionId !== "OUC") throw new Error("SAP reads are restricted to OUC.");
    output.appendLine(`Read-only tool: ${name}`);
    return decodeResult(await client.call(name, input, token));
  }

  async function getStory(storyId, token) {
    return extractStory(await invoke("item_details_tool", { ids: [storyId], type: "story" }, token), storyId);
  }

  async function generate(input, token, send) {
    if (!runtime || !model) throw new Error("Runtime/model unavailable. Reopen SDD Studio and explicitly select a signed-in runtime model.");
    const progress = message => send({ type: "progress", message });
    progress("Loading the actual repository architect, full SDD template and current canonical spec…");
    const local = await loadContext(guidanceRoot.fsPath, input.storyId);
    const result = await runArchitect({
      client: runtime, modelId: model.id, context: local, input, token, invoke, getStory, progress,
      ask: async request => {
        progress("sdd-architect needs a blocking answer. Check VS Code.");
        if (request.choices?.length && request.allowFreeform === false) {
          return vscode.window.showQuickPick(request.choices, { title: request.question }, token);
        }
        return vscode.window.showInputBox({ title: "SDD Architect: blocking question", prompt: request.question,
          ignoreFocusOut: true, validateInput: value => value.trim() ? undefined : "An answer is required." }, token);
      },
    });
    if (token.isCancellationRequested) throw new Error("Generation cancelled.");
    const preview = await vscode.workspace.openTextDocument({ language: "markdown", content: result.candidate });
    await vscode.window.showTextDocument(preview, { preview: true, preserveFocus: true });
    progress(`Runtime invocation verified. Review ${local.relative} in VS Code and approve saving ${local.revision}.`);
    const approval = await vscode.window.showInformationMessage(
      `Save ${local.relative} revision ${local.revision}? Full canonical Markdown is open for review. Existing history/evidence will be preserved. This approves only a spec save, not design implementation.`,
      { modal: true }, "Save canonical specification");
    if (approval !== "Save canonical specification" || token.isCancellationRequested) throw new Error("Canonical save not approved or generation cancelled. Existing file unchanged.");
    const saved = await persist(local, result.candidate, () => token.isCancellationRequested);
    output.appendLine(`Named-agent invocation verified: ${result.invocation.agent}; session ${result.invocation.sessionId}; SDK ${result.invocation.sdkVersion}; runtime ${result.invocation.runtimeVersion}. Saved ${saved.canonicalPath} ${saved.revision}; SHA-256 ${saved.sha256}.`);
    return { ...input, ...saved, generatedAt: new Date().toISOString(), model: model.id,
      generationMode: "Named sdd-architect · Copilot SDK runtime · spec-only",
      invocation: result.invocation, evidence: result.evidence, limitations: result.limitations };
  }

  function json(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  }

  async function readBody(req) {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 32768) throw new Error("Request body exceeds 32 KB.");
    }
    try { return JSON.parse(body); } catch { throw new Error("Expected a JSON request body."); }
  }

  async function handle(req, res) {
    const source = new vscode.CancellationTokenSource();
    jobs.add(source);
    const timer = setTimeout(() => source.cancel(), 600000);
    res.on("close", () => { if (!res.writableEnded) source.cancel(); });
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    let generation = false;
    try {
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin) ||
          ["cross-site", "same-site"].includes(req.headers["sec-fetch-site"])) return json(res, 403, { error: "Only the local portal origin may access this service." });
      const route = new URL(req.url, origin).pathname;
      if (route === "/bootstrap.js" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/javascript" });
        return res.end(`window.sddSession = ${JSON.stringify({ token: secret })};`);
      }
      if (!route.startsWith("/api/")) {
        const files = { "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/app.js": "app.js" };
        if (req.method !== "GET" || !files[route]) return json(res, 404, { error: "Not found." });
        const file = files[route];
        const body = await fs.readFile(path.join(context.extensionPath, file));
        res.writeHead(200, { "Content-Type": file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "application/javascript" : "text/html; charset=utf-8" });
        return res.end(body);
      }
      if (req.headers["x-sdd-token"] !== secret) return json(res, 403, { error: "Portal session expired. Reopen it from VS Code." });
      if (route === "/api/status" && req.method === "GET") {
        const checks = await Promise.allSettled([
          resolveTool("item_details_tool", source.token),
          invoke("abapfs_get_connected_systems", {}, source.token),
        ]);
        const alm = checks[0].status === "fulfilled";
        const ouc = checks[1].status === "fulfilled" && /(^|[^A-Z0-9_])OUC([^A-Z0-9_]|$)/i.test(checks[1].value.text);
        for (const check of checks) if (check.status === "rejected") report(check.reason);
        return json(res, 200, {
          alm: { available: alm, label: alm ? almClient.label || "HTTP MCP connected" : "Not connected", error: alm ? undefined : checks[0].reason.message },
          sap: { available: ouc, label: ouc ? "OUC connected" : "Not connected", error: ouc ? undefined : checks[1].status === "rejected" ? checks[1].reason.message : "Connect OUC in ABAP FS" },
          copilot: { available: Boolean(runtime && model), label: model ? `${model.name || model.id} · runtime ready` : "Select a runtime model in VS Code" }, target: "OUC",
        });
      }
      if (req.method !== "POST" || !["/api/story", "/api/generate"].includes(route)) return json(res, 404, { error: "Not found." });
      if (!req.headers["content-type"]?.startsWith("application/json")) return json(res, 415, { error: "Expected application/json." });
      const input = validateInput(await readBody(req), route === "/api/story");
      if (route === "/api/story") {
        const story = await getStory(input.storyId, source.token);
        const { raw, ...publicStory } = story;
        return json(res, 200, publicStory);
      }
      if (busy) return json(res, 409, { error: "Another generation is running. Cancel it or wait for completion." });
      busy = generation = true;
      res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8" });
      const send = event => { if (!source.token.isCancellationRequested && !res.destroyed) res.write(JSON.stringify(event) + "\n"); };
      const document = await generate(input, source.token, send);
      if (source.token.isCancellationRequested) throw new Error("Generation cancelled or timed out.");
      send({ type: "result", document });
      res.end();
    } catch (error) {
      report(error);
      if (res.destroyed) return;
      if (res.headersSent) res.end(JSON.stringify({ type: "error", message: source.token.isCancellationRequested ? "Request cancelled or timed out." : error.message }) + "\n");
      else json(res, 400, { error: source.token.isCancellationRequested ? "Request cancelled or timed out." : error.message });
    } finally {
      if (generation) busy = false;
      clearTimeout(timer);
      jobs.delete(source);
      source.dispose();
    }
  }

  function stop() {
    jobs.forEach(job => job.cancel());
    server?.closeAllConnections();
    server?.close();
    server = undefined;
    secret = undefined;
    const previousRuntime = runtime;
    runtime = undefined;
    model = undefined;
    void previousRuntime?.stop().catch(() => {});
    output.appendLine("Portal stopped.");
  }

  async function configureHttp() {
    if (busy) throw new Error("Finish or cancel generation before changing MCP connections.");
    const current = context.globalState.get("almMcpUrl") || "";
    const url = await vscode.window.showInputBox({
      title: "ALM MCP server URL", prompt: "Use the ALM MCP endpoint from your existing configuration. Credentials must not be included in the URL.",
      value: current, ignoreFocusOut: true,
      validateInput: value => { try { new McpClient(value); return undefined; } catch (error) { return error.message; } },
    });
    if (url === undefined) return false;
    const almAuthorization = await vscode.window.showInputBox({ title: "ALM MCP Authorization header", prompt: "Optional full Authorization value (for example Bearer ...). Leave blank if the endpoint needs no header. Stored only in VS Code SecretStorage.", password: true, ignoreFocusOut: true, value: await context.secrets.get("almAuthorization") || "" });
    if (almAuthorization === undefined) return false;
    const sapAuthorization = await vscode.window.showInputBox({ title: "ABAP FS MCP Authorization header", prompt: "Optional full Authorization value for the ABAP FS MCP server at 127.0.0.1:4847. Leave blank if no API key is configured.", password: true, ignoreFocusOut: true, value: await context.secrets.get("sapAuthorization") || "" });
    if (sapAuthorization === undefined) return false;
    await context.globalState.update("almMcpUrl", url);
    await context.secrets.store("almAuthorization", almAuthorization);
    await context.secrets.store("sapAuthorization", sapAuthorization);
    almClient = new McpClient(url, almAuthorization);
    sapClient = new McpClient("http://127.0.0.1:4847/mcp", sapAuthorization);
    return true;
  }

  async function selectRegisteredAlm(tools = registeredStoryTools(vscode)) {
    if (!tools.length) throw new Error("No read-only ALM story-details tool is visible to VS Code extensions. Run MCP: List Servers and start ALM in this window. A connection available only in a separate chat/CLI cannot be inherited by this extension.");
    const saved = context.globalState.get("almToolName");
    const known = tools.find(tool => tool.name === saved);
    const selected = known || (tools.length === 1 ? tools[0] :
      (await vscode.window.showQuickPick(tools.map(tool => ({ label: tool.name, tool })), { title: "Select the signed-in ALM MCP story-details tool" }))?.tool);
    if (!selected) return undefined;
    output.appendLine(`Using VS Code registered ALM tool: ${selected.name}. Authentication stays with VS Code.`);
    return new VsCodeAlmClient(vscode, selected.name);
  }

  async function configure() {
    if (busy) throw new Error("Finish or cancel generation before changing MCP connections.");
    const tools = registeredStoryTools(vscode);
    output.appendLine(`Registered read-only ALM tools: ${tools.length ? tools.map(tool => tool.name).join(", ") : "none"}.`);
    const choice = await vscode.window.showQuickPick([
      { label: "Sign in directly to ALM (uninterrupted story lookups)", description: "Corporate OAuth sign-in; no per-story VS Code tool dialog", mode: "oauth" },
      { label: "Use VS Code's signed-in ALM MCP connection", description: tools.length ? `${tools.length} tool(s) registered; no copied token` : "Start ALM in this VS Code window first", mode: "vscode" },
      { label: "Use a separately authenticated HTTP MCP endpoint", description: "Advanced: VS Code's sign-in is not inherited", mode: "http" },
    ], { title: "Choose how SDD Studio connects to ALM" });
    if (!choice) return false;
    if (choice.mode === "oauth") {
      const client = new AlmOAuth(vscode, context.secrets);
      await client.signIn();
      almClient = client;
      sapClient = new McpClient("http://127.0.0.1:4847/mcp", await context.secrets.get("sapAuthorization") || "");
    } else if (choice.mode === "http") {
      if (!await configureHttp()) return false;
    } else {
      const client = await selectRegisteredAlm(tools);
      if (!client) return false;
      almClient = client;
      sapClient = new McpClient("http://127.0.0.1:4847/mcp", await context.secrets.get("sapAuthorization") || "");
      await context.globalState.update("almToolName", client.name);
    }
    await context.globalState.update("almTransport", choice.mode);
    output.appendLine(`ALM transport selected: ${choice.mode}. SAP remains on the supported external ABAP FS MCP endpoint.`);
    return true;
  }

  async function connectAlm() {
    const mode = context.globalState.get("almTransport");
    const tools = registeredStoryTools(vscode);
    output.appendLine(`ALM discovery: ${tools.length} registered story-details tool(s).`);
    if (mode === "oauth") {
      almClient = new AlmOAuth(vscode, context.secrets);
    } else if (mode === "vscode" || (!mode && tools.length)) {
      const client = await selectRegisteredAlm(tools);
      if (!client) return false;
      almClient = client;
      await context.globalState.update("almTransport", "vscode");
      await context.globalState.update("almToolName", client.name);
    } else {
      const url = context.globalState.get("almMcpUrl");
      if (!url) return configure();
      almClient = new McpClient(url, await context.secrets.get("almAuthorization") || "");
      output.appendLine("Using separately authenticated HTTP ALM client; VS Code MCP sign-in is not inherited.");
    }
    sapClient = new McpClient("http://127.0.0.1:4847/mcp", await context.secrets.get("sapAuthorization") || "");
    return true;
  }

  async function open() {
    if (opening) return;
    opening = true;
    try {
      if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace before opening the portal.");
      if (server) return vscode.env.openExternal(vscode.Uri.parse(origin));
      const savedRoot = context.globalState.get("guidanceRoot");
      const roots = await vscode.window.showOpenDialog({
        title: "Select the sapsdd repository containing the SDD agents and skills",
        canSelectFolders: true, canSelectFiles: false, canSelectMany: false,
        defaultUri: savedRoot ? vscode.Uri.file(savedRoot) : vscode.workspace.workspaceFolders?.[0]?.uri,
      });
      if (!roots?.length) return;
      guidanceRoot = roots[0];
      await vscode.workspace.fs.readFile(vscode.Uri.joinPath(guidanceRoot, "AGENTS.md"));
      await vscode.workspace.fs.readFile(vscode.Uri.joinPath(guidanceRoot, ".github", "skills", "sdd-spec", "SKILL.md"));
      await context.globalState.update("guidanceRoot", guidanceRoot.fsPath);
      if (!await connectAlm()) return;
      runtime = await startRuntime(path.join(context.globalStorageUri.fsPath, "copilot-home"));
      const models = (await runtime.listModels()).filter(item => item.id && item.id !== "auto");
      if (!models.length) throw new Error("No signed-in Copilot runtime models are available. Complete runtime sign-in and enable the required model.");
      const selected = await vscode.window.showQuickPick(
        models.map(item => ({ label: item.name || item.id, description: item.id, model: item })),
        { title: "Explicitly select the sdd-architect runtime model (no automatic/default selection)" });
      if (!selected) { await runtime.stop(); runtime = undefined; return; }
      model = selected.model;
      secret = crypto.randomBytes(32).toString("hex");
      server = http.createServer((req, res) => { void handle(req, res); });
      server.requestTimeout = 30000;
      server.headersTimeout = 10000;
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); });
      });
      origin = `http://127.0.0.1:${server.address().port}`;
      server.on("error", error => { report(error); vscode.window.showErrorMessage(`SDD Studio: ${error.message}`); });
      output.appendLine(`Portal running at ${origin}. ALM: ${almClient.transport || "http"}. SAP target: OUC. Model: ${model?.name || "unavailable"}. Guidance: ${guidanceRoot.fsPath}.`);
      await vscode.env.openExternal(vscode.Uri.parse(origin));
    } catch (error) {
      if (server && !server.listening) server = undefined;
      if (!server && runtime) { await runtime.stop().catch(() => {}); runtime = undefined; model = undefined; }
      report(error);
      output.show(true);
      vscode.window.showErrorMessage(`SDD Studio: ${error.message}`);
    } finally {
      opening = false;
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("sddStudio.open", open),
    vscode.commands.registerCommand("sddStudio.stop", stop),
    vscode.commands.registerCommand("sddStudio.runtimeSetup", async () => {
      const home = path.join(context.globalStorageUri.fsPath, "copilot-home");
      const command = `.\\Install.ps1 -SignInRuntime -RuntimeHome '${home.replace(/'/g, "''")}'`;
      const choice = await vscode.window.showInformationMessage(
        `Copilot runtime authentication is separate from ALM OAuth. In the extension source folder, run ${command} and use /login, then /exit. Reopen SDD Studio and explicitly choose a runtime model.`,
        { modal: true }, "Copy setup command");
      if (choice) await vscode.env.clipboard.writeText(command);
    }),
    vscode.commands.registerCommand("sddStudio.configure", async () => {
      try { if (await configure()) vscode.window.showInformationMessage("SDD Studio: MCP connections updated. Refresh portal status."); }
      catch (error) { report(error); vscode.window.showErrorMessage(error.message); }
    }),
    vscode.commands.registerCommand("sddStudio.signInAlm", async () => {
      try {
        if (busy) throw new Error("Finish or cancel generation before signing in.");
        const client = new AlmOAuth(vscode, context.secrets);
        await client.signIn();
        almClient = client;
        await context.globalState.update("almTransport", "oauth");
        vscode.window.showInformationMessage("SDD Studio: ALM OAuth connected. Refresh portal status. Story lookups no longer use VS Code tool confirmations.");
      } catch (error) { report(error); vscode.window.showErrorMessage(error.message); }
    }),
    vscode.window.registerUriHandler({ handleUri: uri => { if (uri.path === "/open") return open(); } }),
    { dispose: stop },
  );
}

module.exports = { activate };

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { ALLOWED } = require("./bridge");

for (const [transport, scenario] of [["vscode", "saved"], ["http", "saved"], ["vscode", "declined"], ["vscode", "unverified"]]) {
test(`FIXTURE ONLY: HTTP bridge ${transport}/${scenario}, reads separate from named runtime`, async () => {
  const commands = new Map();
  const calls = [];
  let openedUrl;
  let modelCalls = 0;
  let httpAlmCalls = 0;
  const model = { id: "test-only", name: "Fixture model" };
  let saves = 0;
  const canonicalFixture = {
    loadContext: async () => ({ relative: "specs/ST123456.md", revision: "R001" }),
    persist: async (_context, markdown) => { saves++; return { markdown, canonicalPath: "specs/ST123456.md", revision: "R001" }; },
  };
  const runtimeFixture = {
    startRuntime: async () => ({ listModels: async () => [model], stop: async () => {} }),
    runArchitect: async ({ getStory, input, token, invoke }) => {
      modelCalls++;
      await getStory(input.storyId, token);
      await invoke("abapfs_get_object_source", { connectionId: "OUC" }, token);
      if (scenario === "unverified") throw new Error("Named sdd-architect invocation was not verified; no fallback.");
      return { candidate: "# FIXTURE ONLY - not a live invocation", evidence: [], limitations: [],
        invocation: { agent: "sdd-architect", sessionId: "fixture", sdkVersion: "fixture", runtimeVersion: "fixture", verified: true } };
    },
  };
  class CancellationTokenSource {
    constructor() { this.token = { isCancellationRequested: false }; }
    cancel() { this.token.isCancellationRequested = true; }
    dispose() {}
  }
  const vscode = {
    CancellationTokenSource,
    LanguageModelChatMessage: { User: content => ({ content }) },
    Uri: { file: fsPath => ({ fsPath }), parse: value => ({ value }), joinPath: (root, ...parts) => ({ fsPath: path.join(root.fsPath, ...parts) }) },
    workspace: { isTrusted: true, openTextDocument: async value => value, fs: { readFile: async () => Buffer.from("Fixture guidance only.") } },
    window: {
      createOutputChannel: () => ({ appendLine() {}, show() {}, dispose() {} }),
      showOpenDialog: async () => [{ fsPath: "C:\\fixture-guidance" }],
      showQuickPick: async options => options[0],
      showTextDocument: async () => {},
      showInformationMessage: async () => scenario === "declined" ? undefined : "Save canonical specification",
      showWarningMessage() {}, showErrorMessage(message) { throw new Error(message); },
      registerUriHandler: () => ({ dispose() {} }),
    },
    commands: { registerCommand: (name, handler) => { commands.set(name, handler); return { dispose() {} }; } },
    env: { openExternal: async uri => { openedUrl = uri.value; return true; } },
    lm: {
      tools: [...ALLOWED].map(name => ({ name })),
      selectChatModels: async () => [model],
      invokeTool: async (name, options) => {
        calls.push({ name, input: options.input });
        let value;
        if (name === "item_details_tool") value = { data: [{ DISPLAY_ID: options.input.ids[0], STORY_NAME: "Revise ZDEMO_REPORT", STORY_DESC: "<p>Fixture requirement for output.</p>" }] };
        else if (name === "abapfs_get_connected_systems") value = "Connected SAP systems: OUC";
        else if (name === "abapfs_search_objects") value = 'Found 1 ABAP objects:\n• ZDEMO_REPORT (PROG/P)\n  Example report';
        else if (name === "abapfs_get_object_source") value = "1: REPORT zdemo_report.";
        else if (name === "abapfs_analyze_object_relations") value = "No related objects found in this fixture.";
        else throw new Error("Unexpected tool invocation");
        return { content: [{ value: typeof value === "string" ? value : JSON.stringify(value) }] };
      },
    },
  };
  class FixtureMcpClient {
    async listTools() { return vscode.lm.tools; }
    async call(name, input) {
      if (name === "item_details_tool") httpAlmCalls++;
      return vscode.lm.invokeTool(name, { input });
    }
  }
  const sandbox = {
    require: name => name === "vscode" ? vscode : name === "./canonical" ? canonicalFixture : name === "./architect-runtime" ? runtimeFixture : name === "./bridge" ? require("./bridge") : name === "./alm" ? require("./alm") : name === "./oauth" ? require("./oauth") : name === "./mcp" ? { McpClient: FixtureMcpClient } : require(name),
    module: { exports: {} }, Buffer, setTimeout, clearTimeout, URL, console,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "extension.js"), "utf8"), sandbox);
  sandbox.module.exports.activate({ extensionPath: __dirname, globalStorageUri: { fsPath: "C:\\fixture-storage" }, globalState: { get(key) { if (key === "almMcpUrl") return "http://127.0.0.1:1/mcp"; if (key === "almTransport") return transport; }, async update() {} }, secrets: { async get() {}, async store() {} }, subscriptions: [] });
  await commands.get("sddStudio.open")();
  const origin = openedUrl;
  try {
    assert.equal((await fetch(`${origin}/api/status`)).status, 403);
    const bootstrap = await (await fetch(`${origin}/bootstrap.js`)).text();
    const token = bootstrap.match(/"token":"([^"]+)"/)[1];
    const headers = { "X-SDD-Token": token, "Content-Type": "application/json" };
    assert.equal((await fetch(`${origin}/api/status`, { headers: { ...headers, Origin: "https://untrusted.example" } })).status, 403);
    const status = await (await fetch(`${origin}/api/status`, { headers })).json();
    assert.equal(status.sap.available, true);
    assert.equal(status.alm.label, transport === "vscode" ? "VS Code MCP registered" : "HTTP MCP connected");
    const story = await (await fetch(`${origin}/api/story`, { method: "POST", headers, body: JSON.stringify({ storyId: "ST123456" }) })).json();
    assert.equal(story.objects[0], "ZDEMO_REPORT");
    assert.equal(modelCalls, 0, "Story lookup must never trigger generation");
    assert.equal(calls.some(call => call.name === "abapfs_get_object_source"), false);
    const input = { storyId: "ST123456", objects: ["ZDEMO_REPORT"], requirement: "An explicit fixture change requirement.", target: "UAT" };
    assert.equal((await fetch(`${origin}/api/generate`, { method: "POST", headers, body: JSON.stringify(input) })).status, 400);
    input.target = "OUC";
    const response = await fetch(`${origin}/api/generate`, { method: "POST", headers, body: JSON.stringify(input) });
    const events = (await response.text()).trim().split("\n").map(JSON.parse);
    if (scenario === "saved") {
      assert.equal(events.at(-1).type, "result", JSON.stringify(events));
      assert.equal(events.at(-1).document.canonicalPath, "specs/ST123456.md");
      assert.equal(saves, 1);
    } else {
      assert.equal(events.at(-1).type, "error", JSON.stringify(events));
      assert.equal(saves, 0, "Declined or unverified runs must never persist a canonical revision");
      assert.match(events.at(-1).message, scenario === "declined" ? /not approved/ : /not verified/);
    }
    assert.equal(modelCalls, 1);
    assert.equal(httpAlmCalls, transport === "vscode" ? 0 : 2, "Native ALM must not make separate unauthenticated HTTP requests");
    for (const call of calls.filter(call => call.name.startsWith("abapfs_") && call.name !== "abapfs_get_connected_systems")) assert.equal(call.input.connectionId, "OUC");
    assert.equal((await fetch(`${origin}/api/invoke`, { method: "POST", headers, body: "{}" })).status, 404);
    assert.equal(calls.every(call => ALLOWED.has(call.name)), true);
  } finally {
    commands.get("sddStudio.stop")();
  }
});
}

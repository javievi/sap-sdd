"use strict";

// All sessions/events below are explicit fixtures. No SDK authentication,
// model requests, SAP calls, ALM calls or actual agent invocation occur here.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const syncFs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { GUIDANCE, TEMPLATE, validateCanonical, persist, withHistory, storyPath, loadContext } = require("./canonical");
const { createAudit, runArchitect, AVAILABLE, TOOL_NAMES } = require("./architect-runtime");
const template = syncFs.readFileSync(path.join(__dirname, "..", ...TEMPLATE.split("/")), "utf8");
const date = "2026-10-22";

function specification(revision = "R001", oldRow = "") {
  let text = template.replace(/<[^>]+>/g, "Fixture-only detail; not live SAP evidence.");
  text = text.replace(/^# .+$/m, "# ST123456 - Fixture feature");
  const fields = { "Story ID": "ST123456", "Spec revision": revision, "Specification status": "Draft",
    "Development status": "Not started", "Implemented revision": "None", Updated: date, "Design approval": "Not obtained" };
  for (const [name, value] of Object.entries(fields)) {
    text = text.replace(new RegExp(`^\\| ${name} \\| .+ \\|$`, "m"), `| ${name} | ${value} |`);
  }
  return text.replace(/^\| R001 \| .+ \|$/m, `${oldRow ? oldRow + "\n" : ""}| ${revision} | ${date} | Fixture source | BR-001 / AC-001 | P-001 / T-001 | Not obtained |`);
}
const initial = specification();
const historyRow = `| R001 | ${date} | Fixture source | BR-001 / AC-001 | P-001 / T-001 | Not obtained |`;
const options = { storyId: "ST123456", template, previous: null, date };

function context() {
  const files = new Map(GUIDANCE.map(file => [file, syncFs.readFileSync(path.join(__dirname, "..", ...file.split("/")), "utf8")]));
  files.set("specs/ST123456.md", "No existing canonical spec.");
  return { ...options, relative: "specs/ST123456.md", files, revision: "R001", agentBody: files.get(GUIDANCE[1]), hashes: {} };
}
function cancellation() {
  const callbacks = new Set();
  return { isCancellationRequested: false,
    onCancellationRequested(callback) { callbacks.add(callback); return { dispose: () => callbacks.delete(callback) }; },
    cancel() { this.isCancellationRequested = true; for (const callback of callbacks) callback(); } };
}
function fixtureClient(mode = "valid", token = cancellation()) {
  let config;
  const client = { sddDirectory: os.tmpdir(), stopped: false,
    async createSession(value) {
      config = value;
      const emit = (type, data = {}) => value.onEvent({ type, data });
      const call = async (name, args) => {
        emit("tool.execution_start", { toolName: name });
        return value.tools.find(tool => tool.name === name).handler(args);
      };
      client.call = call;
      return {
        sessionId: "FIXTURE-NOT-LIVE",
        rpc: { agent: { async select({ name }) {
          if (mode !== "no-selection-event") emit("subagent.selected", { agentName: mode === "wrong-agent" ? "other-agent" : name });
          return { agent: { name: mode === "wrong-agent" ? "other-agent" : name } };
        } } },
        async sendAndWait() {
          if (mode === "no-execution") return;
          if (mode === "cancel") { token.cancel(); return; }
          if (mode === "forbidden-event") emit("tool.execution_start", { toolName: "bash" });
          if (mode === "bad-read") { await call("read_file", { path: "../private" }); return; }
          if (mode === "other-story") { await call("alm_story_detail", { storyId: "ST999" }); return; }
          if (mode === "other-system") { await call("abapfs_search_objects", { objectName: "ZDEMO", connectionId: "UAT" }); return; }
          if (mode === "early-write") { await call("write_spec", { path: "specs/ST123456.md", markdown: initial }); return; }
          for (const file of context().files.keys()) await call("read_file", { path: file });
          await call("alm_story_detail", { storyId: "ST123456" });
          await call("abapfs_search_objects", { objectName: "ZDEMO", connectionId: "OUC" });
          await call("abapfs_get_object_source", { objectName: "ZDEMO", connectionId: "OUC", startLine: 1 });
          await call("abapfs_analyze_object_relations", { objectName: "ZDEMO", connectionId: "OUC" });
          if (mode === "bad-path") { await call("write_spec", { path: "specs/ST999.md", markdown: initial }); return; }
          await call("write_spec", { path: "specs/ST123456.md", markdown: mode === "abridged" ? "# ST123456 - six sections only" : initial });
          if (mode === "deselected") emit("subagent.deselected");
          if (mode === "error") emit("session.error", { message: "fixture failure" });
          emit("assistant.message", { content: "Fixture complete, not live." });
          if (mode !== "no-idle") emit("session.idle", { aborted: false });
        },
        async abort() { client.aborted = true; },
        async disconnect() { client.disconnected = true; },
      };
    },
    config: () => config,
  };
  return client;
}
async function run(mode = "valid", supplied = {}) {
  const token = supplied.token || cancellation();
  const client = supplied.client || fixtureClient(mode, token);
  const result = await runArchitect({
    client, token, modelId: "FIXTURE-EXPLICIT-MODEL", context: context(),
    input: { storyId: "ST123456", objects: ["ZDEMO"], requirement: "Fixture requirement only, no live evidence.", target: "OUC" },
    async getStory() { return { title: "Fixture", raw: "Fixture ALM evidence, not live." }; },
    async invoke(name, args) {
      assert.equal(args.connectionId, "OUC");
      if (name === "abapfs_search_objects") return { text: "Fixture discovery.", data: [{ name: "ZDEMO", type: "PROG/P" }] };
      if (name === "abapfs_get_object_source") { assert.equal(args.version, "active"); assert.equal(args.lineCount, 350); }
      return { text: "Fixture SAP evidence, not live." };
    },
    async ask() { return "Fixture answer"; }, progress() {}, ...supplied,
  });
  return { result, client };
}

test("FIXTURE: full actual template accepted; abridgement, placeholders, status and history deletion rejected", () => {
  assert.equal(validateCanonical(initial, options).revision, "R001");
  assert.throws(() => validateCanonical("# ST123456 - abridged", options), /headings/);
  assert.throws(() => validateCanonical(initial.replace("## 8.", "## 80."), options), /headings/);
  assert.throws(() => validateCanonical(initial + "\n<placeholder>\n", options), /placeholders/);
  assert.throws(() => validateCanonical(initial.replace("| Development status | Not started |", "| Development status | Verified |"), options), /status/);
  assert.throws(() => validateCanonical(initial.replace("| Implemented revision | None |", "| Implemented revision | R001 |"), options), /implemented/);
  assert.throws(() => validateCanonical(specification("R002"), { ...options, previous: initial }), /history rows/);
  assert.equal(validateCanonical(specification("R002", historyRow), { ...options, previous: initial }).revision, "R002");
});

test("FIXTURE: save exact story, preserve full prior evidence/history, reject stale state and cancellation", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-spec-fixture-"));
  try {
    const ctx = { ...options, root, relative: storyPath("ST123456") };
    await persist(ctx, initial);
    const target = path.join(root, "specs", "ST123456.md");
    assert.equal(await fs.readFile(target, "utf8"), initial.replace(/\r\n/g, "\n").trim() + "\n");
    const previous = await fs.readFile(target, "utf8");
    const saved = await persist({ ...ctx, previous }, specification("R002", historyRow));
    assert.ok(saved.markdown.includes(previous.trim()));
    assert.ok(saved.markdown.includes("Preserved prior spec R001"));
    await assert.rejects(persist({ ...ctx, previous }, specification("R002", historyRow)), /changed/);
    await assert.rejects(persist({ ...ctx, previous: saved.markdown }, specification("R003", `${historyRow}\n| R002 | ${date} | Fixture source | BR-001 / AC-001 | P-001 / T-001 | Not obtained |`), () => true), /cancelled/);
    assert.equal(await fs.readFile(target, "utf8"), saved.markdown);
    assert.throws(() => storyPath("../ST1"), /Invalid/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("FIXTURE: snapshot growth is linear and retains previous snapshots", () => {
  const second = withHistory(specification("R002", historyRow), initial);
  const third = withHistory(specification("R003", historyRow), second);
  assert.equal(third.split("Preserved prior spec R001").length - 1, 1);
  assert.equal(third.split("Preserved prior spec R002").length - 1, 1);
});

test("FIXTURE: real named-agent adapter requires select + runtime events and exact tools; no model override", async () => {
  const { result, client } = await run();
  assert.equal(result.invocation.agent, "sdd-architect");
  assert.equal(result.invocation.sessionId, "FIXTURE-NOT-LIVE");
  assert.equal(result.candidate, initial.replace(/\r\n/g, "\n").trim() + "\n");
  const config = client.config();
  assert.equal(config.model, "FIXTURE-EXPLICIT-MODEL");
  assert.deepEqual(config.allowedModels, [config.model]);
  assert.deepEqual(config.availableTools, AVAILABLE);
  assert.deepEqual(config.tools.map(tool => tool.name), TOOL_NAMES);
  assert.equal(config.customAgents[0].model, undefined);
  assert.equal(config.enableConfigDiscovery, false);
  assert.equal(config.enableHostGitOperations, false);
  assert.deepEqual(config.onPermissionRequest({ kind: "shell" }), { kind: "reject" });
  assert.equal(config.hooks.onPreToolUse({ toolName: "bash" }).permissionDecision, "deny");
  assert.ok(client.disconnected);
});

for (const mode of ["no-selection-event", "wrong-agent", "no-execution", "no-idle", "deselected", "error", "forbidden-event",
  "bad-read", "other-story", "other-system", "bad-path", "early-write", "abridged", "cancel"]) {
  test(`FIXTURE: fail closed for ${mode}; never fallback`, async () => {
    await assert.rejects(run(mode));
  });
}

test("FIXTURE: selection alone is not invocation proof", () => {
  const audit = createAudit();
  audit.selected = true;
  audit.observe({ type: "subagent.selected", data: { agentName: "sdd-architect" } });
  assert.throws(() => audit.assert(), /not verified/);
});

test("FIXTURE: no automatic/inherited model and no alternate canonical folder", async () => {
  await assert.rejects(run("valid", { modelId: "auto" }), /Explicitly select/);
  await assert.rejects(run("valid", { modelId: "" }), /Explicitly select/);
  await assert.rejects(persist({ ...options, root: os.tmpdir(), relative: "other/ST123456.md" }, initial), /exact canonical/);
});

test("FIXTURE: known file reads reject linked specs rather than following them", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-link-fixture-"));
  try {
    const directory = path.join(root, "specs");
    const target = path.join(root, "outside.md");
    await fs.mkdir(directory);
    await fs.writeFile(target, initial);
    try { await fs.symlink(target, path.join(directory, "ST123456.md")); }
    catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) { t.skip("Host does not permit fixture symlinks; not a passed symlink check."); return; }
      throw error;
    }
    await assert.rejects(persist({ ...options, root: await fs.realpath(root), relative: "specs/ST123456.md" }, initial), /Linked/);
    assert.equal(await fs.readFile(target, "utf8"), initial);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("FIXTURE: known-file guidance loader uses actual architect, skill, template and team rules", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-guidance-fixture-"));
  try {
    for (const [file, text] of context().files) {
      if (!GUIDANCE.includes(file)) continue;
      const target = path.join(root, ...file.split("/"));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, text);
    }
    const loaded = await loadContext(await fs.realpath(root), "ST123456");
    assert.ok(loaded.agentBody.trimStart().startsWith("# SDD Architect"));
    assert.equal(loaded.files.size, GUIDANCE.length + 1);
    assert.equal(loaded.previous, null);
    assert.equal(Object.keys(loaded.hashes).length, GUIDANCE.length);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

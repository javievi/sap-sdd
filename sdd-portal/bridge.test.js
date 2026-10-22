"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateInput, decodeResult, extractStory, resolveObject, validateDocument, TITLES, ALLOWED } = require("./bridge");

const input = { storyId: "st123456", objects: ["ZDEMO_REPORT"], requirement: "An explicit business requirement for review.", target: "OUC" };
const tool = value => ({ content: [{ value: typeof value === "string" ? value : JSON.stringify(value) }] });

test("accepts bounded input, normalizes names, and disallows other SAP targets", () => {
  assert.equal(validateInput(input).storyId, "ST123456");
  assert.throws(() => validateInput({ ...input, target: "UAT" }), /Only/);
  assert.throws(() => validateInput({ ...input, objects: ["Z*"] }), /valid/);
  assert.throws(() => validateInput({ ...input, objects: Array(21).fill("ZDEMO") }), /valid/);
  assert.throws(() => validateInput({ ...input, requirement: " " }), /requirement/);
  assert.throws(() => validateInput({ storyId: { toString: () => "ST123" } }), /valid/);
});

test("decodes ALM HTTP wrappers and rejects service errors", () => {
  const story = { DISPLAY_ID: "ST123456", STORY_NAME: "Revise ZDEMO_REPORT", STORY_DESC: "<p>Your year-end output should change.</p>" };
  const result = decodeResult(tool({ status_code: 200, body: JSON.stringify({ data: [story] }) }));
  assert.equal(extractStory(result, "ST123456").objects[0], "ZDEMO_REPORT");
  assert.equal(extractStory(result, "ST123456").objects.length, 1);
  assert.throws(() => extractStory(result, "ST777"), /matching/);
  assert.throws(() => decodeResult(tool({ status_code: 401 })), /401/);
  assert.throws(() => decodeResult(tool({ success: false })), /failure/);
  assert.throws(() => decodeResult({ isError: true }), /error/);
});

test("resolves exact names from native ABAP FS text or structured output without guessing", () => {
  assert.deepEqual(resolveObject(decodeResult(tool('Found 1 ABAP objects matching "ZDEMO_REPORT":\n\n• ZDEMO_REPORT (PROG/P)\n  Example\n  Package: ZDEMO')), "ZDEMO_REPORT"), { type: "PROG", relationType: "PROG/P" });
  assert.equal(resolveObject(decodeResult(tool([{ name: "ZCL_DEMO", type: "CLAS/OC" }])), "ZCL_DEMO").type, "CLAS");
  assert.throws(() => resolveObject(decodeResult(tool("No ABAP objects found matching pattern: ZMISSING")), "ZMISSING"), /uniquely/);
  assert.throws(() => resolveObject(decodeResult(tool([{ name: "ZDEMO", type: "PROG/P" }, { name: "ZDEMO", type: "CLAS/OC" }])), "ZDEMO"), /uniquely/);
});

test("requires all six nonempty sections, safe graph identifiers, and rectangular tables", () => {
  const doc = { sections: TITLES.map(title => ({ title, paragraphs: ["Evidence-backed draft."], bullets: [] })), diagram: { nodes: [{ id: "A", label: "Read records" }, { id: "B", label: "Display output" }], edges: [{ from: "A", to: "B" }] } };
  assert.equal(validateDocument(JSON.stringify(doc)).sections.length, 6);
  assert.throws(() => validateDocument("{}"), /six/);
  doc.diagram.edges[0].to = "UNKNOWN";
  assert.throws(() => validateDocument(JSON.stringify(doc)), /relationship/);
  doc.diagram.edges[0].to = "B";
  doc.sections[0].table = { headers: ["One"], rows: [["One", "Two"]] };
  assert.throws(() => validateDocument(JSON.stringify(doc)), /table/);
});

test("exposes only the explicit read-only tool allowlist", () => {
  assert.equal(ALLOWED.size, 5);
  assert.equal(ALLOWED.has("abapfs_activate_object"), false);
  assert.equal(ALLOWED.has("update_story_mcp_tool"), false);
  assert.equal(ALLOWED.has("abapfs_run_sql_query"), false);
});

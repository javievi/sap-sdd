"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { registeredStoryTools, VsCodeAlmClient } = require("./alm");

test("ALM uses the exact registered tool, delegates auth to VS Code, and passes cancellation", async () => {
  const token = { isCancellationRequested: false };
  const name = "mcp_alm-v2-prd_item_details_tool";
  const result = { content: [{ value: '{"data":[]}' }] };
  const vscode = { lm: {
    tools: [{ name }, { name: "mcp_alm-v2-prd_update_story_mcp_tool" }, { name: "unrelateditem_details_tool" }],
    invokeTool: async (calledName, options, calledToken) => {
      assert.equal(calledName, name);
      assert.equal(calledToken, token);
      assert.deepEqual(options, { input: { ids: ["ST123456"], type: "story" }, toolInvocationToken: undefined });
      return result;
    },
  } };
  assert.equal(registeredStoryTools(vscode).length, 1);
  const client = new VsCodeAlmClient(vscode, name);
  assert.equal(await client.call(name, { ids: ["ST123456"], type: "story" }, token), result);
  vscode.lm.tools = [];
  await assert.rejects(client.listTools(), /not currently registered/);
  await assert.rejects(client.call(name, { ids: ["ST123456"], type: "story" }, token), /not currently registered/);
});

test("ALM rejects writes, another tool, extra endpoint arguments, and non-story inputs before invocation", async () => {
  let invocations = 0;
  const name = "mcp_alm_item_details_tool";
  const vscode = { lm: { tools: [{ name }], invokeTool: async () => { invocations++; } } };
  const client = new VsCodeAlmClient(vscode, name);
  for (const [tool, input] of [
    ["update_story_mcp_tool", { ids: ["ST123456"], type: "story" }],
    [name, { ids: ["DF123456"], type: "defect" }],
    [name, { ids: ["ST123456", "ST123457"], type: "story" }],
    [name, { ids: ["ST123456"], type: "story", mcp_url: "https://other.example" }],
  ]) await assert.rejects(client.call(tool, input), /single read-only/);
  assert.equal(invocations, 0);
});

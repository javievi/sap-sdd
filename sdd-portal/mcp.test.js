"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { McpClient } = require("./mcp");

test("MCP client negotiates sessions, accepts JSON/SSE, and reports tool errors", async () => {
  const methods = [];
  const server = http.createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const rpc = JSON.parse(text);
    methods.push(rpc.method);
    assert.equal(req.headers.authorization, "Bearer fixture-only");
    if (rpc.method !== "initialize") {
      assert.equal(req.headers["mcp-session-id"], "fixture-session");
      assert.equal(req.headers["mcp-protocol-version"], "2025-03-26");
    }
    let result;
    if (rpc.method === "initialize") {
      res.setHeader("Mcp-Session-Id", "fixture-session");
      result = { protocolVersion: "2025-03-26", capabilities: {} };
    } else if (rpc.method === "notifications/initialized") {
      res.writeHead(202); res.end(); return;
    } else if (rpc.method === "tools/list") {
      result = { tools: [{ name: "item_details_tool" }] };
    } else {
      result = { content: [{ type: "text", text: JSON.stringify({ data: ["fixture"] }) }], isError: rpc.params.arguments.fail === true };
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`event: message\r\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result })}\r\n\r\n`);
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
  });

  test("401 identifies separate-client authentication and does not echo credentials or response bodies", async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(401, { "Content-Type": "text/plain" });
      res.end("Sensitive response body must not be included in errors.");
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const client = new McpClient(`http://127.0.0.1:${server.address().port}/mcp`, "Bearer do-not-log");
      await assert.rejects(client.listTools(), error => {
        assert.match(error.message, /HTTP 401/);
        assert.match(error.message, /separate HTTP client/);
        assert.match(error.message, /Configure MCP Connections/);
        assert.doesNotMatch(error.message, /do-not-log|Sensitive response body/);
        return true;
      });
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new McpClient(`http://127.0.0.1:${server.address().port}/mcp`, "Bearer fixture-only");
    assert.equal((await client.listTools())[0].name, "item_details_tool");
    assert.match((await client.call("item_details_tool", {})).content[0].value, /fixture/);
    assert.equal((await client.call("item_details_tool", { fail: true })).isError, true);
    assert.equal(methods.filter(method => method === "initialize").length, 1);
    assert.throws(() => new McpClient("http://public.example/mcp"), /HTTPS/);
    assert.throws(() => new McpClient("https://user:password@example.com"), /credentials/);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

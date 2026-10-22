"use strict";

class McpClient {
  constructor(url, authorization = "") {
    const endpoint = new URL(url);
    if (endpoint.username || endpoint.password || !["https:", "http:"].includes(endpoint.protocol) ||
        (endpoint.protocol === "http:" && !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname))) {
      throw new Error("MCP endpoints must use HTTPS, or HTTP on loopback. Do not put credentials in the URL.");
    }
    this.url = endpoint.href;
    this.authorization = authorization;
    this.sequence = 0;
    this.version = "2025-03-26";
  }

  async request(method, params, token, notification = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    const subscription = token?.onCancellationRequested?.(() => controller.abort());
    if (token?.isCancellationRequested) controller.abort();
    try {
      const id = notification ? undefined : ++this.sequence;
      const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
      if (this.authorization) headers.Authorization = this.authorization;
      if (this.session) headers["Mcp-Session-Id"] = this.session;
      if (method !== "initialize") headers["MCP-Protocol-Version"] = this.version;
      const response = await fetch(this.url, {
        method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", ...(id ? { id } : {}), method, params }),
        signal: controller.signal, redirect: "error",
      });
      if (!response.ok) {
        if (response.status === 404) { this.session = undefined; this.initialized = undefined; }
        if (response.status === 401) throw new Error(`MCP ${method} returned HTTP 401. This separate HTTP client is not authenticated; restarting the server or signing in to VS Code MCP does not authenticate it. For ALM, run SDD Studio: Configure MCP Connections and choose VS Code's signed-in connection. For a separate endpoint, configure its own authorization.`);
        throw new Error(`MCP ${method} returned HTTP ${response.status}. Check the server, sign-in, and authorization in VS Code.`);
      }
      if (method === "initialize") this.session = response.headers.get("mcp-session-id") || undefined;
      if (notification) { await response.body?.cancel(); return; }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("MCP returned an empty response.");
      const decoder = new TextDecoder();
      let text = "";
      let eventBuffer = "";
      let received = 0;
      let reply;
      try {
        while (true) {
          const { value, done } = await reader.read();
          const chunk = decoder.decode(value, { stream: !done });
          received += chunk.length;
          if (received > 1200000) throw new Error("MCP response exceeded the 1.2 MB limit.");
          if (response.headers.get("content-type")?.includes("text/event-stream")) {
            eventBuffer = (eventBuffer + chunk).replace(/\r\n/g, "\n");
            const events = eventBuffer.split("\n\n");
            eventBuffer = events.pop();
            for (const event of events) {
              const data = event.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
              if (!data) continue;
              const message = JSON.parse(data);
              if (message.id === id) reply = message;
            }
          } else text += chunk;
          if (done && !reply && eventBuffer.trim()) {
            const data = eventBuffer.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
            if (data) { const message = JSON.parse(data); if (message.id === id) reply = message; }
          }
          if (reply || done) break;
        }
      } finally { await reader.cancel(); reader.releaseLock(); }
      if (!reply && text) reply = JSON.parse(text);
      if (!reply || reply.id !== id) throw new Error("MCP returned no matching JSON-RPC response.");
      if (reply.error) throw new Error(`MCP ${method} failed: ${String(reply.error.message || reply.error.code).slice(0, 500)}`);
      return reply.result;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("MCP request cancelled or timed out. Approve any pending connection prompts in VS Code.");
      if (error instanceof TypeError) throw new Error("Cannot reach the MCP endpoint. Start the server and check the configured URL.");
      throw error;
    } finally {
      clearTimeout(timer);
      subscription?.dispose();
    }
  }

  async initialize(token) {
    if (!this.initialized) {
      this.initialized = (async () => {
        const result = await this.request("initialize", { protocolVersion: this.version, capabilities: {}, clientInfo: { name: "sdd-studio-read-only", version: "0.2.2" } }, token);
        if (!result?.protocolVersion) throw new Error("MCP server did not negotiate a protocol version.");
        this.version = result.protocolVersion;
        await this.request("notifications/initialized", {}, token, true);
      })();
    }
    try { await this.initialized; } catch (error) { this.initialized = undefined; throw error; }
  }

  async listTools(token) {
    await this.initialize(token);
    const tools = [];
    let cursor;
    for (let page = 0; page < 10; page++) {
      const result = await this.request("tools/list", cursor ? { cursor } : {}, token);
      if (!Array.isArray(result?.tools)) throw new Error("MCP tool list is invalid.");
      tools.push(...result.tools);
      cursor = result.nextCursor;
      if (!cursor) return tools;
    }
    throw new Error("MCP tool discovery exceeded ten pages.");
  }

  async call(name, input, token) {
    await this.initialize(token);
    const result = await this.request("tools/call", { name, arguments: input }, token);
    if (!result || !Array.isArray(result.content)) throw new Error("MCP tool returned no content.");
    return { isError: result.isError, content: result.content.filter(part => part.type === "text").map(part => ({ value: part.text })) };
  }
}

module.exports = { McpClient };

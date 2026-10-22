"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { McpClient } = require("./mcp");

const ISSUER = "https://alm-ai-gateway.digital.oocl.com";
const RESOURCE = `${ISSUER}/v2/mcp`;
const SECRET = "almOAuthSession";

class AlmOAuth {
  constructor(vscode, secrets) {
    this.vscode = vscode;
    this.secrets = secrets;
    this.pending = undefined;
    this.label = "ALM OAuth connected";
    this.transport = "oauth";
  }

  async post(url, data, json = false) {
    if (new URL(url).origin !== ISSUER) throw new Error("Unexpected ALM OAuth endpoint origin.");
    const response = await fetch(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
      headers: { "Content-Type": json ? "application/json" : "application/x-www-form-urlencoded" },
      body: json ? JSON.stringify(data) : new URLSearchParams(data),
    });
    if (!response.ok) {
      const error = new Error(`ALM OAuth request failed (HTTP ${response.status}). Sign in again if your session has expired.`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async metadata() {
    const response = await fetch(`${ISSUER}/.well-known/oauth-authorization-server`, { redirect: "error", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`ALM OAuth discovery failed (HTTP ${response.status}).`);
    const metadata = await response.json();
    for (const field of ["authorization_endpoint", "token_endpoint", "registration_endpoint"]) {
      if (new URL(metadata[field]).origin !== ISSUER) throw new Error(`Unexpected ALM OAuth ${field}.`);
    }
    if (metadata.issuer !== ISSUER || !metadata.code_challenge_methods_supported?.includes("S256")) throw new Error("ALM OAuth does not advertise the expected issuer and PKCE support.");
    return metadata;
  }

  async load() {
    const saved = await this.secrets.get(SECRET);
    if (!saved) throw new Error("ALM OAuth sign-in required. Run SDD Studio: Sign In to ALM.");
    try { return JSON.parse(saved); } catch { throw new Error("Stored ALM sign-in is invalid. Run SDD Studio: Sign In to ALM."); }
  }

  async saveTokens(previous, tokens) {
    if (typeof tokens.access_token !== "string" || !tokens.access_token || String(tokens.token_type).toLowerCase() !== "bearer" ||
        !Number.isFinite(Number(tokens.expires_in)) || Number(tokens.expires_in) <= 0) throw new Error("ALM returned an invalid OAuth token response.");
    const saved = { ...previous, accessToken: tokens.access_token, refreshToken: tokens.refresh_token || previous.refreshToken,
      expiresAt: Date.now() + Number(tokens.expires_in) * 1000 };
    await this.secrets.store(SECRET, JSON.stringify(saved));
    return saved;
  }

  async signIn() {
    if (this.signingIn) throw new Error("ALM sign-in is already in progress.");
    this.signingIn = true;
    let server;
    let timer;
    try {
      const metadata = await this.metadata();
      const verifier = crypto.randomBytes(48).toString("base64url");
      const state = crypto.randomBytes(32).toString("base64url");
      let complete;
      let fail;
      const callback = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
      // Attach a handler before opening the browser so early failures cannot be unhandled.
      callback.catch(() => {});
      let redirectUri;
      server = http.createServer((req, res) => {
        const url = new URL(req.url, redirectUri);
        if (req.method !== "GET" || url.pathname !== "/callback" || url.searchParams.get("state") !== state) {
          res.writeHead(400); res.end("Invalid OAuth callback."); return;
        }
        if (url.searchParams.get("iss") && url.searchParams.get("iss") !== ISSUER) {
          res.writeHead(400); res.end("Invalid issuer."); fail(new Error("ALM sign-in returned an unexpected issuer.")); return;
        }
        const code = url.searchParams.get("code");
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'", "Referrer-Policy": "no-referrer" });
        res.end(code ? "Sign-in received. Return to VS Code to finish connecting SDD Studio." : "Sign-in was not completed. Return to VS Code.");
        if (code) complete(code);
        else fail(new Error("ALM sign-in was denied or cancelled."));
      });
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
      redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
      timer = setTimeout(() => fail(new Error("ALM sign-in timed out. Run SDD Studio: Sign In to ALM to retry.")), 180000);
      const registration = await this.post(metadata.registration_endpoint, {
        client_name: "SDD Studio read-only portal", redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none",
      }, true);
      if (typeof registration.client_id !== "string" || !registration.client_id) throw new Error("ALM OAuth registration returned no client identifier.");
      const authorization = new URL(metadata.authorization_endpoint);
      Object.entries({ response_type: "code", client_id: registration.client_id, redirect_uri: redirectUri,
        scope: "profile email", state, resource: RESOURCE,
        code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
      }).forEach(([key, value]) => authorization.searchParams.set(key, value));
      if (!await this.vscode.env.openExternal(this.vscode.Uri.parse(authorization.href))) throw new Error("Could not open the corporate ALM sign-in page.");
      const code = await callback;
      const tokens = await this.post(metadata.token_endpoint, {
        grant_type: "authorization_code", client_id: registration.client_id, redirect_uri: redirectUri,
        code, code_verifier: verifier, resource: RESOURCE,
      });
      await this.saveTokens({ clientId: registration.client_id, tokenEndpoint: metadata.token_endpoint }, tokens);
      this.client = undefined;
      this.tokenUsed = undefined;
    } finally {
      clearTimeout(timer);
      server?.closeAllConnections();
      server?.close();
      this.signingIn = false;
    }
  }

  async connection() {
    if (!this.pending) {
      this.pending = (async () => {
        let saved = await this.load();
        if (!saved.accessToken || saved.expiresAt <= Date.now() + 60000) {
          if (!saved.refreshToken) throw new Error("ALM session expired. Run SDD Studio: Sign In to ALM.");
          try {
            saved = await this.saveTokens(saved, await this.post(saved.tokenEndpoint, {
              grant_type: "refresh_token", client_id: saved.clientId, refresh_token: saved.refreshToken, resource: RESOURCE,
            }));
          } catch (error) {
            if (error.status === 400 || error.status === 401) {
              await this.secrets.delete(SECRET);
              throw new Error("ALM sign-in expired or was revoked. Run SDD Studio: Sign In to ALM.");
            }
            throw error;
          }
        }
        if (this.tokenUsed !== saved.accessToken) {
          this.client = new McpClient(RESOURCE, `Bearer ${saved.accessToken}`);
          this.tokenUsed = saved.accessToken;
        }
        return this.client;
      })();
    }
    try { return await this.pending; } finally { this.pending = undefined; }
  }

  async listTools(token) {
    return (await this.connection()).listTools(token);
  }

  async call(name, input, token) {
    if (!(name === "item_details_tool" || /[_-]item_details_tool$/.test(name)) || input?.type !== "story" || !Array.isArray(input.ids) ||
        input.ids.length !== 1 || typeof input.ids[0] !== "string" || !/^ST\d{1,20}$/.test(input.ids[0]) ||
        Object.keys(input).some(key => !["ids", "type"].includes(key))) throw new Error("ALM OAuth permits only a single read-only ST story lookup.");
    return (await this.connection()).call(name, input, token);
  }
}

module.exports = { AlmOAuth };

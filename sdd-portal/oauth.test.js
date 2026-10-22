"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

function fixture() {
  const issuer = "https://alm-ai-gateway.digital.oocl.com";
  const storage = new Map();
  const requests = [];
  let auth;
  const endpoint = value => `${issuer}/oauth/${value}`;
  const mockFetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/.well-known/oauth-authorization-server")) return { ok: true, json: async () => ({
      issuer, authorization_endpoint: endpoint("authorize"), token_endpoint: endpoint("token"),
      registration_endpoint: endpoint("register"), code_challenge_methods_supported: ["S256"],
    }) };
    if (url.endsWith("/register")) {
      const registration = JSON.parse(options.body);
      assert.deepEqual(registration.grant_types, ["authorization_code", "refresh_token"]);
      assert.equal(registration.token_endpoint_auth_method, "none");
      assert.match(registration.redirect_uris[0], /^http:\/\/127\.0\.0\.1:\d+\/callback$/);
      return { ok: true, json: async () => ({ client_id: "fixture-client" }) };
    }
    if (url.endsWith("/token")) {
      assert.equal(options.body.get("client_id"), "fixture-client");
      if (options.body.get("grant_type") === "authorization_code") {
        assert.equal(options.body.get("code"), "fixture-code");
        const challenge = crypto.createHash("sha256").update(options.body.get("code_verifier")).digest("base64url");
        assert.equal(challenge, auth.searchParams.get("code_challenge"));
      }
      return { ok: true, json: async () => ({ access_token: "fixture-access", refresh_token: "fixture-refresh", token_type: "Bearer", expires_in: 300 }) };
    }
    throw new Error("Unexpected outbound request");
  };
  const vscode = {
    Uri: { parse: value => value },
    env: { openExternal: async value => {
      auth = new URL(value);
      assert.equal(auth.origin, issuer);
      assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
      const callback = new URL(auth.searchParams.get("redirect_uri"));
      callback.searchParams.set("code", "fixture-code");
      callback.searchParams.set("state", "incorrect");
      assert.equal((await fetch(callback)).status, 400);
      callback.searchParams.set("state", auth.searchParams.get("state"));
      assert.equal((await fetch(callback)).status, 200);
      return true;
    } },
  };
  const secrets = { get: async key => storage.get(key), store: async (key, value) => storage.set(key, value), delete: async key => storage.delete(key) };
  class FakeMcp {
    constructor(url, authorization) { this.authorization = authorization; }
    async listTools() { return [{ name: "item_details_tool" }]; }
    async call(name, input) { return { name, input }; }
  }
  const sandbox = {
    require: name => name === "./mcp" ? { McpClient: FakeMcp } : require(name),
    module: { exports: {} }, URL, URLSearchParams, AbortSignal, fetch: mockFetch, setTimeout, clearTimeout,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "oauth.js"), "utf8"), sandbox);
  return { client: new sandbox.module.exports.AlmOAuth(vscode, secrets), storage, requests };
}

test("OAuth uses browser sign-in, rejects wrong state, verifies PKCE, and stores tokens privately", async () => {
  const { client, storage, requests } = fixture();
  await client.signIn();
  const saved = JSON.parse(storage.get("almOAuthSession"));
  assert.equal(saved.clientId, "fixture-client");
  assert.equal(saved.accessToken, "fixture-access");
  assert.equal((await client.listTools())[0].name, "item_details_tool");
  const count = requests.length;
  await client.call("item_details_tool", { ids: ["ST123"], type: "story" });
  assert.equal(requests.length, count, "A valid token must not require sign-in for each story");
  await assert.rejects(client.call("update_story_tool", { ids: ["ST123"], type: "story" }), /single read-only/);
  saved.expiresAt = 0;
  storage.set("almOAuthSession", JSON.stringify(saved));
  await Promise.all([client.listTools(), client.listTools()]);
  assert.equal(requests.filter(request => request.options?.body instanceof URLSearchParams && request.options.body.get("grant_type") === "refresh_token").length, 1);
});

test("OAuth refuses unapproved endpoint origins and invalid token responses", async () => {
  const { client } = fixture();
  await assert.rejects(client.post("https://untrusted.example/token", {}), /Unexpected/);
  await assert.rejects(client.saveTokens({}, { access_token: "fixture", token_type: "MAC", expires_in: 30 }), /invalid/);
  await assert.rejects(client.load(), /Sign In/);
});

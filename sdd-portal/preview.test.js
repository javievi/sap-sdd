"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { renderMarkdown } = require("./preview");

test("Markdown preview renders headings, tables, lists, emphasis and code without changing source", () => {
  const source = "# Spec\n\n## Control\n\n| Field | Value |\n|---|---|\n| Status | **Draft** |\n\n- Read `ZDEMO`\n- Review\n\n1. First\n2. Next\n\n> Caution\n\n```abap\nREPORT zdemo.\n```";
  const html = renderMarkdown(source);
  for (const fragment of ["<h2>Spec</h2>", "<h3>Control</h3>", "<table>", "<th>Field</th>", "<strong>Draft</strong>", "<ul>", '<ol start="1">', "<code>ZDEMO</code>", "<blockquote>Caution</blockquote>", "<pre><code>REPORT zdemo.</code></pre>"]) assert.ok(html.includes(fragment), fragment);
  assert.ok(source.includes("|---|---|"));
});

test("Markdown preview keeps raw HTML and unsafe links inert, including inside tables and fences", () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n| X | Y |\n|---|---|\n| <img src=x onerror=alert(1)> | `**literal**` |\n\n```\n<svg onload=alert(1)>\n```');
  assert.doesNotMatch(html, /<(?:script|img|svg|a)\b/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<code>\*\*literal\*\*<\/code>/);
});

test("Completion notifications last 20 seconds; errors persist and both can be dismissed", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  const source = app.slice(app.indexOf("function notify("), app.indexOf("function updateControls("));
  const notification = { hidden: true, classList: { toggle() {} } };
  const message = {};
  let dismiss, timer, cleared;
  const context = {
    notification, notificationTimer: undefined,
    document: { querySelector: id => id === "#notification-message" ? message : { addEventListener: (_event, handler) => { dismiss = handler; } } },
    clearTimeout: id => { cleared = id; },
    setTimeout: (callback, delay) => { timer = { callback, delay }; return 1; },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.notify("Saved");
  assert.equal(timer.delay, 20000);
  assert.equal(message.textContent, "Saved");
  timer.callback();
  assert.equal(notification.hidden, true);
  timer = undefined;
  context.notify("Failed", true);
  assert.equal(cleared, 1);
  assert.equal(timer, undefined);
  assert.equal(notification.hidden, false);
  dismiss();
  assert.equal(notification.hidden, true);
});

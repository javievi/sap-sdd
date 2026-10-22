"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const GUIDANCE = [
  "AGENTS.md",
  ".github/agents/sdd-architect.agent.md",
  ".github/skills/sdd-spec/SKILL.md",
  ".github/skills/sdd-spec/assets/abap-feature-template.md",
  ".github/copilot-instructions.md",
  ".github/instructions/sdd-spec.instructions.md",
  ".github/instructions/abap-team-standards.instructions.md",
];
const TEMPLATE = GUIDANCE[3];
const ARCHIVE = "\n<!-- sdd-portal-history:v1 -->\n";
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const normalize = text => text.replace(/\r\n/g, "\n");

function storyPath(id) {
  if (typeof id !== "string" || !/^ST\d{1,20}$/.test(id)) throw new Error("Invalid canonical story ID.");
  return `specs/${id}.md`;
}

// Known paths only; never enumerate the repository or follow a junction/symlink.
async function safePath(root, relative, missing = false) {
  if (path.relative(await fs.realpath(root), path.resolve(root)) !== "") throw new Error("Select a real repository path, not a link.");
  let current = root;
  for (const part of relative.split("/")) {
    if (!part || part === "." || part === ".." || /[\\:]/.test(part)) throw new Error("Unsafe local path.");
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("Linked guidance/spec paths are not permitted.");
    } catch (error) {
      if (missing && error.code === "ENOENT") continue;
      throw error;
    }
  }
  return current;
}

async function readKnown(root, relative, optional = false) {
  const file = await safePath(root, relative, optional);
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 1000000) throw new Error(`Not a bounded text file: ${relative}`);
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if (optional && error.code === "ENOENT") return null;
    throw error;
  }
}

function currentBody(text) {
  return normalize(text || "").split(ARCHIVE)[0].trimEnd();
}

function field(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*([^|\\n]+?)\\s*\\|`, "m").exec(text)?.[1].trim();
}

function section(text, title) {
  const start = text.indexOf(`## ${title}\n`);
  if (start < 0) throw new Error(`Missing canonical section: ${title}`);
  const next = text.indexOf("\n## ", start + 4);
  return text.slice(start, next < 0 ? undefined : next);
}

function nextRevision(previous) {
  if (previous === null) return "R001";
  const value = field(currentBody(previous), "Spec revision");
  if (!/^R\d{3,6}$/.test(value || "")) throw new Error("Existing spec revision is invalid; reconcile it manually first.");
  return `R${String(Number(value.slice(1)) + 1).padStart(3, "0")}`;
}

function validateCanonical(markdown, { storyId, template, previous, date }) {
  if (typeof markdown !== "string" || Buffer.byteLength(markdown) > 500000 ||
      markdown.includes("\0") || markdown.includes(ARCHIVE.trim())) throw new Error("Invalid or oversized canonical Markdown.");
  const text = normalize(markdown).trim() + "\n";
  if (!text.startsWith(`# ${storyId} - `)) throw new Error("The canonical title must use the exact story ID.");
  if (/<[^>\n]+>/.test(text)) throw new Error("Remove template placeholders and raw HTML from the specification.");
  const expected = normalize(template).split("\n").filter(line => /^## /.test(line));
  if (expected.length !== 14) throw new Error("The approved full template must contain fourteen canonical sections.");
  const actual = text.split("\n").filter(line => /^## /.test(line));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("All canonical template headings must be present, unchanged and in order.");
  for (const title of expected.map(line => line.slice(3))) {
    const body = section(text, title).split("\n").slice(1).join("\n").trim();
    if (body.length < 20) throw new Error(`Empty canonical section: ${title}`);
    const templateSection = section(normalize(template), title);
    for (const heading of templateSection.split("\n").filter(line => /^### /.test(line) && !line.includes("<"))) {
      if (!body.includes(`${heading}\n`)) throw new Error(`Missing template subheading: ${heading}`);
    }
    for (const header of templateSection.split("\n").filter(line => /^\|/.test(line) && !line.includes("<") && !/^\|[-| ]+\|$/.test(line) && !/^\| (?:Spec revision|Specification status|Development status|Implemented revision|Design approval) \|/.test(line))) {
      // Check table column contracts, not template example data or control values.
      if (/^\| (?:Field|Direction|ID|Object type|Source \/ API|Condition|Constraint|Step|Test ID|Kind \/ ID|Revision) \|/.test(header) &&
          !body.includes(header)) throw new Error(`Missing template table header in ${title}`);
    }
  }
  const revision = nextRevision(previous);
  if (field(text, "Story ID") !== storyId || field(text, "Spec revision") !== revision ||
      field(text, "Updated") !== date) throw new Error("Story, next revision, or actual date does not match.");
  if (!["Draft", "Ready"].includes(field(text, "Specification status")) ||
      !["Not started", "Blocked"].includes(field(text, "Development status")) ||
      !/^Not obtained\b/.test(field(text, "Design approval") || "")) throw new Error("Spec-only status/approval contract violated.");
  const implemented = previous ? field(currentBody(previous), "Implemented revision") : "None";
  if (!implemented || field(text, "Implemented revision") !== implemented) throw new Error("Spec-only generation cannot change the implemented revision.");
  const history = section(text, "13. Revision history");
  if (!history.split("\n").some(line => line.startsWith(`| ${revision} | ${date} |`))) throw new Error("Append the current revision/date to revision history.");
  if (previous) {
    for (const line of section(currentBody(previous), "13. Revision history").split("\n").filter(line => /^\|\s*R\d+\s*\|/.test(line))) {
      if (!history.split("\n").includes(line)) throw new Error("Existing revision history rows must be preserved verbatim.");
    }
    const ids = new Set(currentBody(previous).match(/\b(?:BR|AC|P|T)-\d{3}\b/g) || []);
    for (const id of ids) {
      if (!text.includes(id)) throw new Error(`Preserve stable ID ${id}; mark it superseded rather than removing it.`);
    }
  }
  if (!/\bBR-\d{3}\b/.test(text) || !/\bAC-\d{3}\b/.test(text) ||
      !/\bP-\d{3}\b/.test(text) || !/\bT-\d{3}\b/.test(text)) throw new Error("Missing stable BR/AC/plan/test IDs.");
  // Structural validation is not a semantic readiness or traceability proof.
  return { markdown: text, revision };
}

async function loadContext(root, storyId) {
  const relative = storyPath(storyId);
  const entries = await Promise.all(GUIDANCE.map(async file => [file, await readKnown(root, file)]));
  const files = new Map(entries);
  const previous = await readKnown(root, relative, true);
  files.set(relative, previous === null ? "No existing canonical spec." : previous);
  const agent = files.get(GUIDANCE[1]);
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(agent);
  if (!frontmatter || !/^name: sdd-architect\r?$/m.test(frontmatter[1])) throw new Error("Expected the actual sdd-architect agent definition.");
  const body = agent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  return { root, relative, files, previous, template: files.get(TEMPLATE), agentBody: body,
    revision: nextRevision(previous), date: new Date().toISOString().slice(0, 10),
    hashes: Object.fromEntries(entries.map(([file, text]) => [file, hash(text)])) };
}

function withHistory(markdown, previous) {
  if (!previous) return markdown;
  const old = normalize(previous);
  const index = old.indexOf(ARCHIVE);
  const archive = index < 0 ? "" : old.slice(index + ARCHIVE.length);
  const body = currentBody(previous);
  const fence = "`".repeat(Math.max(3, ...[...body.matchAll(/`+/g)].map(match => match[0].length + 1)));
  return `${markdown.trimEnd()}\n${ARCHIVE}${archive}\n### Preserved prior spec ${field(body, "Spec revision")}\n\n${fence}markdown\n${body}\n${fence}\n`;
}

async function persist(context, markdown, cancelled = () => false) {
  const { root, relative, previous } = context;
  const storyId = path.basename(relative, ".md");
  if (relative !== storyPath(storyId)) throw new Error("Only the exact canonical specs/ST<digits>.md path is permitted.");
  const validated = validateCanonical(markdown, { ...context, storyId });
  const document = withHistory(validated.markdown, previous);
  const target = await safePath(root, relative, true);
  if (cancelled()) throw new Error("Persistence cancelled.");
  if (await readKnown(root, relative, true) !== previous) throw new Error("Canonical spec changed during analysis. Nothing was overwritten; regenerate.");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await safePath(root, relative, true);
  // Host-only transaction file; never exposed as a path or tool to the agent.
  const temporary = `${target}.${crypto.randomUUID()}.pending`;
  try {
    await fs.writeFile(temporary, document, { encoding: "utf8", flag: "wx", mode: 0o600 });
    if (cancelled()) throw new Error("Persistence cancelled.");
    await safePath(root, relative, true);
    if (await readKnown(root, relative, true) !== previous) throw new Error("Canonical spec changed before save. Nothing was overwritten.");
    if (previous === null) {
      // Exclusive creation without replacing a concurrently created story.
      await fs.link(temporary, target);
    } else {
      await fs.rename(temporary, target);
    }
  } finally { await fs.unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
  return { markdown: document, revision: validated.revision, canonicalPath: relative, sha256: hash(document) };
}

module.exports = { GUIDANCE, TEMPLATE, storyPath, readKnown, loadContext, validateCanonical, persist, field, withHistory, hash };

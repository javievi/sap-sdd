"use strict";

const form = document.querySelector("#story-form");
const storyField = document.querySelector("#story-id");
const namesField = document.querySelector("#object-names");
const requirement = document.querySelector("#requirement");
const content = document.querySelector("#document-content");
const emptyState = document.querySelector("#empty-state");
const generateButton = document.querySelector("#generate-button");
const copyButton = document.querySelector("#copy-button");
const downloadButton = document.querySelector("#download-button");
const progressPanel = document.querySelector("#progress-panel");
const state = document.querySelector("#document-state");
const notification = document.querySelector("#notification");
const storyStatus = document.querySelector("#story-status");
let currentDocument = null;
let generationController = null;
let storyController = null;
let notificationTimer;
let storyTimer;
let lookupVersion = 0;
let loadedStoryId = "";
let integrationsReady = false;
let storyBusy = false;
let formRevision = 0;
let statusVersion = 0;

function notify(message, isError = false) {
  clearTimeout(notificationTimer);
  notification.textContent = message;
  notification.classList.toggle("error", isError);
  notification.hidden = false;
  notificationTimer = setTimeout(() => { notification.hidden = true; }, 6500);
}

function updateControls() {
  generateButton.disabled = !integrationsReady || storyBusy || Boolean(generationController);
  copyButton.disabled = !currentDocument || Boolean(generationController);
  downloadButton.disabled = copyButton.disabled;
}

function updateCharacterCount() {
  document.querySelector("#character-count").textContent = `${requirement.value.length.toLocaleString("en-US")} / 12,000`;
}

function authHeaders() {
  if (!window.sddSession?.token) throw new Error("Open this portal using 'SDD Studio: Open Live Portal' in VS Code, not index.html.");
  return { "Content-Type": "application/json", "X-SDD-Token": window.sddSession.token };
}

async function api(route, body, signal) {
  const response = await fetch(route, { method: body ? "POST" : "GET", headers: authHeaders(), body: body ? JSON.stringify(body) : undefined, signal });
  let data;
  try { data = await response.json(); } catch { throw new Error("The VS Code bridge returned an invalid response. Reopen the portal."); }
  if (!response.ok) throw new Error(data.error || `Bridge request failed (${response.status}).`);
  return data;
}

async function refreshStatus() {
  const version = ++statusVersion;
  const message = document.querySelector("#connection-message");
  document.querySelector("#refresh-status").disabled = true;
  integrationsReady = false;
  updateControls();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const result = await api("/api/status", undefined, controller.signal);
    if (version !== statusVersion) return;
    for (const key of ["copilot", "alm", "sap"]) {
      const badge = document.querySelector(`#${key}-status`);
      badge.textContent = result[key].label;
      badge.parentElement.classList.toggle("connected", result[key].available);
    }
    integrationsReady = result.copilot.available && result.alm.available && result.sap.available;
    message.classList.toggle("error", !integrationsReady);
    document.querySelector("#mode-label").textContent = integrationsReady ? "RUNTIME READY · SPEC ONLY" : "CONNECTION REQUIRED";
    const errors = ["alm", "sap"].filter(key => result[key].error).map(key => `${key.toUpperCase()}: ${result[key].error}`).join(" ");
    message.textContent = integrationsReady ? "Bridge ready. ALM access is verified when you load a story; SAP reads use OUC." : `${errors} Complete the missing connections in VS Code, then refresh status.`;
  } catch (error) {
    if (version !== statusVersion) return;
    for (const key of ["copilot", "alm", "sap"]) document.querySelector(`#${key}-status`).textContent = "Unavailable";
    document.querySelector("#mode-label").textContent = "BRIDGE OFFLINE";
    message.textContent = error.name === "AbortError" ? "Connection check timed out. Check OUC and tool approvals in VS Code, then refresh." : error.message;
    message.classList.add("error");
    console.error("Connection check failed:", error);
  } finally {
    clearTimeout(timeout);
    if (version === statusVersion) {
      document.querySelector("#refresh-status").disabled = false;
      updateControls();
    }
  }
}

function plainText(html) {
  const parsed = new DOMParser().parseFromString(html || "", "text/html");
  parsed.querySelectorAll("script,style,iframe,object").forEach(node => node.remove());
  parsed.querySelectorAll("br").forEach(node => node.replaceWith("\n"));
  parsed.querySelectorAll("p,div,li,h1,h2,h3,tr").forEach(node => node.append("\n"));
  return (parsed.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

async function lookupStory() {
  clearTimeout(storyTimer);
  const id = storyField.value.trim().toUpperCase();
  if (!/^ST\d{1,20}$/.test(id) || generationController) return;
  const version = ++lookupVersion;
  storyController?.abort();
  const controller = new AbortController();
  storyController = controller;
  const timeout = setTimeout(() => controller.abort(), 90000);
  const originalObjects = namesField.value;
  const originalRequirement = requirement.value;
  storyBusy = true;
  updateControls();
  storyStatus.textContent = `Loading ${id} from ALM… Check VS Code for tool approvals.`;
  document.querySelector("#retry-story").hidden = true;
  try {
    const story = await api("/api/story", { storyId: id }, controller.signal);
    if (version !== lookupVersion || storyField.value.trim().toUpperCase() !== id) return;
    const text = [story.title, plainText(story.description), story.notes ? `Story notes:\n${plainText(story.notes)}` : ""].filter(Boolean).join("\n\n");
    if (text.length > 12000 || story.objects.join("\n").length > 1000) throw new Error("Story text exceeds the editable form limit. No data was truncated or replaced; refine it manually from ALM.");
    let preserved = false;
    if (namesField.value === originalObjects) namesField.value = story.objects.join("\n");
    else preserved = true;
    if (requirement.value === originalRequirement) requirement.value = text;
    else preserved = true;
    loadedStoryId = id;
    namesField.setCustomValidity("");
    requirement.setCustomValidity("");
    updateCharacterCount();
    storyStatus.textContent = `${id}: ${story.title}. ${preserved ? "Your edits made during lookup were preserved. " : ""}${story.objects.length ? "Candidate objects extracted; verify and edit them." : "No candidate objects found; add them manually."} Nothing has been generated.`;
  } catch (error) {
    if (version !== lookupVersion) return;
    storyStatus.textContent = error.name === "AbortError" ? "Story lookup timed out or was cancelled. Your inputs were kept; retry when ready." : `Story lookup failed: ${error.message} Your inputs were kept.`;
    document.querySelector("#retry-story").hidden = false;
    if (error.name !== "AbortError") console.error("Story lookup failed:", error);
  } finally {
    clearTimeout(timeout);
    if (version === lookupVersion) { storyBusy = false; storyController = null; updateControls(); }
  }
}

storyField.addEventListener("input", () => {
  clearTimeout(storyTimer);
  ++lookupVersion;
  storyController?.abort();
  storyController = null;
  storyBusy = false;
  loadedStoryId = "";
  storyStatus.textContent = "Enter a complete story ID. Existing fields stay editable until the new story loads.";
  document.querySelector("#retry-story").hidden = true;
  updateControls();
  if (/^ST\d{1,20}$/i.test(storyField.value.trim())) {
    storyBusy = true;
    updateControls();
    storyTimer = setTimeout(lookupStory, 800);
  }
});
document.querySelector("#retry-story").addEventListener("click", lookupStory);
document.querySelector("#refresh-status").addEventListener("click", refreshStatus);
form.addEventListener("input", () => {
  ++formRevision;
  if (currentDocument && !generationController) {
    state.textContent = "Inputs changed";
    document.querySelector("#preview-footer-text").textContent = "Previous draft · regenerate to include edits";
  }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function makeMarkdown(doc) {
  if (typeof doc.markdown !== "string" || !doc.invocation?.verified || !doc.canonicalPath) {
    throw new Error("No saved canonical specification with verified named-agent provenance was returned.");
  }
  return doc.markdown;
}

function renderDocument(doc) {
  const [current, history] = doc.markdown.split("\n<!-- sdd-portal-history:v1 -->\n");
  // Escaped canonical Markdown, grouped by the actual full-template sections.
  // Never insert model HTML, render scripts, or silently substitute a summary.
  content.innerHTML = `<div class="doc-kicker">CANONICAL SPECIFICATION · NAMED ARCHITECT</div><h3>${escapeHtml(doc.canonicalPath)} / ${escapeHtml(doc.revision)}</h3><div class="doc-meta">OUC · ${escapeHtml(doc.model)} · SDK ${escapeHtml(doc.invocation.sdkVersion)}</div><div class="doc-warning"><strong>Spec save approved; not implementation approval.</strong> Template structure checked, semantic readiness requires human review. No code changes or test execution.</div>` +
    current.split(/(?=^## )/m).map(part => {
      const [heading, ...lines] = part.split("\n");
      return `<section><h4>${escapeHtml(heading.replace(/^#+ /, ""))}</h4><pre class="canonical-markdown">${escapeHtml(lines.join("\n"))}</pre></section>`;
    }).join("") +
    (history ? `<details><summary>Preserved prior revisions and evidence</summary><pre class="canonical-markdown">${escapeHtml(history)}</pre></details>` : "") +
    `<details class="doc-end"><summary>Runtime evidence and analysis limits</summary><p>Agent ${escapeHtml(doc.invocation.agent)}; session ${escapeHtml(doc.invocation.sessionId)}; SHA-256 ${escapeHtml(doc.sha256)}</p><ul>${[...doc.evidence, ...doc.limitations].map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>`;
}

function setBusy(busy) {
  Array.from(form.elements).forEach(element => { element.disabled = busy; });
  document.querySelector("#generate-label").textContent = busy ? "Analyzing story and OUC source…" : "Generate SDD";
  progressPanel.hidden = !busy;
  content.setAttribute("aria-busy", String(busy));
  updateControls();
}

async function readEvents(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
      if (pending.length > 4000000) throw new Error("Bridge event exceeded the size limit.");
      if (done) break;
    }
    if (pending.trim()) onEvent(JSON.parse(pending));
  } finally { reader.releaseLock(); }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (generationController || storyBusy || !integrationsReady) return;
  namesField.setCustomValidity("");
  requirement.setCustomValidity("");
  const objects = [...new Set(namesField.value.split(/[,\r\n]+/).map(name => name.trim().toUpperCase()).filter(Boolean))];
  if (!objects.length || objects.length > 20 || objects.some(name => !/^[A-Z0-9_/=$%\-]{1,40}$/.test(name))) namesField.setCustomValidity("Enter 1–20 valid ABAP object names, separated by commas or new lines.");
  if (requirement.value.trim().length < 20) requirement.setCustomValidity("Enter at least 20 non-padding characters.");
  if (!form.reportValidity()) return;
  const input = { storyId: storyField.value.trim().toUpperCase(), objects, requirement: requirement.value.trim(), target: "OUC" };
  if (loadedStoryId && loadedStoryId !== input.storyId) { notify("Load the current story before generation.", true); return; }
  const revision = formRevision;
  generationController = new AbortController();
  const timeout = setTimeout(() => generationController?.abort(), 605000);
  setBusy(true);
  state.textContent = "Analyzing";
  document.querySelector("#progress-label").textContent = "Starting live analysis…";
  let result;
  try {
    const response = await fetch("/api/generate", { method: "POST", headers: authHeaders(), body: JSON.stringify(input), signal: generationController.signal });
    if (!response.ok) { const error = await response.json(); throw new Error(error.error || `Generation failed (${response.status}).`); }
    await readEvents(response, event => {
      if (event.type === "progress") document.querySelector("#progress-label").textContent = event.message;
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "result") result = event.document;
    });
    if (!result) throw new Error("The bridge closed without a complete SDD. No new document was published.");
    if (revision !== formRevision) throw new Error("Inputs changed during analysis. Regenerate to use the current scope.");
    result.markdown = makeMarkdown(result);
    renderDocument(result);
    currentDocument = result;
    content.hidden = false;
    content.scrollTop = 0;
    emptyState.hidden = true;
    document.querySelector("#document-name").textContent = result.canonicalPath;
    document.querySelector("#preview-footer-text").textContent = `Canonical ${result.revision} saved · named-agent invocation verified`;
    state.textContent = "Spec saved";
    state.classList.add("ready");
    notify("SDD generated from ALM and OUC evidence. Review before sharing.");
  } catch (error) {
    state.textContent = currentDocument ? "Previous draft" : "Not generated";
    const message = error.name === "AbortError" ? "Generation cancelled or timed out. Any previous draft was retained." : error.message;
    notify(message, true);
    document.querySelector("#preview-footer-text").textContent = message;
    console.error("SDD generation stopped:", error);
  } finally {
    clearTimeout(timeout);
    generationController = null;
    setBusy(false);
  }
});

document.querySelector("#cancel-button").addEventListener("click", () => generationController?.abort());
requirement.addEventListener("input", () => { requirement.setCustomValidity(""); updateCharacterCount(); });
namesField.addEventListener("input", () => namesField.setCustomValidity(""));
copyButton.addEventListener("click", async () => {
  if (!currentDocument) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable.");
    await navigator.clipboard.writeText(currentDocument.markdown);
    notify("Specification copied as Markdown.");
  } catch (error) {
    console.warn("Clipboard copy unavailable:", error);
    const field = document.querySelector("#copy-fallback");
    field.value = currentDocument.markdown;
    document.querySelector("#copy-dialog").showModal();
    field.focus();
    field.select();
  }
});
downloadButton.addEventListener("click", () => {
  if (!currentDocument) return;
  const url = URL.createObjectURL(new Blob([currentDocument.markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentDocument.storyId}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Markdown download requested.");
});
updateCharacterCount();
void refreshStatus();

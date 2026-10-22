"use strict";

const TITLES = ["Technical Overview", "Business Objective", "Impact Analysis", "Data Flow Diagram", "Test Scenarios & Acceptance Criteria", "Risks & Assumptions"];
const ALLOWED = new Set(["item_details_tool", "abapfs_get_connected_systems", "abapfs_search_objects", "abapfs_get_object_source", "abapfs_analyze_object_relations"]);

function validateInput(input, storyOnly = false) {
  if (!input || typeof input !== "object" || typeof input.storyId !== "string" || !/^ST\d{1,20}$/i.test(input.storyId)) throw new Error("Enter a valid story ID: ST followed by up to 20 digits.");
  const result = { storyId: input.storyId.toUpperCase() };
  if (storyOnly) return result;
  if (input.target !== "OUC") throw new Error("Only the explicitly approved OUC connection is enabled.");
  if (!Array.isArray(input.objects) || !input.objects.length || input.objects.length > 20 ||
      input.objects.some(name => typeof name !== "string" || !/^[A-Z0-9_/=$%\-]{1,40}$/i.test(name))) throw new Error("Supply 1–20 valid ABAP object names, at most 40 characters each.");
  if (typeof input.requirement !== "string" || input.requirement.trim().length < 20 || input.requirement.length > 12000) throw new Error("The requirement must contain 20–12,000 characters.");
  return { ...result, objects: [...new Set(input.objects.map(name => name.toUpperCase()))], requirement: input.requirement.trim(), target: "OUC" };
}

function decodeResult(result) {
  if (result.isError) throw new Error("The connected tool returned an error. Check its status in VS Code.");
  const parts = (result.content || []).filter(part => typeof part.value === "string").map(part => part.value);
  if (!parts.length) throw new Error("The tool returned no readable text.");
  const text = parts.join("\n");
  let data;
  try { data = JSON.parse(text); } catch { return { text }; }
  for (let index = 0; index < 3 && typeof data === "string"; index++) {
    try { data = JSON.parse(data); } catch { break; }
  }
  if (data?.status_code >= 400) throw new Error(`The connected service returned HTTP ${data.status_code}.`);
  if (data && typeof data === "object" && data.body !== undefined) {
    if (typeof data.body === "string") {
      try { data = JSON.parse(data.body); } catch { throw new Error("The connected service returned an invalid JSON body."); }
    } else data = data.body;
  }
  if (data && typeof data === "object" && (data.isError || data.success === false || data.status === "error" || data.error || data.ERROR)) {
    throw new Error("The connected service reported a failure. Check the MCP tool in VS Code.");
  }
  return { text, data };
}

function resolveObject(result, name) {
  const types = [];
  function collect(value, depth = 0) {
    if (!value || depth > 10 || typeof value !== "object") return;
    const candidate = value.name || value.objectName || value.OBJECT_NAME || value.NAME;
    if (String(candidate).toUpperCase() === name) {
      const type = String(value.type || value.objectType || value.OBJECT_TYPE || "").toUpperCase();
      if (/^(CLAS|PROG)(\/[A-Z0-9]+)?$/.test(type)) types.push(type);
    }
    Object.values(value).forEach(child => collect(child, depth + 1));
  }
  collect(result.data);
  for (const match of result.text.matchAll(/^[•*-]\s+(\S+)\s+\(((?:CLAS|PROG)(?:\/[A-Z0-9]+)?)\)\s*$/gim)) {
    if (match[1].toUpperCase() === name) types.push(match[2].toUpperCase());
  }
  const unique = [...new Set(types)];
  if (unique.length !== 1) throw new Error(`Cannot uniquely confirm ${name} as a program or class in OUC. Correct the object list; no type was guessed.`);
  return { type: unique[0].split("/")[0], relationType: unique[0].includes("/") ? unique[0] : unique[0] === "CLAS" ? "CLAS/OC" : "PROG/P" };
}

function findStory(value, id, depth = 0) {
  if (depth > 10 || !value || typeof value !== "object") return undefined;
  if (!Array.isArray(value)) {
    const returnedId = value.DISPLAY_ID || value.displayId || value.display_id;
    if (String(returnedId).toUpperCase() === id && (value.STORY_NAME || value.STORY_DESC || value.STORY_DESCRIPTION)) return value;
  }
  for (const child of Object.values(value)) {
    const match = findStory(child, id, depth + 1);
    if (match) return match;
  }
}

function extractStory(result, id) {
  const story = findStory(result.data, id);
  if (!story) throw new Error(`ALM did not return a structured story matching ${id}. No form fields were replaced.`);
  const description = String(story.STORY_DESCRIPTION || story.STORY_DESC || "");
  const notes = String(story.STORY_NOTES || "");
  const title = String(story.STORY_NAME || "");
  const objects = [...new Set(`${title} ${description} ${notes}`.match(/(?:\/[A-Z0-9_]+\/[A-Z][A-Z0-9_]{2,29}|\b[ZY][A-Z0-9_]{3,39}\b)/g) || [])].slice(0, 20);
  return { storyId: id, title, description, notes, objects, objectEvidence: "Candidate identifiers extracted from ALM text; verify against SAP.", raw: result.text };
}

function validateDocument(raw) {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("The model returned invalid structured output. No document was published; retry generation."); }
  const strings = (value, max = 50) => Array.isArray(value) && value.length <= max && value.every(item => typeof item === "string" && item.length <= 16000);
  if (!Array.isArray(data.sections) || data.sections.length !== TITLES.length) throw new Error("The model response must contain all six SDD sections.");
  for (let index = 0; index < TITLES.length; index++) {
    const section = data.sections[index];
    if (!section || section.title !== TITLES[index] || !strings(section.paragraphs) || !strings(section.bullets) ||
        ![...section.paragraphs, ...section.bullets].some(value => value.trim())) throw new Error(`Invalid or empty model section: ${TITLES[index]}.`);
    if (section.table && (!strings(section.table.headers, 8) || !section.table.headers.length ||
        !Array.isArray(section.table.rows) || section.table.rows.length > 60 ||
        !section.table.rows.every(row => strings(row, 8) && row.length === section.table.headers.length))) throw new Error("The model returned an invalid table.");
  }
  const graph = data.diagram;
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length < 2 || graph.nodes.length > 10 ||
      !Array.isArray(graph.edges) || !graph.edges.length || graph.edges.length > 20) throw new Error("The model returned an invalid data-flow graph.");
  const ids = new Set();
  for (const node of graph.nodes) {
    if (!node || typeof node.id !== "string" || !/^[A-Z][A-Z0-9_]{0,15}$/.test(node.id) || ids.has(node.id) ||
        typeof node.label !== "string" || !node.label.trim() || node.label.length > 100) throw new Error("Invalid data-flow node.");
    ids.add(node.id);
  }
  if (graph.edges.some(edge => !edge || !ids.has(edge.from) || !ids.has(edge.to))) throw new Error("Invalid data-flow relationship.");
  return { sections: data.sections, diagram: graph };
}

module.exports = { ALLOWED, TITLES, validateInput, decodeResult, extractStory, resolveObject, validateDocument };

"use strict";

function renderMarkdown(markdown) {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function inline(text) {
    return text.split(/(`+[^`]+`+)/g).map(part => {
      if (/^`+[^`]+`+$/.test(part)) return `<code>${escape(part.replace(/^`+|`+$/g, ""))}</code>`;
      return escape(part).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
    }).join("");
  }
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const cells = line => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, "|"));
  const tableRule = line => line && line.includes("|") && cells(line).every(cell => /^:?-{3,}:?$/.test(cell));
  const block = index => /^(?:#{1,6}\s|[ \t]*[-*+]\s|[ \t]*\d+[.)]\s|`{3,}|~{3,}|>\s?)/.test(lines[index]) || tableRule(lines[index + 1]);
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !new RegExp(`^${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      html.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (tableRule(lines[i + 1])) {
      const headers = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(`<tr>${cells(lines[i++]).map(cell => `<td>${inline(cell)}</td>`).join("")}</tr>`);
      }
      html.push(`<div class="markdown-table"><table><thead><tr>${headers.map(cell => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`);
      continue;
    }
    const list = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/.exec(line);
    if (list) {
      const ordered = /^\d/.test(list[2]);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (i < lines.length) {
        const item = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/.exec(lines[i]);
        if (!item || /^\d/.test(item[2]) !== ordered) break;
        items.push(`<li>${inline(item[3])}</li>`);
        i++;
      }
      html.push(`<${tag}${ordered ? ` start="${parseInt(list[2], 10)}"` : ""}>${items.join("")}</${tag}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      html.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { html.push("<hr>"); i++; continue; }
    const paragraph = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !block(i)) paragraph.push(lines[i++]);
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  return html.join("\n");
}

if (typeof module !== "undefined") module.exports = { renderMarkdown };

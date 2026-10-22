"use strict";

const STORY_TOOL = "item_details_tool";

function registeredStoryTools(vscode) {
  return vscode.lm.tools.filter(tool => tool.name === STORY_TOOL || tool.name.endsWith(`_${STORY_TOOL}`) || tool.name.endsWith(`-${STORY_TOOL}`));
}

class VsCodeAlmClient {
  constructor(vscode, name) {
    this.vscode = vscode;
    this.name = name;
    this.label = "VS Code MCP registered";
    this.transport = "vscode";
  }

  async listTools() {
    const tool = registeredStoryTools(this.vscode).find(item => item.name === this.name);
    if (!tool) throw new Error("The selected ALM tool is not currently registered in VS Code. Start the ALM MCP server, then refresh status or run SDD Studio: Configure MCP Connections.");
    return [tool];
  }

  async call(name, input, token) {
    if (name !== this.name || !Array.isArray(input?.ids) || input.ids.length !== 1 ||
        typeof input.ids[0] !== "string" || !/^ST\d{1,20}$/.test(input.ids[0]) || input.type !== "story" ||
        Object.keys(input).some(key => !["ids", "type"].includes(key))) {
      throw new Error("The VS Code ALM connection permits only a single read-only story-details request.");
    }
    await this.listTools();
    return this.vscode.lm.invokeTool(name, { input, toolInvocationToken: undefined }, token);
  }
}

module.exports = { registeredStoryTools, VsCodeAlmClient };

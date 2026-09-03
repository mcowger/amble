import { describe, expect, test } from "bun:test";
import {
  isSubagentToolCall,
  getSubagentDetails,
  getToolDisplayInfo,
  getFileExtension,
  getActionTargetText,
  normalizeSubagentAction,
  parseTaskMetadataBlock,
  parseActionLinesFromLog,
  extractEmbeddedActions,
  cleanSubagentOutput,
  resolveAndDeduplicateActions,
} from "./subagent-helpers";
import type { ToolCallTimelineItem } from "./paseo/types";

describe("subagent-helpers", () => {
  describe("isSubagentToolCall", () => {
    test("detects tool named task", () => {
      const item: ToolCallTimelineItem = {
        type: "tool_call",
        callId: "call_1",
        name: "task",
        status: "running",
      };
      expect(isSubagentToolCall(item)).toBe(true);
    });

    test("detects detail.type === sub_agent", () => {
      const item: ToolCallTimelineItem = {
        type: "tool_call",
        callId: "call_2",
        name: "custom_agent",
        detail: { type: "sub_agent", description: "find files" },
        status: "completed",
      };
      expect(isSubagentToolCall(item)).toBe(true);
    });

    test("detects subagent_type input", () => {
      const item: ToolCallTimelineItem = {
        type: "tool_call",
        callId: "call_3",
        name: "agent",
        input: { subagent_type: "explore", prompt: "explore something" },
        status: "running",
      };
      expect(isSubagentToolCall(item)).toBe(true);
    });

    test("returns false for regular tools", () => {
      const item: ToolCallTimelineItem = {
        type: "tool_call",
        callId: "call_4",
        name: "bash",
        status: "completed",
      };
      expect(isSubagentToolCall(item)).toBe(false);
    });
  });

  describe("getToolDisplayInfo", () => {
    test("maps grep/glob/search to Search Files", () => {
      expect(getToolDisplayInfo("grep").displayName).toBe("Search Files");
      expect(getToolDisplayInfo("glob").displayName).toBe("Search Files");
      expect(getToolDisplayInfo("search").displayName).toBe("Search Files");
      expect(getToolDisplayInfo("grep").category).toBe("search");
    });

    test("maps read to Read File", () => {
      expect(getToolDisplayInfo("read").displayName).toBe("Read File");
      expect(getToolDisplayInfo("read_file").displayName).toBe("Read File");
      expect(getToolDisplayInfo("read").category).toBe("read");
    });

    test("maps edit/write to Edit File", () => {
      expect(getToolDisplayInfo("edit").displayName).toBe("Edit File");
      expect(getToolDisplayInfo("write").displayName).toBe("Edit File");
      expect(getToolDisplayInfo("apply_patch").displayName).toBe("Edit File");
      expect(getToolDisplayInfo("edit").category).toBe("edit");
    });

    test("maps bash to Run Command", () => {
      expect(getToolDisplayInfo("bash").displayName).toBe("Run Command");
      expect(getToolDisplayInfo("shell").displayName).toBe("Run Command");
      expect(getToolDisplayInfo("terminal").displayName).toBe("Run Command");
      expect(getToolDisplayInfo("bash").category).toBe("terminal");
    });

    test("maps task to Agent Task", () => {
      expect(getToolDisplayInfo("task").displayName).toBe("Agent Task");
      expect(getToolDisplayInfo("task").category).toBe("subagent");
    });
  });

  describe("getFileExtension", () => {
    test("extracts extension in uppercase", () => {
      expect(getFileExtension("foo/bar/file.ts")).toBe("TS");
      expect(getFileExtension("../packages/server/wire-compat.test.ts")).toBe("TS");
      expect(getFileExtension("src/App.tsx")).toBe("TSX");
      expect(getFileExtension("package.json")).toBe("JSON");
      expect(getFileExtension("style.css")).toBe("CSS");
    });

    test("handles queries, hashes and missing extensions", () => {
      expect(getFileExtension("foo/bar.js?query=1")).toBe("JS");
      expect(getFileExtension("no_extension")).toBe(null);
      expect(getFileExtension(undefined)).toBe(null);
    });
  });

  describe("getActionTargetText", () => {
    test("returns formatted relative path if filePath present", () => {
      const cwd = "/workspace";
      expect(
        getActionTargetText(
          { tool: "read", filePath: "/workspace/src/main.ts" },
          cwd,
        ),
      ).toBe("src/main.ts");
    });

    test("returns query if query present", () => {
      expect(
        getActionTargetText({ tool: "grep", query: "thinking_delta|reasoning" }),
      ).toBe("thinking_delta|reasoning");
    });

    test("returns command if command present", () => {
      expect(
        getActionTargetText({ tool: "bash", command: "npm test" }),
      ).toBe("npm test");
    });
  });

  describe("extractEmbeddedActions", () => {
    test("extracts actions from detail.actions", () => {
      const item: ToolCallTimelineItem = {
        type: "tool_call",
        callId: "call_sub",
        name: "task",
        status: "completed",
        detail: {
          type: "sub_agent",
          description: "Inspect thinking",
          actions: [
            { index: 1, toolName: "grep", summary: "search thinking pattern" },
            { index: 2, toolName: "read", summary: "src/server/agent.ts" },
          ],
        },
      };

      const actions = extractEmbeddedActions(item);
      expect(actions.length).toBe(2);
      expect(actions[0]?.tool).toBe("grep");
      expect(actions[0]?.summary).toBe("search thinking pattern");
      expect(actions[1]?.tool).toBe("read");
    });

    test("extracts actions from metadata summary/entries", () => {
      const item: ToolCallTimelineItem = {
        type: "tool_call",
        callId: "call_sub_2",
        name: "task",
        status: "completed",
        metadata: {
          summary: [
            { tool: "read", state: { title: "src/index.ts", status: "completed" } },
          ],
        },
      };

      const actions = extractEmbeddedActions(item);
      expect(actions.length).toBe(1);
      expect(actions[0]?.tool).toBe("read");
      expect(actions[0]?.title).toBe("src/index.ts");
    });

    test("extracts actions from <task_metadata> block in output", () => {
      const output = `Found results
<task_metadata>
{
  "sessionId": "ses_123",
  "summary": [
    { "tool": "grep", "query": "thoughtSignature" },
    { "tool": "read", "filePath": "src/types.ts" }
  ]
}
</task_metadata>`;

      const item: ToolCallTimelineItem = {
        type: "tool_call",
        callId: "call_sub_3",
        name: "task",
        status: "completed",
        output,
      };

      const actions = extractEmbeddedActions(item);
      expect(actions.length).toBe(2);
      expect(actions[0]?.tool).toBe("grep");
      expect(actions[0]?.query).toBe("thoughtSignature");
      expect(actions[1]?.tool).toBe("read");
      expect(actions[1]?.filePath).toBe("src/types.ts");
    });
  });

  describe("cleanSubagentOutput", () => {
    test("parses <task_result>...</task_result> inside <task> tag", () => {
      const raw = `<task id="ses_f9abc97c7ffeAVv9jUeLid15MX" state="completed">
<task_result>
Found 1 AGENTS.md file:
• AGENTS.md
</task_result>
</task>`;
      expect(cleanSubagentOutput(raw)).toBe(
        "Found 1 AGENTS.md file:\n• AGENTS.md",
      );
    });

    test("strips <task> tag when no <task_result>", () => {
      const raw = `<task id="ses_2268db431ffe299vL1bbot8R7Z">done finding files</task>`;
      expect(cleanSubagentOutput(raw)).toBe("done finding files");
    });

    test("strips <task_metadata>...</task_metadata> block", () => {
      const raw = `Found 1 AGENTS.md file:
• AGENTS.md
<task_metadata>
{"summary": [{"tool": "glob", "pattern": "**/AGENTS.md"}]}
</task_metadata>`;
      expect(cleanSubagentOutput(raw)).toBe(
        "Found 1 AGENTS.md file:\n• AGENTS.md",
      );
    });

    test("parses JSON object with result or output key", () => {
      const jsonStr = JSON.stringify({
        result: "Found 1 AGENTS.md file:\n• AGENTS.md",
        sessionId: "ses_123",
      });
      expect(cleanSubagentOutput(jsonStr)).toBe(
        "Found 1 AGENTS.md file:\n• AGENTS.md",
      );

      const obj = { result: "Direct object result" };
      expect(cleanSubagentOutput(obj)).toBe("Direct object result");
    });

    test("passes plain markdown or text through cleanly", () => {
      const text = "# Summary\nFound 1 AGENTS.md file";
      expect(cleanSubagentOutput(text)).toBe(text);
    });

    test("handles undefined and empty string gracefully", () => {
      expect(cleanSubagentOutput(undefined)).toBe("");
      expect(cleanSubagentOutput(null)).toBe("");
      expect(cleanSubagentOutput("")).toBe("");
    });
  });

  describe("resolveAndDeduplicateActions", () => {
    test("deduplicates streaming delta tool calls with empty target followed by actual target", () => {
      const raw = [
        { tool: "glob", status: "running" as const },
        { tool: "glob", query: "**/AGENTS.md", status: "running" as const },
        { tool: "glob", query: "**/AGENTS.md", status: "completed" as const },
      ];

      const resolved = resolveAndDeduplicateActions(raw, undefined, true);
      expect(resolved.length).toBe(1);
      expect(resolved[0]?.tool).toBe("glob");
      expect(resolved[0]?.query).toBe("**/AGENTS.md");
      expect(resolved[0]?.status).toBe("completed");
    });

    test("forces all running actions to completed when subagent is completed", () => {
      const raw = [
        { tool: "read", filePath: "src/index.ts", status: "running" as const },
      ];

      const resolved = resolveAndDeduplicateActions(raw, undefined, true);
      expect(resolved[0]?.status).toBe("completed");
    });

    test("keeps running status when subagent is still active", () => {
      const raw = [
        { tool: "read", filePath: "src/index.ts", status: "running" as const },
      ];

      const resolved = resolveAndDeduplicateActions(raw, undefined, false);
      expect(resolved[0]?.status).toBe("running");
    });

    test("preserves distinct tool calls", () => {
      const raw = [
        { tool: "glob", query: "**/AGENTS.md", status: "completed" as const },
        { tool: "read", filePath: "AGENTS.md", status: "completed" as const },
      ];

      const resolved = resolveAndDeduplicateActions(raw, undefined, true);
      expect(resolved.length).toBe(2);
      expect(resolved[0]?.tool).toBe("glob");
      expect(resolved[1]?.tool).toBe("read");
    });
  });
});

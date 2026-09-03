import React, { useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { PaseoProvider } from "./context/PaseoContext";
import { WorkspaceProvider, useWorkspace } from "./context/WorkspaceContext";
import { AppShell } from "./components/layout/AppShell";
import { WorkspaceTabsRow } from "./components/layout/WorkspaceTabsRow";
import { ChatTimeline } from "./components/chat/ChatTimeline";
import { TerminalView } from "./components/terminal/TerminalView";
import { ChangesDrawer } from "./components/drawers/ChangesDrawer";
import { PromptComposer } from "./components/composer/PromptComposer";
import { BottomDrawer } from "./components/drawers/BottomDrawer";
import { TooltipProvider } from "./components/ui/tooltip";
import "./index.css";

function WorkspaceMain() {
  const [composerPrompt, setComposerPrompt] = useState("");
  const { activeTab, workspaceTabs } = useWorkspace();

  const handleSelectPrompt = (prompt: string) => {
    setComposerPrompt(prompt);
  };

  const isChangesActive = activeTab?.kind === "changes";
  const isAgentActive = !activeTab || activeTab.kind === "agent";
  const terminalTabs = workspaceTabs.filter((t) => t.kind === "terminal");
  const isFallbackTerminal =
    activeTab?.kind === "terminal" && !terminalTabs.some((t) => t.targetId === activeTab.targetId);

  return (
    <AppShell drawer={<BottomDrawer />}>
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Workspace Tabs Row */}
        <WorkspaceTabsRow />

        {/* Tab Content */}
        {/* Terminals: keep open terminal tabs mounted so background output, scrollback, and state persist across tab switching */}
        {terminalTabs.map((tab) => {
          const isActive =
            activeTab?.kind === "terminal" && activeTab?.targetId === tab.targetId;
          return (
            <div
              key={tab.id}
              className={
                isActive
                  ? "flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col"
                  : "hidden"
              }
            >
              <TerminalView
                slot={tab.slot ?? 0}
                terminalId={tab.targetId}
                isActive={isActive}
              />
            </div>
          );
        })}

        {/* Fallback for in-flight terminal creation */}
        {isFallbackTerminal && activeTab && (
          <div className="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col">
            <TerminalView
              slot={activeTab.slot ?? 0}
              terminalId={activeTab.targetId}
              isActive={true}
            />
          </div>
        )}

        {/* Changes Tab */}
        <div
          className={
            isChangesActive
              ? "flex-1 h-full min-h-0 overflow-hidden flex flex-col"
              : "hidden"
          }
        >
          {isChangesActive && <ChangesDrawer />}
        </div>

        {/* Agent Tab Content (Chat Timeline + Prompt Composer) */}
        <div
          className={
            isAgentActive
              ? "flex-1 flex flex-col min-h-0 overflow-hidden"
              : "hidden"
          }
        >
          <ChatTimeline onSelectPrompt={handleSelectPrompt} />
          <PromptComposer initialValue={composerPrompt} />
        </div>
      </div>
    </AppShell>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <PaseoProvider>
        <WorkspaceProvider>
          <TooltipProvider delayDuration={150}>
            <WorkspaceMain />
          </TooltipProvider>
        </WorkspaceProvider>
      </PaseoProvider>
    </ThemeProvider>
  );
}

export default App;

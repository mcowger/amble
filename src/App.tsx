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
  const { activeTab } = useWorkspace();

  const handleSelectPrompt = (prompt: string) => {
    setComposerPrompt(prompt);
  };

  return (
    <AppShell drawer={<BottomDrawer />}>
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Workspace Tabs Row */}
        <WorkspaceTabsRow />

        {/* Tab Content */}
        {activeTab?.kind === "terminal" ? (
          <TerminalView
            key={activeTab.id}
            slot={activeTab.slot ?? 0}
            terminalId={activeTab.targetId}
          />
        ) : activeTab?.kind === "changes" ? (
          <div className="flex-1 h-full min-h-0 overflow-hidden">
            <ChangesDrawer />
          </div>
        ) : (
          <>
            {/* Chat Timeline */}
            <ChatTimeline onSelectPrompt={handleSelectPrompt} />

            {/* Prompt Composer */}
            <PromptComposer initialValue={composerPrompt} />
          </>
        )}
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

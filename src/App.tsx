import React, { useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { PaseoProvider } from "./context/PaseoContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { AppShell } from "./components/layout/AppShell";
import { ChatTimeline } from "./components/chat/ChatTimeline";
import { PromptComposer } from "./components/composer/PromptComposer";
import { BottomDrawer } from "./components/drawers/BottomDrawer";
import "./index.css";

function WorkspaceMain() {
  const [composerPrompt, setComposerPrompt] = useState("");

  const handleSelectPrompt = (prompt: string) => {
    setComposerPrompt(prompt);
  };

  return (
    <AppShell drawer={<BottomDrawer />}>
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Chat Timeline */}
        <ChatTimeline onSelectPrompt={handleSelectPrompt} />

        {/* Prompt Composer */}
        <PromptComposer initialValue={composerPrompt} />
      </div>
    </AppShell>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <PaseoProvider>
        <WorkspaceProvider>
          <WorkspaceMain />
        </WorkspaceProvider>
      </PaseoProvider>
    </ThemeProvider>
  );
}

export default App;

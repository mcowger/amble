import React, { useState } from "react";
import { TopRail } from "./TopRail";
import { BreadcrumbsBar } from "./BreadcrumbsBar";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";
import { useWorkspace } from "../../context/WorkspaceContext";

interface AppShellProps {
  children: React.ReactNode;
  drawer?: React.ReactNode;
}

export function AppShell({ children, drawer }: AppShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { drawerOpen } = useWorkspace();

  return (
    <div className="flex h-full h-[100dvh] w-full max-w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar for Desktop */}
      <div className="hidden md:flex h-full">
        <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Sidebar Drawer for Mobile */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 h-full bg-sidebar shadow-2xl">
            <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Breadcrumbs Row (above top rail) */}
        <BreadcrumbsBar onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

        {/* Top Header Rail */}
        <TopRail
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        {/* Content Area (Chat & Prompt Composer) */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {children}
        </main>

        {/* Bottom Drawer (Terminal & Changes) */}
        {drawer && drawerOpen && (
          <div className="h-64 sm:h-72 border-t border-border bg-card transition-all duration-200 ease-in-out flex flex-col z-30 shrink-0">
            {drawer}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

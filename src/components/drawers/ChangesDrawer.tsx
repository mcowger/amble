import React, { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { DiffViewer } from "../chat/DiffViewer";
import {
  GitBranch,
  GitCommit,
  RefreshCw,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { GitFileChange } from "../../lib/paseo/types";

export function ChangesDrawer() {
  const { gitStatus, refreshGitStatus, commitGitChanges } = useWorkspace();
  const [selectedFile, setSelectedFile] = useState<GitFileChange | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const allFiles = [
    ...(gitStatus?.stagedFiles || []),
    ...(gitStatus?.unstagedFiles || []),
  ];

  const currentFile =
    selectedFile || (allFiles.length > 0 ? allFiles[0] : null);

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim() || isCommitting) return;

    setIsCommitting(true);
    setCommitError(null);

    try {
      await commitGitChanges(commitMessage.trim());
      setCommitMessage("");
      setCommitSuccess(true);
      setTimeout(() => setCommitSuccess(false), 2000);
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCommitting(false);
    }
  };

  const getStatusBadge = (status: GitFileChange["status"]) => {
    switch (status) {
      case "added":
        return <span className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">A</span>;
      case "deleted":
        return <span className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">D</span>;
      case "renamed":
        return <span className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">R</span>;
      default:
        return <span className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">M</span>;
    }
  };

  return (
    <div className="flex h-full bg-background select-none text-xs">
      {/* Left Pane: Files & Commit Box */}
      <div className="w-72 border-r border-border bg-sidebar/30 flex flex-col h-full shrink-0">
        {/* Status Header */}
        <div className="h-9 px-3 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
            <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{gitStatus?.branch || "main"}</span>
            {gitStatus?.ahead !== undefined && gitStatus.ahead > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center">
                <ArrowUp className="w-2.5 h-2.5" />
                {gitStatus.ahead}
              </span>
            )}
            {gitStatus?.behind !== undefined && gitStatus.behind > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center">
                <ArrowDown className="w-2.5 h-2.5" />
                {gitStatus.behind}
              </span>
            )}
          </div>

          <button
            onClick={() => refreshGitStatus()}
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Refresh Git Status"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* Changed Files List */}
        <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
          {allFiles.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground space-y-1">
              <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 opacity-60" />
              <p className="font-medium text-[11px]">Working tree clean</p>
              <p className="text-[10px] text-muted-foreground/80">No uncommitted changes</p>
            </div>
          ) : (
            allFiles.map((file) => {
              const isSelected = currentFile?.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-accent text-accent-foreground font-medium shadow-2xs"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {getStatusBadge(file.status)}
                    <span className="truncate font-mono text-[11px]">{file.path}</span>
                  </div>

                  {(file.insertions !== undefined || file.deletions !== undefined) && (
                    <div className="flex items-center gap-1 text-[10px] shrink-0 ml-1 font-mono">
                      {file.insertions ? (
                        <span className="text-emerald-600 dark:text-emerald-400">+{file.insertions}</span>
                      ) : null}
                      {file.deletions ? (
                        <span className="text-rose-600 dark:text-rose-400">-{file.deletions}</span>
                      ) : null}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Commit Input Box */}
        {allFiles.length > 0 && (
          <form onSubmit={handleCommit} className="p-2 border-t border-border bg-card space-y-1.5">
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message (e.g. feat: add amble UI)..."
              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border focus:outline-hidden focus:ring-1 focus:ring-ring"
            />

            {commitError && (
              <p className="text-[10px] text-destructive font-mono truncate">{commitError}</p>
            )}

            <button
              type="submit"
              disabled={!commitMessage.trim() || isCommitting}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                commitMessage.trim() && !isCommitting
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
              }`}
            >
              {commitSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Committed!</span>
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>{isCommitting ? "Committing..." : "Commit Changes"}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Right Pane: Diff View */}
      <div className="flex-1 overflow-y-auto p-3 bg-background">
        {currentFile ? (
          <DiffViewer
            filePath={currentFile.path}
            diffText={currentFile.diff}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-1">
              <FileCode className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs">Select a file to inspect diff</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

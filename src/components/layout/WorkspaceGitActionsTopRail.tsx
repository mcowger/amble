import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowDownUp,
  Check,
  ChevronDown,
  Download,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import type { CheckoutPrMergeMethod } from "@getpaseo/protocol/messages";
import { useWorkspace } from "../../context/WorkspaceContext";
import { usePaseo } from "../../context/PaseoContext";
import { cn } from "../../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button, PressButton } from "../ui/button";

type GitActionId =
  | "refresh"
  | "commit"
  | "pull"
  | "push"
  | "sync"
  | "update-from-base"
  | "merge-locally"
  | "create-pr"
  | "view-pr"
  | "merge-pr-merge"
  | "merge-pr-squash"
  | "merge-pr-rebase"
  | "enable-auto-merge-merge"
  | "enable-auto-merge-squash"
  | "enable-auto-merge-rebase"
  | "disable-auto-merge"
  | "archive";

type MergeActionId = "merge-pr-merge" | "merge-pr-squash" | "merge-pr-rebase";
type AutoMergeActionId =
  | "enable-auto-merge-merge"
  | "enable-auto-merge-squash"
  | "enable-auto-merge-rebase";

interface GitAction {
  id: GitActionId;
  label: string;
  icon: React.ReactNode;
  startsGroup?: boolean;
}

const SUCCESS_DISPLAY_MS = 1200;

const MERGE_METHOD_BY_ACTION: Record<MergeActionId, CheckoutPrMergeMethod> = {
  "merge-pr-merge": "merge",
  "merge-pr-squash": "squash",
  "merge-pr-rebase": "rebase",
};

const AUTO_MERGE_METHOD_BY_ACTION: Record<AutoMergeActionId, CheckoutPrMergeMethod> = {
  "enable-auto-merge-merge": "merge",
  "enable-auto-merge-squash": "squash",
  "enable-auto-merge-rebase": "rebase",
};

function actionIcon(id: GitActionId) {
  switch (id) {
    case "commit":
      return <GitCommit className="w-3.5 h-3.5" />;
    case "pull":
      return <Download className="w-3.5 h-3.5" />;
    case "push":
      return <Upload className="w-3.5 h-3.5" />;
    case "sync":
      return <ArrowDownUp className="w-3.5 h-3.5" />;
    case "merge-locally":
    case "merge-pr-merge":
    case "merge-pr-squash":
    case "merge-pr-rebase":
      return <GitMerge className="w-3.5 h-3.5" />;
    case "create-pr":
    case "view-pr":
    case "enable-auto-merge-merge":
    case "enable-auto-merge-squash":
    case "enable-auto-merge-rebase":
    case "disable-auto-merge":
      return <GitPullRequest className="w-3.5 h-3.5" />;
    case "archive":
      return <Archive className="w-3.5 h-3.5" />;
    default:
      return <RefreshCw className="w-3.5 h-3.5" />;
  }
}

const GIT_ACTIONS: readonly GitAction[] = [
  { id: "refresh", label: "Refresh", icon: actionIcon("refresh") },
  { id: "commit", label: "Commit changes", icon: actionIcon("commit") },
  { id: "pull", label: "Pull", icon: actionIcon("pull") },
  { id: "push", label: "Push", icon: actionIcon("push") },
  { id: "sync", label: "Pull and push", icon: actionIcon("sync") },
  {
    id: "update-from-base",
    label: "Update from base",
    icon: actionIcon("update-from-base"),
    startsGroup: true,
  },
  { id: "merge-locally", label: "Merge locally", icon: actionIcon("merge-locally") },
  {
    id: "create-pr",
    label: "Create pull request",
    icon: actionIcon("create-pr"),
    startsGroup: true,
  },
  { id: "view-pr", label: "View pull request", icon: actionIcon("view-pr") },
  {
    id: "merge-pr-merge",
    label: "Merge pull request (merge)",
    icon: actionIcon("merge-pr-merge"),
    startsGroup: true,
  },
  {
    id: "merge-pr-squash",
    label: "Merge pull request (squash)",
    icon: actionIcon("merge-pr-squash"),
  },
  {
    id: "merge-pr-rebase",
    label: "Merge pull request (rebase)",
    icon: actionIcon("merge-pr-rebase"),
  },
  {
    id: "enable-auto-merge-merge",
    label: "Enable auto-merge (merge)",
    icon: actionIcon("enable-auto-merge-merge"),
    startsGroup: true,
  },
  {
    id: "enable-auto-merge-squash",
    label: "Enable auto-merge (squash)",
    icon: actionIcon("enable-auto-merge-squash"),
  },
  {
    id: "enable-auto-merge-rebase",
    label: "Enable auto-merge (rebase)",
    icon: actionIcon("enable-auto-merge-rebase"),
  },
  { id: "disable-auto-merge", label: "Disable auto-merge", icon: actionIcon("disable-auto-merge") },
  { id: "archive", label: "Archive workspace", icon: actionIcon("archive"), startsGroup: true },
];

function throwOnRpcError(payload: unknown, fallback: string): void {
  const error = (payload as { error?: unknown } | null)?.error;
  if (!error) return;
  if (typeof error === "string") throw new Error(error);
  if (typeof (error as { message?: unknown }).message === "string") {
    throw new Error((error as { message: string }).message);
  }
  throw new Error(fallback);
}

export function WorkspaceGitActionsTopRail() {
  const { activeWorkspace, gitStatus, openChangesTab, refreshGitStatus, refreshWorkspaces } = useWorkspace();
  const { client, connectionState } = usePaseo();
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<GitActionId | null>(null);
  const [successfulAction, setSuccessfulAction] = useState<GitActionId | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cwd = activeWorkspace?.path || "";
  const isConnected = connectionState === "connected";
  const workspaceId = activeWorkspace?.id || "";

  useEffect(() => {
    setMenuOpen(false);
    setArchiveOpen(false);
    setPendingAction(null);
    setSuccessfulAction(null);
    setActionError(null);
  }, [cwd]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const executeAction = useCallback(
    async (id: GitActionId, confirmedArchive = false) => {
      if (pendingAction || !cwd) return;
      if (id === "archive" && !confirmedArchive) {
        setMenuOpen(false);
        setArchiveOpen(true);
        return;
      }
      if (id === "commit") {
        setMenuOpen(false);
        openChangesTab();
        return;
      }

      setActionError(null);
      setPendingAction(id);
      try {
        switch (id) {
          case "refresh":
            throwOnRpcError(await client.checkoutRefresh(cwd), "Refresh failed");
            await refreshGitStatus();
            break;
          case "pull":
            throwOnRpcError(await client.checkoutPull(cwd), "Pull failed");
            break;
          case "push":
            throwOnRpcError(await client.checkoutPush(cwd), "Push failed");
            break;
          case "sync":
            throwOnRpcError(await client.checkoutPull(cwd), "Pull failed");
            throwOnRpcError(await client.checkoutPush(cwd), "Push failed");
            break;
          case "update-from-base":
            throwOnRpcError(await client.checkoutMergeFromBase(cwd, {}), "Update from base failed");
            break;
          case "merge-locally":
            throwOnRpcError(await client.checkoutMerge(cwd, { strategy: "merge" }), "Merge failed");
            break;
          case "create-pr":
            throwOnRpcError(await client.checkoutPrCreate(cwd, {}), "Create pull request failed");
            break;
          case "view-pr": {
            const result = await client.checkoutPrStatus(cwd);
            throwOnRpcError(result, "Load pull request failed");
            if (!result.status?.url) throw new Error("No pull request exists for this checkout");
            window.open(result.status.url, "_blank", "noopener,noreferrer");
            break;
          }
          case "merge-pr-merge":
          case "merge-pr-squash":
          case "merge-pr-rebase":
            throwOnRpcError(
              await client.checkoutPrMerge(cwd, { method: MERGE_METHOD_BY_ACTION[id] }),
              "Merge pull request failed",
            );
            break;
          case "enable-auto-merge-merge":
          case "enable-auto-merge-squash":
          case "enable-auto-merge-rebase":
            throwOnRpcError(
              await client.checkoutForgeSetAutoMerge(cwd, {
                enabled: true,
                method: AUTO_MERGE_METHOD_BY_ACTION[id],
              }),
              "Enable auto-merge failed",
            );
            break;
          case "disable-auto-merge":
            throwOnRpcError(
              await client.checkoutForgeSetAutoMerge(cwd, { enabled: false }),
              "Disable auto-merge failed",
            );
            break;
          case "archive":
            if (!workspaceId) throw new Error("Workspace unavailable");
            throwOnRpcError(await client.archiveWorkspace(workspaceId), "Archive failed");
            await refreshWorkspaces();
            break;
        }

        if (id !== "refresh" && id !== "archive") await refreshGitStatus();
        setSuccessfulAction(id);
        setMenuOpen(false);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => {
          setSuccessfulAction((current) => (current === id ? null : current));
        }, SUCCESS_DISPLAY_MS);
      } catch (reason) {
        setActionError(reason instanceof Error ? reason.message : "Git action failed");
        setMenuOpen(true);
      } finally {
        setPendingAction(null);
      }
    },
    [client, cwd, openChangesTab, pendingAction, refreshGitStatus, refreshWorkspaces, workspaceId],
  );

  const handleAction = useCallback(
    (id: GitActionId) => {
      if (id === "archive") {
        setMenuOpen(false);
        setArchiveOpen(true);
        return;
      }
      void executeAction(id);
    },
    [executeAction],
  );

  const confirmArchive = useCallback(() => {
    setArchiveOpen(false);
    void executeAction("archive", true);
  }, [executeAction]);

  if (!activeWorkspace || !gitStatus) return null;

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!isConnected || Boolean(pendingAction)}
            className={cn(
              "h-8 sm:h-7 px-2.5 flex items-center gap-1.5 rounded-md border border-border/80 bg-card text-xs font-medium text-foreground hover:bg-accent cursor-pointer transition-colors touch-manipulation outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none",
              menuOpen && "bg-accent",
            )}
            aria-label="Git actions"
          >
            {pendingAction ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : successfulAction ? (
              <Check className="w-3.5 h-3.5 text-primary" />
            ) : (
              <GitBranch className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Git</span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", menuOpen && "rotate-180")} />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-80 sm:w-96 max-h-[min(32rem,calc(100vh-5rem))] overflow-y-auto p-1.5 rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 px-2 py-1.5 border-b border-border/70">
            <div className="flex items-center gap-1.5 min-w-0">
              <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-mono text-xs font-medium truncate">{gitStatus.branch}</span>
            </div>
            <PressButton
              type="button"
              onPress={() => void executeAction("refresh")}
              disabled={Boolean(pendingAction)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors [&_svg]:pointer-events-none"
              title="Refresh git status"
              aria-label="Refresh git status"
            >
              <RefreshCw className="w-3 h-3" />
            </PressButton>
          </div>

          {actionError && (
            <div className="px-2 py-1.5 text-[10px] text-destructive font-mono truncate" role="alert">
              {actionError}
            </div>
          )}

          <div className="flex flex-col gap-0.5 pt-1">
            {GIT_ACTIONS.map((action, index) => (
              <React.Fragment key={action.id}>
                {action.startsGroup && index > 0 && <div className="h-px bg-border my-1" />}
                <PressButton
                  type="button"
                  onPress={() => handleAction(action.id)}
                  disabled={Boolean(pendingAction)}
                  className={cn(
                    "w-full min-h-8 px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-xs text-foreground hover:bg-accent cursor-pointer transition-colors [&_svg]:pointer-events-none",
                    successfulAction === action.id && "text-primary",
                  )}
                  title={action.label}
                >
                  {pendingAction === action.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : successfulAction === action.id ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    action.icon
                  )}
                  <span className="truncate">{action.label}</span>
                </PressButton>
              </React.Fragment>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Archive className="w-4 h-4 text-primary" />
              Archive workspace?
            </DialogTitle>
            <DialogDescription>
              Archive <span className="font-semibold text-foreground">{activeWorkspace.name}</span>?
              This removes it from the workspace list and stops its active sessions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onPress={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onPress={confirmArchive}>
              <Archive className="w-3.5 h-3.5" />
              Archive workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

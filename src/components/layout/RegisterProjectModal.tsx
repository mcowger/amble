import React, { useState, useEffect, useMemo, useRef } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import {
  Folder,
  FolderPlus,
  FolderGit2,
  Search,
  Loader2,
  AlertCircle,
  Check,
  Globe,
  Lock,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { GithubRepository } from "../../lib/paseo/types";

interface RegisterProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectRegistered?: (project: any) => void;
}

function GithubMark({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

/**
 * Autocomplete / live suggestion input for directory paths.
 */
function DirectoryPathInput({
  value,
  onChange,
  placeholder = "e.g. ~/projects/my-app",
  disabled = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { getDirectorySuggestions } = useWorkspace();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const query = value.trim();
    if (!query) {
      // Suggest common paths when empty or home
      timerRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const res = await getDirectorySuggestions("~", { limit: 10 });
          setSuggestions(res);
        } catch {
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      }, 150);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await getDirectorySuggestions(query, { limit: 12 });
        setSuggestions(res);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, getDirectorySuggestions]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Folder className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground shrink-0 pointer-events-none" />
        <Input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-8 pr-8 text-xs font-mono"
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          {value && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(true);
              }}
              className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 border-b border-border/40">
            Suggested Directories
          </div>
          <ScrollArea className="max-h-48" viewportClassName="max-h-48">
            <div className="p-1 space-y-0.5">
              {suggestions.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => {
                    onChange(dir);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-xs font-mono text-foreground hover:bg-accent flex items-center gap-2 cursor-pointer transition-colors",
                    value === dir && "bg-accent font-medium text-primary",
                  )}
                >
                  <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{dir}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export function RegisterProjectModal({
  isOpen,
  onClose,
  onProjectRegistered,
}: RegisterProjectModalProps) {
  const {
    projects,
    registerProject,
    createProjectDirectory,
    cloneGithubProject,
    searchGithubRepositories,
  } = useWorkspace();

  type TabKey = "directory" | "blank" | "github";
  const [tab, setTab] = useState<TabKey>("directory");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states - Directory
  const [existingDirectoryPath, setExistingDirectoryPath] = useState("");

  // Form states - Blank Directory
  const defaultParentPath = useMemo(() => {
    if (projects.length > 0 && projects[0]?.rootPath) {
      const parts = projects[0].rootPath.split("/").filter(Boolean);
      if (parts.length > 1) {
        return "/" + parts.slice(0, -1).join("/");
      }
    }
    return "~";
  }, [projects]);

  const [parentDirectory, setParentDirectory] = useState(defaultParentPath);
  const [blankDirectoryName, setBlankDirectoryName] = useState("");

  // Form states - GitHub
  const [githubQuery, setGithubQuery] = useState("");
  const [githubTargetDirectory, setGithubTargetDirectory] = useState(defaultParentPath);
  const [cloneProtocol, setCloneProtocol] = useState<"https" | "ssh">("https");
  const [githubSearchResults, setGithubSearchResults] = useState<GithubRepository[]>([]);
  const [isSearchingGithub, setIsSearchingGithub] = useState(false);
  const [githubStatusInfo, setGithubStatusInfo] = useState<string | null>(null);
  const githubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setParentDirectory(defaultParentPath);
      setGithubTargetDirectory(defaultParentPath);
      setError(null);
    }
  }, [isOpen, defaultParentPath]);

  // Live search for GitHub repos
  useEffect(() => {
    if (tab !== "github") return;

    if (githubTimerRef.current) clearTimeout(githubTimerRef.current);

    const query = githubQuery.trim();
    if (!query || query.length < 2) {
      setGithubSearchResults([]);
      setIsSearchingGithub(false);
      setGithubStatusInfo(null);
      return;
    }

    // If query looks like a full URL or SSH path, don't search
    if (query.startsWith("http://") || query.startsWith("https://") || query.startsWith("git@")) {
      setGithubSearchResults([]);
      setIsSearchingGithub(false);
      return;
    }

    githubTimerRef.current = setTimeout(async () => {
      setIsSearchingGithub(true);
      setGithubStatusInfo(null);
      try {
        const res = await searchGithubRepositories(query, 8);
        if (res.status === "success") {
          setGithubSearchResults(res.repositories || []);
        } else if (res.status === "unauthenticated") {
          setGithubSearchResults([]);
          setGithubStatusInfo("GitHub CLI is unauthenticated. You can still paste any repository or clone URL.");
        } else if (res.status === "unavailable") {
          setGithubSearchResults([]);
          setGithubStatusInfo("GitHub CLI is not available. You can still paste any repository or clone URL.");
        } else {
          setGithubSearchResults([]);
        }
      } catch {
        setGithubSearchResults([]);
      } finally {
        setIsSearchingGithub(false);
      }
    }, 250);

    return () => {
      if (githubTimerRef.current) clearTimeout(githubTimerRef.current);
    };
  }, [githubQuery, tab, searchGithubRepositories]);

  // Extracted repository name for preview
  const previewRepoName = useMemo(() => {
    const q = githubQuery.trim();
    if (!q) return "";
    const segments = q.replace(/\.git$/, "").split(/[/:/\\]/).filter(Boolean);
    return segments[segments.length - 1] || "";
  }, [githubQuery]);

  // Handle Tab 1 Submit: Existing Directory
  const handleRegisterDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = existingDirectoryPath.trim();
    if (!trimmed) {
      setError("Please specify a directory path");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await registerProject(trimmed);
      if (res.error) {
        setError(
          res.errorCode === "directory_not_found"
            ? `Directory does not exist: ${trimmed}`
            : res.error,
        );
        return;
      }
      onProjectRegistered?.(res.project);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to register project directory");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Tab 2 Submit: Blank Directory
  const handleCreateBlankDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    const parent = parentDirectory.trim();
    const name = blankDirectoryName.trim();

    if (!parent) {
      setError("Please specify a parent directory");
      return;
    }
    if (!name) {
      setError("Please specify a directory name");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createProjectDirectory(parent, name);
      if (res.error) {
        setError(res.error);
        return;
      }
      onProjectRegistered?.(res.project);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create project directory");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Tab 3 Submit: GitHub Clone
  const handleCloneGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    const repo = githubQuery.trim();
    const targetDir = githubTargetDirectory.trim();

    if (!repo) {
      setError("Please enter a GitHub repository name or clone URL");
      return;
    }
    if (!targetDir) {
      setError("Please enter a target parent directory");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await cloneGithubProject(repo, targetDir, cloneProtocol);
      if (res.error) {
        setError(res.error);
        return;
      }
      onProjectRegistered?.(res.project);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to clone GitHub repository");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderPlus className="w-4 h-4 text-primary shrink-0" />
            <span>Register New Project</span>
          </DialogTitle>
          <DialogDescription>
            Add an existing local folder, create a blank directory, or clone from GitHub.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(val) => {
            setTab(val as TabKey);
            setError(null);
          }}
          className="w-full pt-1"
        >
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="directory" className="text-xs py-1 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" />
              <span>Directory</span>
            </TabsTrigger>
            <TabsTrigger value="blank" className="text-xs py-1 flex items-center gap-1.5">
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Blank</span>
            </TabsTrigger>
            <TabsTrigger value="github" className="text-xs py-1 flex items-center gap-1.5">
              <GithubMark className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </TabsTrigger>
          </TabsList>

          {/* ======================= Tab 1: Existing Directory ======================= */}
          <TabsContent value="directory" className="space-y-4 pt-3">
            <form onSubmit={handleRegisterDirectory} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5" />
                  Local Directory Path
                </Label>
                <DirectoryPathInput
                  value={existingDirectoryPath}
                  onChange={(val) => {
                    setExistingDirectoryPath(val);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. ~/workspace/my-project"
                  disabled={isSubmitting}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Type a path to search local directories or paste an absolute path.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-xs"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !existingDirectoryPath.trim()}
                  className="gap-1.5 text-xs font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Add Project
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* ======================= Tab 2: Blank Directory ======================= */}
          <TabsContent value="blank" className="space-y-4 pt-3">
            <form onSubmit={handleCreateBlankDirectory} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5" />
                  Parent Directory
                </Label>
                <DirectoryPathInput
                  value={parentDirectory}
                  onChange={(val) => {
                    setParentDirectory(val);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. ~/workspace"
                  disabled={isSubmitting}
                />
                <p className="text-[11px] text-muted-foreground">
                  Where the new folder will be created.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FolderPlus className="w-3.5 h-3.5" />
                  Directory Name
                </Label>
                <Input
                  type="text"
                  value={blankDirectoryName}
                  onChange={(e) => {
                    setBlankDirectoryName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. my-new-service"
                  className="text-xs font-mono"
                  disabled={isSubmitting}
                  autoFocus
                />
                {blankDirectoryName.trim() && (
                  <p className="text-[11px] font-mono text-muted-foreground/80 truncate">
                    Will create: {parentDirectory.replace(/\/+$/, "")}/{blankDirectoryName.trim()}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-xs"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !parentDirectory.trim() || !blankDirectoryName.trim()}
                  className="gap-1.5 text-xs font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-3.5 h-3.5" />
                      Create & Register
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* ======================= Tab 3: GitHub ======================= */}
          <TabsContent value="github" className="space-y-4 pt-3">
            <form onSubmit={handleCloneGithub} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <GithubMark className="w-3.5 h-3.5" />
                  GitHub Repository
                </Label>
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground shrink-0 pointer-events-none" />
                  <Input
                    type="text"
                    value={githubQuery}
                    onChange={(e) => {
                      setGithubQuery(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Search repos or enter owner/repo (e.g. vercel/next.js)"
                    className="pl-8 pr-8 text-xs font-mono"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <div className="absolute right-2.5 flex items-center gap-1">
                    {isSearchingGithub && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    {githubQuery && !isSubmitting && (
                      <button
                        type="button"
                        onClick={() => {
                          setGithubQuery("");
                          setGithubSearchResults([]);
                        }}
                        className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Notice (e.g. CLI unauthenticated) */}
                {githubStatusInfo && (
                  <p className="text-[11px] text-muted-foreground/80">{githubStatusInfo}</p>
                )}

                {/* Live Search Results */}
                {githubSearchResults.length > 0 && (
                  <div className="border border-border rounded-lg bg-card/60 divide-y divide-border/40 overflow-hidden max-h-36 overflow-y-auto mt-1">
                    {githubSearchResults.map((repo) => (
                      <button
                        key={repo.id}
                        type="button"
                        onClick={() => {
                          setGithubQuery(repo.nameWithOwner);
                          setGithubSearchResults([]);
                        }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-accent/50 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-medium text-foreground truncate">
                              {repo.nameWithOwner}
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] text-muted-foreground/70 bg-accent/60">
                              {repo.visibility === "private" ? (
                                <Lock className="w-2.5 h-2.5" />
                              ) : (
                                <Globe className="w-2.5 h-2.5" />
                              )}
                              {repo.visibility}
                            </span>
                          </div>
                          {repo.description && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {repo.description}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5" />
                  Target Parent Directory
                </Label>
                <DirectoryPathInput
                  value={githubTargetDirectory}
                  onChange={(val) => {
                    setGithubTargetDirectory(val);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. ~/workspace"
                  disabled={isSubmitting}
                />
                {previewRepoName && (
                  <p className="text-[11px] font-mono text-muted-foreground/80 truncate">
                    Will clone into: {githubTargetDirectory.replace(/\/+$/, "")}/{previewRepoName}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Clone Protocol</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCloneProtocol("https")}
                    disabled={isSubmitting}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-mono border transition-colors cursor-pointer",
                      cloneProtocol === "https"
                        ? "bg-accent border-primary/50 text-foreground font-semibold"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    HTTPS
                  </button>
                  <button
                    type="button"
                    onClick={() => setCloneProtocol("ssh")}
                    disabled={isSubmitting}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-mono border transition-colors cursor-pointer",
                      cloneProtocol === "ssh"
                        ? "bg-accent border-primary/50 text-foreground font-semibold"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    SSH
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-xs"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !githubQuery.trim() || !githubTargetDirectory.trim()}
                  className="gap-1.5 text-xs font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Cloning & Registering...
                    </>
                  ) : (
                    <>
                      <FolderGit2 className="w-3.5 h-3.5" />
                      Clone & Register
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { ModelSelector } from "./ModelSelector";
import { EffortSelector } from "./EffortSelector";
import { SlashCommands, type SlashCommandItem } from "./SlashCommands";
import { FileMentionPopup } from "./FileMentionPopup";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import type { ImageAttachment } from "../../lib/paseo/types";
import {
  isValidImageFile,
  fileToImageAttachment,
  getImagesFromClipboard,
} from "../../lib/vision";
import {
  ArrowUp,
  Square,
  Paperclip,
  Hammer,
  Brain,
  HelpCircle,
  Terminal,
  Eraser,
  RotateCcw,
  GitCommit,
  Layers,
  Sparkles,
  FileText,
  Search,
  Check,
  ChevronDown,
  Plus,
  X,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";

function getModeIcon(modeId: string) {
  switch (modeId.toLowerCase()) {
    case "plan":
      return <Brain className="w-3 h-3 text-purple-500" />;
    case "ask":
    case "chat":
      return <HelpCircle className="w-3 h-3 text-blue-500" />;
    case "debug":
      return <Terminal className="w-3 h-3 text-amber-500" />;
    case "review":
      return <Search className="w-3 h-3 text-purple-500" />;
    default:
      return <Hammer className="w-3 h-3 text-emerald-500" />;
  }
}

export function PromptComposer({ initialValue = "" }: { initialValue?: string }) {
  const {
    sendMessage,
    isTurnRunning,
    cancelTurn,
    modes,
    selectedMode,
    setSelectedMode,
    canChangeMode,
    toggleDrawer,
    refreshTimeline,
    gitStatus,
    isVisionCapable,
    commands,
    archiveAgentSession,
    createAgentTab,
    activeAgentId,
  } = useWorkspace();

  const [prompt, setPrompt] = useState(initialValue);
  const [slashFilter, setSlashFilter] = useState<string | null>(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValue) {
      setPrompt(initialValue);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialValue]);

  // Autosize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        220,
      )}px`;
    }
  }, [prompt]);

  const handleAddFiles = useCallback(async (files: File[]) => {
    setImageError(null);
    if (files.length === 0) return;

    const newAttachments: ImageAttachment[] = [];
    for (const file of files) {
      const validation = isValidImageFile(file);
      if (!validation.valid) {
        setImageError(validation.error || "Invalid image file");
        continue;
      }
      try {
        const att = await fileToImageAttachment(file);
        newAttachments.push(att);
      } catch {
        setImageError(`Failed to read image: ${file.name}`);
      }
    }

    if (newAttachments.length > 0) {
      setPendingImages((prev) => [...prev, ...newAttachments]);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = getImagesFromClipboard(e);
    if (images.length > 0) {
      e.preventDefault();
      handleAddFiles(images);
    }
  };

  // Window-level drag and drop so users can drop images anywhere into the chat window
  useEffect(() => {
    let dragCounter = 0;

    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounter++;
        setIsDraggingOver(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDraggingOver(false);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types?.includes("Files")) {
        setIsDraggingOver(true);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDraggingOver(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const imageFiles: File[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          if (file && file.type.startsWith("image/")) {
            imageFiles.push(file);
          }
        }
        if (imageFiles.length > 0) {
          handleAddFiles(imageFiles);
        }
      }
    };

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [handleAddFiles]);

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if ((!trimmed && pendingImages.length === 0) || isTurnRunning) return;

    const imagesToSend = pendingImages.length > 0 ? [...pendingImages] : undefined;
    const textToSend = trimmed || (imagesToSend?.length ? "Describe this image" : "");

    setPrompt("");
    setPendingImages([]);
    setImageError(null);
    setSlashFilter(null);
    setMentionFilter(null);

    try {
      await sendMessage(textToSend, undefined, imagesToSend);
    } catch (err) {
      console.error("[PromptComposer] Send failed:", err);
    }
  };

  const getCommandIcon = (cmd: { name: string; kind?: string }) => {
    if (cmd.kind === "skill") {
      return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
    }
    const name = cmd.name.toLowerCase();
    if (name === "compact" || name === "summarize") {
      return <Layers className="w-3.5 h-3.5 text-purple-500" />;
    }
    if (name.includes("git") || name === "review") {
      return <GitCommit className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (name.includes("init")) {
      return <FileText className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (name.includes("search") || name.includes("exa")) {
      return <Search className="w-3.5 h-3.5 text-purple-500" />;
    }
    return <Terminal className="w-3.5 h-3.5 text-primary" />;
  };

  const modeSlashCommands: SlashCommandItem[] = canChangeMode
    ? modes.map((m) => ({
        name: m.id.toLowerCase(),
        description: m.description || `Switch agent mode to ${m.name}`,
        kind: "mode" as const,
        icon: getModeIcon(m.id),
        action: () => {
          setSelectedMode(m.id);
          setPrompt("");
          setSlashFilter(null);
        },
      }))
    : [];

  const providerSlashCommands: SlashCommandItem[] = (commands || []).map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
    argumentHint: cmd.argumentHint,
    kind: cmd.kind || "command",
    icon: getCommandIcon(cmd),
    action: () => {
      setPrompt(`/${cmd.name} `);
      setSlashFilter(null);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
  }));

  const localActionCommands: SlashCommandItem[] = [
    {
      name: "terminal",
      description: "Open integrated terminal drawer",
      kind: "action",
      icon: <Terminal className="w-3.5 h-3.5 text-amber-500" />,
      action: () => {
        toggleDrawer("terminal");
        setPrompt("");
        setSlashFilter(null);
      },
    },
    {
      name: "git",
      description: "Open git changes and diff inspector",
      kind: "action",
      icon: <GitCommit className="w-3.5 h-3.5 text-blue-500" />,
      action: () => {
        toggleDrawer("changes");
        setPrompt("");
        setSlashFilter(null);
      },
    },
    {
      name: "clear",
      description: "Archive this agent and start a fresh draft",
      kind: "action",
      icon: <Eraser className="w-3.5 h-3.5 text-rose-500" />,
      action: async () => {
        setPrompt("");
        setSlashFilter(null);
        if (activeAgentId) {
          await archiveAgentSession(activeAgentId);
          await createAgentTab();
        }
      },
    },
    {
      name: "exit",
      description: "Archive the current agent",
      kind: "action",
      icon: <Eraser className="w-3.5 h-3.5 text-rose-500" />,
      action: async () => {
        setPrompt("");
        setSlashFilter(null);
        if (activeAgentId) {
          await archiveAgentSession(activeAgentId);
        }
      },
    },
  ];

  // Merge commands, prioritizing provider commands & skills
  const slashCommands: SlashCommandItem[] = [];
  const seenNames = new Set<string>();

  for (const cmd of [...providerSlashCommands, ...modeSlashCommands, ...localActionCommands]) {
    const key = cmd.name.toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      slashCommands.push(cmd);
    }
  }

  const filteredSlashCommands =
    slashFilter !== null
      ? slashCommands.filter(
          (c) =>
            c.name.toLowerCase().includes(slashFilter.toLowerCase()) ||
            c.description.toLowerCase().includes(slashFilter.toLowerCase()),
        )
      : [];

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashFilter]);

  const handleSlashSelect = (cmd: SlashCommandItem) => {
    cmd.action();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashFilter !== null && filteredSlashCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSlashIndex(
          (prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length,
        );
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const picked = filteredSlashCommands[selectedSlashIndex];
        if (picked) {
          handleSlashSelect(picked);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashFilter(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      setSlashFilter(null);
      setMentionFilter(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);

    // Check for slash command trigger
    const cursor = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const slashMatch = textBeforeCursor.match(/(?:^|\n)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setSlashFilter(slashMatch[1] ?? "");
    } else {
      setSlashFilter(null);
    }

    // Check for file mention trigger
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_./-]*)$/);
    if (mentionMatch) {
      setMentionFilter(mentionMatch[1] ?? "");
    } else {
      setMentionFilter(null);
    }
  };

  const currentMode = modes.find((mode) => mode.id === selectedMode) || modes[0];

  const sampleFiles = [
    ...(gitStatus?.stagedFiles.map((f) => f.path) || []),
    ...(gitStatus?.unstagedFiles.map((f) => f.path) || []),
    "package.json",
    "src/index.ts",
    "src/App.tsx",
    "src/frontend.tsx",
    "docs/PLAN.md",
  ];

  const handleMentionSelect = (filePath: string) => {
    if (textareaRef.current) {
      const cursor = textareaRef.current.selectionStart || prompt.length;
      const textBeforeCursor = prompt.slice(0, cursor).replace(/@[a-zA-Z0-9_./-]*$/, `@${filePath} `);
      const textAfterCursor = prompt.slice(cursor);
      setPrompt(`${textBeforeCursor}${textAfterCursor}`);
      setMentionFilter(null);
    }
  };

  return (
    <div className="relative max-w-4xl w-full mx-auto p-2 sm:p-4 pt-0 min-w-0">
      {/* Popups */}
      {slashFilter !== null && (
        <SlashCommands
          filter={slashFilter}
          onSelect={handleSlashSelect}
          commands={slashCommands}
          selectedIndex={selectedSlashIndex}
        />
      )}

      {mentionFilter !== null && (
        <FileMentionPopup
          filter={mentionFilter}
          files={sampleFiles}
          onSelect={handleMentionSelect}
        />
      )}

      {/* Full-window drop target overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs pointer-events-none transition-all">
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-primary bg-card/95 shadow-2xl space-y-3 max-w-sm text-center">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <Plus className="w-8 h-8" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                Drop images to attach
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                PNG, JPEG, WebP, GIF up to 20MB
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Composer Box */}
      <div
        className={`rounded-2xl border ${
          isDraggingOver
            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
            : "border-border bg-card"
        } shadow-lg p-3 space-y-2 text-card-foreground transition-colors`}
      >
        {/* Error Notification */}
        {imageError && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{imageError}</span>
            </div>
            <button
              type="button"
              onClick={() => setImageError(null)}
              className="p-0.5 rounded-sm hover:bg-destructive/20 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Pending Image Attachments Preview Strip */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-1 pt-0">
            {pendingImages.map((img, idx) => (
              <div
                key={idx}
                className="group relative flex items-center gap-2 px-2 py-1.5 rounded-xl border border-border/80 bg-muted/60 hover:bg-muted text-card-foreground transition-all max-w-[220px]"
              >
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt={img.name || `Image ${idx + 1}`}
                  className="w-8 h-8 rounded-md object-cover border border-border/40 shrink-0 bg-background"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium truncate text-foreground">
                    {img.name || `Image ${idx + 1}`}
                  </div>
                  {img.size && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {(img.size / 1024).toFixed(0)} KB
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removePendingImage(idx)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 cursor-pointer transition-colors"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask Paseo to write code, debug issues, or execute commands... (type / for commands, @ for files)"
          rows={2}
          className="w-full resize-none bg-transparent border-0 p-1 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden leading-relaxed max-h-56 touch-manipulation"
        />

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40 select-none">
          {/* Left: Mode selector & Model / Effort & Image upload button */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {/* Upload Button: Always available (matches Paseo composer behavior) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-7 flex items-center justify-center gap-1 px-2 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/40 cursor-pointer transition-colors shrink-0 shadow-2xs"
              title={
                isVisionCapable
                  ? "Attach image (vision model active)"
                  : "Attach image"
              }
              aria-label="Attach image"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline text-[11px]">Image</span>
            </button>

            {/* Mode Pills */}
            {modes.length > 0 && (
              <>
                <div className="hidden md:flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg border border-border/30 shrink-0 h-7">
                {modes.map((m) => {
                  const isActive = m.id === selectedMode;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMode(m.id)}
                      disabled={!canChangeMode || isActive}
                      className={`h-6 flex items-center gap-1 px-2 rounded-md text-[11px] font-medium transition-colors ${
                        isActive
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      } ${
                        canChangeMode && !isActive
                          ? "cursor-pointer"
                          : "cursor-default opacity-85"
                      }`}
                      title={
                        canChangeMode
                          ? m.description || `Switch to ${m.name}`
                          : modes.length <= 1
                          ? `Mode: ${m.name}`
                          : "This provider does not support changing modes"
                      }
                    >
                      {getModeIcon(m.id)}
                      <span>{m.name}</span>
                    </button>
                  );
                })}
                </div>

                {currentMode && (
                  <Popover open={isModeMenuOpen} onOpenChange={setIsModeMenuOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={!canChangeMode}
                        className="h-7 md:hidden flex min-w-0 max-w-[80px] shrink-0 items-center gap-1 px-2 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/40 cursor-pointer transition-colors disabled:cursor-default disabled:opacity-85"
                        title={
                          canChangeMode
                            ? "Select agent mode"
                            : `Mode: ${currentMode.name}`
                        }
                        aria-label="Select agent mode"
                      >
                        {getModeIcon(currentMode.id)}
                        <span className="min-w-0 truncate">{currentMode.name}</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="start"
                      sideOffset={6}
                      className="w-56 p-1.5"
                    >
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Agent Mode
                      </div>
                      <div className="space-y-0.5">
                        {modes.map((m) => {
                          const isActive = m.id === selectedMode;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              disabled={!canChangeMode || isActive}
                              onClick={() => {
                                setSelectedMode(m.id);
                                setIsModeMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors disabled:cursor-default ${
                                isActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-foreground hover:bg-accent cursor-pointer"
                              }`}
                            >
                              {getModeIcon(m.id)}
                              <span className="min-w-0 flex-1 truncate">{m.name}</span>
                              {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </>
            )}

            {/* Model & Effort */}
            <ModelSelector />
            <EffortSelector />
          </div>

          {/* Right: Submit / Interrupt Action */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isTurnRunning ? (
              <button
                type="button"
                onClick={cancelTurn}
                className="group relative h-7 w-7 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center cursor-pointer shadow-xs transition-all hover:scale-105 active:scale-95 shrink-0"
                title="Stop generation"
                aria-label="Stop generation"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* Subtle track circle */}
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="opacity-25"
                  />
                  {/* Rotating spinner arc inspired by lucide-animated loader-circle */}
                  <g
                    className="animate-spin"
                    style={{ transformOrigin: "12px 12px" }}
                  >
                    <path
                      d="M21 12a9 9 0 1 1-6.219-8.56"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    />
                  </g>
                  {/* Centered stop square with rounded corners */}
                  <rect
                    x="8.5"
                    y="8.5"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill="currentColor"
                    stroke="none"
                    className="transition-transform group-hover:scale-110"
                    style={{ transformOrigin: "12px 12px" }}
                  />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!prompt.trim() && pendingImages.length === 0}
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium cursor-pointer transition-all shadow-xs shrink-0 ${
                  prompt.trim() || pendingImages.length > 0
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95"
                    : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                }`}
                title="Send Message (Enter)"
                aria-label="Send message"
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

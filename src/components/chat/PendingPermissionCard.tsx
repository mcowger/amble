import React, { useState, useMemo, useCallback } from "react";
import {
  ShieldAlert,
  HelpCircle,
  Check,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  FileCode,
  Terminal,
} from "lucide-react";
import type {
  PendingPermission,
  AgentPermissionResponse,
  AgentPermissionAction,
  QuestionFormQuestion,
} from "../../lib/paseo/types";
import { PressButton } from "../ui/button";

interface PendingPermissionCardProps {
  permission: PendingPermission;
  onRespond: (response: AgentPermissionResponse) => Promise<void>;
}

function parseQuestions(input: unknown): QuestionFormQuestion[] | null {
  if (
    typeof input !== "object" ||
    input === null ||
    !("questions" in input) ||
    !Array.isArray((input as Record<string, unknown>).questions)
  ) {
    return null;
  }
  const raw = (input as Record<string, unknown>).questions as unknown[];
  const questions: QuestionFormQuestion[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const q = item as Record<string, unknown>;
    const questionText = typeof q.question === "string" ? q.question : "";
    const headerText = typeof q.header === "string" ? q.header : "";
    if (!questionText && !headerText) continue;

    const options: Array<{ label: string; description?: string }> = [];
    if (Array.isArray(q.options)) {
      for (const opt of q.options as unknown[]) {
        if (typeof opt !== "object" || opt === null) continue;
        const o = opt as Record<string, unknown>;
        if (typeof o.label === "string") {
          options.push({
            label: o.label,
            description: typeof o.description === "string" ? o.description : undefined,
          });
        }
      }
    }

    questions.push({
      question: questionText || headerText,
      header: headerText || questionText,
      options,
      multiSelect: q.multiSelect === true || q.multiple === true,
      allowOther: q.allowOther === true || q.isOther === true || options.length === 0,
      allowEmpty: q.allowEmpty === true,
      placeholder: typeof q.placeholder === "string" ? q.placeholder : undefined,
      dismissLabel: typeof q.dismissLabel === "string" ? q.dismissLabel : undefined,
    });
  }
  return questions.length > 0 ? questions : null;
}

export function PendingPermissionCard({ permission, onRespond }: PendingPermissionCardProps) {
  const { request } = permission;
  const isQuestion = request.kind === "question" || request.name === "question";
  const parsedQuestions = useMemo(() => parseQuestions(request.input), [request.input]);

  const [isResponding, setIsResponding] = useState(false);
  const [respondingActionId, setRespondingActionId] = useState<string | null>(null);

  // Question form state
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [selections, setSelections] = useState<Record<number, Set<number>>>({});
  const [otherTexts, setOtherTexts] = useState<Record<number, string>>({});

  // Tool Permission Actions
  const resolvedActions: AgentPermissionAction[] = useMemo(() => {
    if (request.actions && request.actions.length > 0) {
      return request.actions;
    }
    return [
      { id: "deny", label: "Deny", behavior: "deny", variant: "danger" },
      { id: "allow_always", label: "Allow always", behavior: "allow", variant: "secondary" },
      { id: "allow_once", label: "Allow once", behavior: "allow", variant: "primary" },
    ];
  }, [request.actions]);

  // Handle Tool Permission Action Click
  const handleActionClick = useCallback(
    async (action: AgentPermissionAction) => {
      if (isResponding) return;
      setIsResponding(true);
      setRespondingActionId(action.id);
      try {
        if (action.behavior === "deny") {
          await onRespond({
            behavior: "deny",
            selectedActionId: action.id,
            message: "Denied by user",
          });
        } else {
          await onRespond({
            behavior: "allow",
            selectedActionId: action.id,
          });
        }
      } catch (err) {
        console.error("[PendingPermissionCard] Response failed:", err);
      } finally {
        setIsResponding(false);
        setRespondingActionId(null);
      }
    },
    [isResponding, onRespond],
  );

  // Toggle option selection in question form
  const handleToggleOption = useCallback(
    (qIndex: number, optIndex: number, multiSelect?: boolean) => {
      setSelections((prev) => {
        const current = prev[qIndex] ?? new Set<number>();
        const next = new Set(current);
        if (multiSelect) {
          if (next.has(optIndex)) {
            next.delete(optIndex);
          } else {
            next.add(optIndex);
          }
        } else if (next.has(optIndex)) {
          next.clear();
        } else {
          next.clear();
          next.add(optIndex);
        }
        return { ...prev, [qIndex]: next };
      });

      // Clear custom text when clicking an option on single-select
      if (!multiSelect) {
        setOtherTexts((prev) => {
          if (!prev[qIndex]) return prev;
          const next = { ...prev };
          delete next[qIndex];
          return next;
        });
      }
    },
    [],
  );

  // Handle other text input change
  const handleOtherTextChange = useCallback((qIndex: number, val: string) => {
    setOtherTexts((prev) => ({ ...prev, [qIndex]: val }));
    if (val.trim().length > 0) {
      // Clear option selections if user starts typing custom text
      setSelections((prev) => {
        if (!prev[qIndex] || prev[qIndex].size === 0) return prev;
        return { ...prev, [qIndex]: new Set<number>() };
      });
    }
  }, []);

  // Check if current question is answered
  const isQuestionAnswered = useCallback(
    (qIndex: number, q: QuestionFormQuestion) => {
      const selected = selections[qIndex];
      if (selected && selected.size > 0) return true;
      const text = otherTexts[qIndex]?.trim();
      if (text && text.length > 0) return true;
      return Boolean(q.allowEmpty);
    },
    [selections, otherTexts],
  );

  // Check if all questions are answered
  const allQuestionsAnswered = useMemo(() => {
    if (!parsedQuestions) return true;
    return parsedQuestions.every((q, idx) => isQuestionAnswered(idx, q));
  }, [parsedQuestions, isQuestionAnswered]);

  // Handle Question Form Submit
  const handleQuestionSubmit = useCallback(async () => {
    if (isResponding) return;
    setIsResponding(true);
    setRespondingActionId("submit");

    try {
      const answers: Record<string, string> = {};
      if (parsedQuestions) {
        for (let i = 0; i < parsedQuestions.length; i++) {
          const q = parsedQuestions[i]!;
          const selected = selections[i];
          const otherText = otherTexts[i]?.trim();

          if (otherText && otherText.length > 0) {
            answers[q.header] = otherText;
          } else if (selected && selected.size > 0) {
            const labels = Array.from(selected).map((idx) => q.options[idx]?.label).filter(Boolean);
            answers[q.header] = labels.join(", ");
          } else if (q.allowEmpty) {
            answers[q.header] = "";
          }
        }
      }

      await onRespond({
        behavior: "allow",
        updatedInput: {
          ...request.input,
          answers,
        },
      });
    } catch (err) {
      console.error("[PendingPermissionCard] Question submit failed:", err);
    } finally {
      setIsResponding(false);
      setRespondingActionId(null);
    }
  }, [isResponding, parsedQuestions, selections, otherTexts, onRespond, request.input]);

  // Handle Question Dismiss
  const handleQuestionDismiss = useCallback(async () => {
    if (isResponding) return;
    setIsResponding(true);
    setRespondingActionId("dismiss");
    try {
      await onRespond({
        behavior: "deny",
        message: "Dismissed by user",
      });
    } catch (err) {
      console.error("[PendingPermissionCard] Dismiss failed:", err);
    } finally {
      setIsResponding(false);
      setRespondingActionId(null);
    }
  }, [isResponding, onRespond]);

  // Render Question Mode Card
  if (isQuestion && parsedQuestions && parsedQuestions.length > 0) {
    const currentQuestion = parsedQuestions[activeQuestionIdx] || parsedQuestions[0]!;
    const isCurrentAnswered = isQuestionAnswered(activeQuestionIdx, currentQuestion);
    const isLastQuestion = activeQuestionIdx === parsedQuestions.length - 1;

    return (
      <div className="my-4 rounded-xl border border-border bg-card p-4 shadow-sm text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                {request.title || "Question from Agent"}
              </h3>
              {parsedQuestions.length > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  Step {activeQuestionIdx + 1} of {parsedQuestions.length} • {currentQuestion.header}
                </span>
              )}
            </div>
          </div>

          {parsedQuestions.length > 1 && (
            <div className="flex items-center gap-1">
              {parsedQuestions.map((_, idx) => (
                <PressButton
                  key={idx}
                  type="button"
                  onPress={() => setActiveQuestionIdx(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === activeQuestionIdx
                      ? "bg-primary"
                      : isQuestionAnswered(idx, parsedQuestions[idx]!)
                      ? "bg-muted-foreground/50"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Question Prompt */}
        <div className="mb-3">
          <p className="text-xs font-medium text-foreground leading-relaxed">
            {currentQuestion.question}
          </p>
        </div>

        {/* Options */}
        {currentQuestion.options.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {currentQuestion.options.map((opt, optIdx) => {
              const isSelected = selections[activeQuestionIdx]?.has(optIdx) ?? false;
              return (
                <PressButton
                  key={optIdx}
                  type="button"
                  disabled={isResponding}
                  onPress={() =>
                    handleToggleOption(activeQuestionIdx, optIdx, currentQuestion.multiSelect)
                  }
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer select-none ${
                    isSelected
                      ? "border-primary/80 bg-primary/5 text-foreground font-medium"
                      : "border-border/60 bg-muted/20 hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex items-center justify-center w-3.5 h-3.5 border transition-colors ${
                      currentQuestion.multiSelect ? "rounded-xs" : "rounded-full"
                    } ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/60"
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-2.5 h-2.5 stroke-[3] text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div>{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 font-normal">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </PressButton>
              );
            })}
          </div>
        )}

        {/* Custom text input */}
        {currentQuestion.allowOther && (
          <div className="mb-4">
            <input
              type="text"
              disabled={isResponding}
              value={otherTexts[activeQuestionIdx] || ""}
              onChange={(e) => handleOtherTextChange(activeQuestionIdx, e.target.value)}
              placeholder={
                currentQuestion.placeholder ||
                (currentQuestion.options.length === 0
                  ? "Type your answer..."
                  : "Or type your own answer...")
              }
              className="w-full px-3 py-2 rounded-lg border border-border/70 bg-muted/30 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60"
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <PressButton
            type="button"
            disabled={isResponding}
            onPress={handleQuestionDismiss}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/70 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
          >
            {isResponding && respondingActionId === "dismiss" ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : (
              <X className="w-3 h-3" />
            )}
            <span>{currentQuestion.dismissLabel || "Dismiss"}</span>
          </PressButton>

          <div className="flex items-center gap-2">
            {parsedQuestions.length > 1 && activeQuestionIdx > 0 && (
              <PressButton
                type="button"
                disabled={isResponding}
                onPress={() => setActiveQuestionIdx((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border/70 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </PressButton>
            )}

            {!isLastQuestion ? (
              <PressButton
                type="button"
                disabled={isResponding || !isCurrentAnswered}
                onPress={() => setActiveQuestionIdx((prev) => prev + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </PressButton>
            ) : (
              <PressButton
                type="button"
                disabled={isResponding || !allQuestionsAnswered}
                onPress={handleQuestionSubmit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isResponding && respondingActionId === "submit" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-foreground" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Submit</span>
              </PressButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Tool Permission Card (e.g. Doom Loop, Bash, Task, Write)
  const detailJson = useMemo(() => {
    const raw = request.input || request.detail || request.metadata;
    if (!raw) return null;
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  }, [request.input, request.detail, request.metadata]);

  return (
    <div className="my-4 rounded-xl border border-border bg-card p-4 shadow-sm text-card-foreground">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">
            {request.title || request.name}
          </h3>
        </div>
        {request.description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {request.description}
          </p>
        )}
      </div>

      {/* Input JSON / Details */}
      {detailJson && (
        <div className="mb-3">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 select-none">
            Input
          </div>
          <pre className="p-3 rounded-lg border border-border/60 bg-muted/40 font-mono text-[11px] text-foreground leading-relaxed overflow-x-auto max-h-60 whitespace-pre-wrap break-all min-w-0 max-w-full">
            {detailJson}
          </pre>
        </div>
      )}

      {/* Decision Prompt & Action Buttons */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground mb-3 font-medium">
          How would you like to proceed?
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {resolvedActions.map((action) => {
            const isDeny = action.behavior === "deny";
            const isPrimary = action.variant === "primary" || action.id === "allow_once";
            const isCurrentResponding = isResponding && respondingActionId === action.id;

            return (
              <PressButton
                key={action.id}
                type="button"
                disabled={isResponding}
                onPress={() => handleActionClick(action)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors select-none ${
                  isPrimary
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                    : isDeny
                    ? "border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    : "border border-border/80 text-foreground hover:bg-muted/60"
                }`}
              >
                {isCurrentResponding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isDeny ? (
                  <X className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{action.label}</span>
              </PressButton>
            );
          })}
        </div>
      </div>
    </div>
  );
}

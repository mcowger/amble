import React, { useState } from "react";
import { CheckCircle2, Circle, Loader2, ListTodo, ChevronRight, ChevronDown } from "lucide-react";
import type { TodoTimelineItem, TodoItem } from "../../lib/paseo/types";

function renderTodoRow(todo: TodoItem, key: React.Key) {
  const isDone = todo.completed || todo.status === "completed";
  const inProgress = todo.status === "in_progress";

  return (
    <div key={key} className="flex items-start gap-2 text-xs">
      {inProgress ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0 mt-0.5" />
      ) : isDone ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <Circle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
      )}
      <span
        className={`leading-relaxed min-w-0 flex-1 break-words [overflow-wrap:anywhere] ${
          isDone
            ? "line-through text-muted-foreground"
            : inProgress
            ? "font-medium text-foreground"
            : "text-muted-foreground"
        }`}
      >
        {todo.text}
      </span>
    </div>
  );
}

export interface TodoItemsListProps {
  items: TodoItem[];
  className?: string;
  collapseCompleted?: boolean;
  defaultCompletedExpanded?: boolean;
}

export function TodoItemsList({
  items,
  className,
  collapseCompleted = true,
  defaultCompletedExpanded = false,
}: TodoItemsListProps) {
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(defaultCompletedExpanded);

  if (!items || items.length === 0) return null;

  const isDone = (todo: TodoItem) => Boolean(todo.completed || todo.status === "completed");

  if (!collapseCompleted) {
    return (
      <div className={className || "space-y-1.5 pt-1"}>
        {items.map((todo, idx) => renderTodoRow(todo, todo.id || idx))}
      </div>
    );
  }

  const completedItems = items.filter(isDone);
  const activeItems = items.filter((todo) => !isDone(todo));

  if (completedItems.length === 0) {
    return (
      <div className={className || "space-y-1.5 pt-1"}>
        {items.map((todo, idx) => renderTodoRow(todo, todo.id || idx))}
      </div>
    );
  }

  return (
    <div className={className || "space-y-1.5 pt-1"}>
      {/* Collapsible expando for crossed-off tasks */}
      <button
        type="button"
        onClick={() => setIsCompletedExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 select-none w-full text-left cursor-pointer"
        aria-expanded={isCompletedExpanded}
      >
        {isCompletedExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
        <span className="font-medium">
          {completedItems.length} completed {completedItems.length === 1 ? "task" : "tasks"}
        </span>
      </button>

      {/* Expanded completed items */}
      {isCompletedExpanded && (
        <div className="pl-4 space-y-1.5 py-0.5 border-l border-border/40 ml-1.5">
          {completedItems.map((todo, idx) =>
            renderTodoRow(todo, `completed-${todo.id || idx}`)
          )}
        </div>
      )}

      {/* Active and upcoming items */}
      {activeItems.map((todo, idx) =>
        renderTodoRow(todo, `active-${todo.id || idx}`)
      )}
    </div>
  );
}

export function TodoBlock({ item }: { item: TodoTimelineItem }) {
  if (!item.items || item.items.length === 0) return null;

  return (
    <div className="my-3 p-3.5 rounded-xl border border-border bg-card/60 shadow-2xs text-xs space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
        <ListTodo className="w-3.5 h-3.5 text-primary" />
        <span>Tasks & Plan</span>
      </div>

      <TodoItemsList items={item.items} />
    </div>
  );
}

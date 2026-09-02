import React from "react";
import { CheckCircle2, Circle, Loader2, ListTodo } from "lucide-react";
import type { TodoTimelineItem } from "../../lib/paseo/types";

export function TodoBlock({ item }: { item: TodoTimelineItem }) {
  if (!item.items || item.items.length === 0) return null;

  return (
    <div className="my-3 p-3.5 rounded-xl border border-border bg-card/60 shadow-2xs text-xs space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
        <ListTodo className="w-3.5 h-3.5 text-primary" />
        <span>Tasks & Plan</span>
      </div>

      <div className="space-y-1.5 pt-1">
        {item.items.map((todo, idx) => {
          const isDone = todo.completed || todo.status === "completed";
          const inProgress = todo.status === "in_progress";

          return (
            <div key={todo.id || idx} className="flex items-start gap-2 text-xs">
              {inProgress ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0 mt-0.5" />
              ) : isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
              )}
              <span
                className={`leading-relaxed ${
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
        })}
      </div>
    </div>
  );
}

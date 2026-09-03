import type { ReasoningTimelineItem, TimelineItem } from "./types";

export function appendReasoningTimelineItem(
  timeline: TimelineItem[],
  item: ReasoningTimelineItem,
  turnId?: string,
  startedAt = Date.now(),
): TimelineItem[] {
  const next = [...timeline];
  const lastIndex = next.length - 1;
  const last = next[lastIndex];
  const incomingText = item.text || "";
  const hasConflictingTurnId =
    last?.type === "reasoning" &&
    turnId !== undefined &&
    last.turnId !== undefined &&
    last.turnId !== turnId;
  const canContinueStream =
    last?.type === "reasoning" &&
    last.isStreaming &&
    !hasConflictingTurnId;
  const canContinueSameTurn =
    last?.type === "reasoning" &&
    turnId !== undefined &&
    last.turnId === turnId;

  if (last?.type === "reasoning" && (canContinueStream || canContinueSameTurn)) {
    const previousText = last.text || "";
    let text = previousText;
    if (incomingText.startsWith(previousText)) {
      text = incomingText;
    } else if (previousText.endsWith(incomingText) && incomingText.length > 0) {
      text = previousText;
    } else {
      text = previousText + incomingText;
    }

    next[lastIndex] = {
      ...last,
      ...item,
      text,
      isStreaming: true,
      startedAt: last.startedAt || startedAt,
      ...(turnId !== undefined ? { turnId } : {}),
    };
    return next;
  }

  for (let index = 0; index < next.length; index++) {
    const previous = next[index];
    if (previous?.type === "reasoning" && previous.isStreaming) {
      next[index] = {
        ...previous,
        isStreaming: false,
        durationMs: previous.startedAt ? startedAt - previous.startedAt : previous.durationMs,
      };
    }
  }

  return [
    ...next,
    {
      ...item,
      isStreaming: true,
      startedAt,
      ...(turnId !== undefined ? { turnId } : {}),
    },
  ];
}

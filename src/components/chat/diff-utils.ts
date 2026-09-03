export interface DiffStats {
  additions: number;
  deletions: number;
}

function countContentLines(content: string): number {
  if (!content) return 0;
  const lines = content.split(/\r?\n/);
  return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

export function countDiffStats(diffText: string): DiffStats {
  let additions = 0;
  let deletions = 0;

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }

  return { additions, deletions };
}

export function isDiffText(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return value.split(/\r?\n/).some(
    (line) =>
      line.startsWith("@@") ||
      line.startsWith("diff --git ") ||
      line.startsWith("*** ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("+") ||
      line.startsWith("-"),
  );
}

export function extractFilePathFromDiff(diffText: string | undefined): string | undefined {
  if (!diffText) return undefined;

  for (const line of diffText.split(/\r?\n/)) {
    const patchPath = line.match(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+?)\s*$/);
    if (patchPath?.[1]) return patchPath[1];
  }

  const newPath = diffText.match(/^\+\+\+ (?:b\/)?(.+?)(?:\t.*)?$/m)?.[1];
  if (newPath && newPath !== "/dev/null") return newPath;

  const oldPath = diffText.match(/^--- (?:a\/)?(.+?)(?:\t.*)?$/m)?.[1];
  return oldPath && oldPath !== "/dev/null" ? oldPath : undefined;
}

export function resolveDiffStats({
  diffText,
  oldString,
  newString,
  additions,
  deletions,
}: {
  diffText?: string;
  oldString?: string;
  newString?: string;
  additions?: number;
  deletions?: number;
}): DiffStats | undefined {
  const fallback =
    diffText !== undefined
      ? countDiffStats(diffText)
      : oldString !== undefined || newString !== undefined
        ? {
            additions: countContentLines(newString || ""),
            deletions: countContentLines(oldString || ""),
          }
        : undefined;

  if (!fallback && additions === undefined && deletions === undefined) return undefined;

  return {
    additions: additions ?? fallback?.additions ?? 0,
    deletions: deletions ?? fallback?.deletions ?? 0,
  };
}

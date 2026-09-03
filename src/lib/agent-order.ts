import type { AgentSnapshot } from "./paseo/types";

/**
 * Deterministically sorts agents in chronological creation order (oldest first).
 * Falls back to ID comparison when timestamps match or are missing.
 *
 * This ensures agent tab order remains completely stable and does not
 * shift or jump when an agent has recent activity or status updates.
 */
export function compareAgentSnapshotsByCreation(
  a: Pick<AgentSnapshot, "id"> & Partial<Pick<AgentSnapshot, "createdAt">>,
  b: Pick<AgentSnapshot, "id"> & Partial<Pick<AgentSnapshot, "createdAt">>,
): number {
  const timeA = a.createdAt ? Date.parse(a.createdAt) : 0;
  const timeB = b.createdAt ? Date.parse(b.createdAt) : 0;
  const safeTimeA = Number.isNaN(timeA) ? 0 : timeA;
  const safeTimeB = Number.isNaN(timeB) ? 0 : timeB;
  if (safeTimeA !== safeTimeB) {
    return safeTimeA - safeTimeB;
  }
  return (a.id || "").localeCompare(b.id || "");
}

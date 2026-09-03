import type { ImageAttachment, UserMessageTimelineItem } from "./paseo/types";

export interface PersistedUserAttachment {
  id: string;
  agentId: string;
  messageId?: string;
  clientMessageId?: string;
  text: string;
  images: ImageAttachment[];
  timestamp: string;
}

const DB_NAME = "amble_attachments";
const STORE_NAME = "user_attachments";
const DB_VERSION = 1;

// In-memory cache for 0ms synchronous access during React renders
const memoryCache = new Map<string, PersistedUserAttachment[]>();

function getIndexedDb(): IDBFactory | null {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== "undefined" && (globalThis as any).indexedDB) {
    return (globalThis as any).indexedDB;
  }
  return null;
}

function openDb(): Promise<IDBDatabase | null> {
  const idb = getIndexedDb();
  if (!idb) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("agentId", "agentId", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Normalizes message text by removing provider-injected markers like [Image] and trimming whitespace.
 */
export function cleanUserMessageText(text?: string): string {
  if (!text) return "";
  return text
    .replace(/\[image\]/gi, "")
    .trim();
}

/**
 * Checks if two user message items match by identity or normalized content.
 */
export function matchesUserMessageItem(
  a: { text?: string; messageId?: string; clientMessageId?: string },
  b: { text?: string; messageId?: string; clientMessageId?: string },
): boolean {
  if (!a || !b) return false;

  // 1. Direct ID matches
  if (a.clientMessageId && b.clientMessageId && a.clientMessageId === b.clientMessageId) {
    return true;
  }
  if (a.messageId && b.messageId && a.messageId === b.messageId) {
    return true;
  }
  if (a.clientMessageId && b.messageId && a.clientMessageId === b.messageId) {
    return true;
  }
  if (a.messageId && b.clientMessageId && a.messageId === b.clientMessageId) {
    return true;
  }

  // 2. Text-based heuristic matches
  const cleanA = cleanUserMessageText(a.text);
  const cleanB = cleanUserMessageText(b.text);

  if (cleanA && cleanB) {
    if (cleanA === cleanB) return true;
    if (cleanA.startsWith(cleanB) || cleanB.startsWith(cleanA)) return true;
  }

  return false;
}

/**
 * Finds a matching attachment record for a given user message item.
 */
export function findMatchingAttachment(
  attachments: PersistedUserAttachment[] | undefined,
  item: UserMessageTimelineItem,
): PersistedUserAttachment | undefined {
  if (!attachments || attachments.length === 0) return undefined;

  return attachments.find((att) => matchesUserMessageItem(att, item));
}

/**
 * Saves user message attachments to both memory cache and IndexedDB.
 */
export async function saveUserMessageAttachments(
  agentId: string,
  messageId: string,
  text: string,
  images: ImageAttachment[],
  clientMessageId?: string,
): Promise<void> {
  if (!agentId || !images || images.length === 0) return;

  const record: PersistedUserAttachment = {
    id: clientMessageId || messageId,
    agentId,
    messageId,
    clientMessageId: clientMessageId || messageId,
    text,
    images,
    timestamp: new Date().toISOString(),
  };

  // 1. Update in-memory cache
  const existingList = memoryCache.get(agentId) || [];
  const existingIdx = existingList.findIndex((item) => matchesUserMessageItem(item, record));
  if (existingIdx >= 0) {
    existingList[existingIdx] = record;
  } else {
    existingList.push(record);
  }
  memoryCache.set(agentId, existingList);

  // 2. Persist to IndexedDB asynchronously
  try {
    const db = await openDb();
    if (!db) return;

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
  } catch (err) {
    console.warn("[AttachmentStore] Failed to write to IndexedDB:", err);
  }
}

/**
 * Synchronous retrieval of cached attachments for an agent.
 */
export function getCachedAgentAttachments(agentId?: string): PersistedUserAttachment[] {
  if (!agentId) return [];
  return memoryCache.get(agentId) || [];
}

/**
 * Loads attachments for an agent from IndexedDB into memory cache.
 */
export async function loadAgentAttachments(agentId: string): Promise<PersistedUserAttachment[]> {
  if (!agentId) return [];

  try {
    const db = await openDb();
    if (!db) return memoryCache.get(agentId) || [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("agentId");
        const request = index.getAll(agentId);

        request.onsuccess = () => {
          const records: PersistedUserAttachment[] = request.result || [];
          if (records.length > 0) {
            // Merge with any in-memory items
            const current = memoryCache.get(agentId) || [];
            const merged = [...records];
            for (const item of current) {
              if (!merged.some((m) => m.id === item.id)) {
                merged.push(item);
              }
            }
            memoryCache.set(agentId, merged);
            resolve(merged);
          } else {
            resolve(memoryCache.get(agentId) || []);
          }
        };

        request.onerror = () => resolve(memoryCache.get(agentId) || []);
      } catch {
        resolve(memoryCache.get(agentId) || []);
      }
    });
  } catch {
    return memoryCache.get(agentId) || [];
  }
}

/**
 * Clears attachments for an agent (e.g. on deletion/archive).
 */
export async function clearAgentAttachments(agentId: string): Promise<void> {
  memoryCache.delete(agentId);

  try {
    const db = await openDb();
    if (!db) return;

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("agentId");
    const request = index.openCursor(IDBKeyRange.only(agentId));

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch (err) {
    console.warn("[AttachmentStore] Failed to clear agent attachments from IndexedDB:", err);
  }
}

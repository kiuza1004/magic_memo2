import type { Memo } from "./types";

const KEY = "magic_memo_v1";

export function loadMemos(): Memo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Memo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMemos(memos: Memo[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(memos));
}

export function addMemo(text: string): Memo {
  const memo: Memo = {
    id: crypto.randomUUID(),
    text: text.trim(),
    createdAt: Date.now(),
    tags: extractTags(text),
  };
  const memos = loadMemos();
  memos.unshift(memo);
  saveMemos(memos);
  return memo;
}

export function deleteMemo(id: string): void {
  const memos = loadMemos().filter((m) => m.id !== id);
  saveMemos(memos);
}

export function clearAllMemos(): void {
  saveMemos([]);
}

export function updateMemo(id: string, text: string): void {
  const memos = loadMemos().map((m) =>
    m.id === id ? { ...m, text: text.trim(), tags: extractTags(text) } : m,
  );
  saveMemos(memos);
}

function extractTags(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/#([\p{L}\p{N}_-]+)/gu)) out.add(m[1]);
  return Array.from(out);
}

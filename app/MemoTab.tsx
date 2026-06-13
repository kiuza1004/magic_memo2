"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMemo,
  clearAllMemos,
  deleteMemo,
  loadMemos,
  updateMemo,
} from "@/lib/storage";
import { describeRange, extractKeywords, parseDateRange, search } from "@/lib/search";
import { isSpeechSupported, Stt } from "@/lib/speech";
import type { Memo } from "@/lib/types";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MemoTab() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [draft, setDraft] = useState("");
  const [draftInterim, setDraftInterim] = useState("");
  const [query, setQuery] = useState("");
  const [queryInterim, setQueryInterim] = useState("");
  const [listening, setListening] = useState<"memo" | "query" | null>(null);
  const [speechErr, setSpeechErr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const sttRef = useRef<Stt | null>(null);

  useEffect(() => {
    setMemos(loadMemos());
  }, []);

  const speechOk = useMemo(() => isSpeechSupported(), []);

  const handleSave = () => {
    const text = draft.trim();
    if (!text) return;
    addMemo(text);
    setDraft("");
    setDraftInterim("");
    setMemos(loadMemos());
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("이 메모를 삭제할까요?")) return;
    deleteMemo(id);
    setMemos(loadMemos());
    if (editingId === id) {
      setEditingId(null);
      setEditingText("");
    }
  };

  const handleStartEdit = (m: Memo) => {
    setEditingId(m.id);
    setEditingText(m.text);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) return;
    updateMemo(editingId, text);
    setMemos(loadMemos());
    setEditingId(null);
    setEditingText("");
  };

  const handleClearAll = () => {
    const count = loadMemos().length;
    if (count === 0) return;
    if (!window.confirm(`저장된 메모 ${count}개를 모두 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;
    if (!window.confirm("정말 모두 삭제합니다. 계속할까요?")) return;
    clearAllMemos();
    setMemos([]);
  };

  const stopListening = () => {
    sttRef.current?.stop();
    sttRef.current = null;
    setListening(null);
    setDraftInterim("");
    setQueryInterim("");
  };

  const handleClearDraft = () => {
    if (listening === "memo") {
      sttRef.current?.stop();
      sttRef.current = null;
      setListening(null);
    }
    setDraft("");
    setDraftInterim("");
  };

  const appendChunk = (prev: string, chunk: string): string => {
    if (!chunk) return prev;
    if (!prev) return chunk;
    return prev.replace(/\s+$/, "") + " " + chunk;
  };

  const startMemoMic = () => {
    setSpeechErr("");
    setDraftInterim("");
    const stt = new Stt({
      onResult: (text) => {
        setDraft((prev) => appendChunk(prev, text));
        setDraftInterim("");
      },
      onPartial: (text) => setDraftInterim(text),
      onFatal: (msg) => {
        setSpeechErr(msg);
        setListening(null);
      },
      onStateChange: (s) => {
        if (s === "idle" && listening === "memo") {
          setListening(null);
          setDraftInterim("");
        }
      },
    });
    sttRef.current = stt;
    stt.start();
    setListening("memo");
  };

  const startQueryMic = () => {
    setSpeechErr("");
    setQueryInterim("");
    const stt = new Stt({
      onResult: (text) => {
        setQuery((prev) => appendChunk(prev, text));
        setQueryInterim("");
      },
      onPartial: (text) => setQueryInterim(text),
      onFatal: (msg) => {
        setSpeechErr(msg);
        setListening(null);
      },
      onStateChange: (s) => {
        if (s === "idle" && listening === "query") {
          setListening(null);
          setQueryInterim("");
        }
      },
    });
    sttRef.current = stt;
    stt.start();
    setListening("query");
  };

  const results = useMemo(() => {
    if (!query.trim()) return null;
    return search(query, memos);
  }, [query, memos]);

  const queryInfo = useMemo(() => {
    if (!query.trim()) return null;
    return {
      range: describeRange(parseDateRange(query)),
      keywords: extractKeywords(query),
    };
  }, [query]);

  return (
    <>
      <section className="bg-card rounded-xl p-4 mb-4 border border-gray-800">
        <label className="block text-xs text-gray-400 mb-2">새 메모</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="예) 마트에서 우유, 계란, 식빵 사기"
          className="w-full bg-bg border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none"
        />
        {draftInterim && (
          <div className="text-xs text-gray-500 mt-1 italic px-1">
            …{draftInterim}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            disabled={!draft.trim()}
            className="flex-1 bg-accent hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg"
          >
            저장
          </button>
          <button
            onClick={handleClearDraft}
            disabled={!draft && listening !== "memo"}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-700 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="입력 지우기"
          >
            지우기
          </button>
          {speechOk && (
            <button
              onClick={listening === "memo" ? stopListening : startMemoMic}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                listening === "memo"
                  ? "bg-red-500/20 border-red-500 text-red-300"
                  : "bg-card border-gray-700 hover:border-gray-500"
              }`}
              aria-label="음성으로 메모"
            >
              {listening === "memo" ? "■ 정지" : "🎙 음성"}
            </button>
          )}
        </div>
      </section>

      <section className="bg-card rounded-xl p-4 mb-4 border border-gray-800">
        <label className="block text-xs text-gray-400 mb-2">검색</label>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={queryInterim ? `…${queryInterim}` : "예) 최근 3일 이내에 마트에서 살 물건"}
            className="flex-1 bg-bg border border-gray-700 rounded-lg px-3 py-2 text-sm"
          />
          {speechOk && (
            <button
              onClick={listening === "query" ? stopListening : startQueryMic}
              className={`px-3 py-2 rounded-lg text-sm border ${
                listening === "query"
                  ? "bg-red-500/20 border-red-500 text-red-300"
                  : "bg-card border-gray-700 hover:border-gray-500"
              }`}
              aria-label="음성으로 검색"
            >
              {listening === "query" ? "■" : "🎙"}
            </button>
          )}
          {query && (
            <button
              onClick={() => setQuery("")}
              className="px-3 py-2 rounded-lg text-sm border border-gray-700 hover:border-gray-500"
            >
              ✕
            </button>
          )}
        </div>
        {queryInfo && (
          <div className="text-xs text-gray-500 mt-2">
            범위: <span className="text-gray-300">{queryInfo.range}</span>
            {queryInfo.keywords.length > 0 && (
              <>
                {" · "}키워드:{" "}
                <span className="text-gray-300">{queryInfo.keywords.join(", ")}</span>
              </>
            )}
          </div>
        )}
      </section>

      {speechErr && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-lg px-3 py-2 mb-4">
          {speechErr}
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm text-gray-400">
            {results ? `검색 결과 (${results.length})` : `전체 메모 (${memos.length})`}
          </h2>
          {!results && memos.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-500/60 rounded px-2 py-1"
              aria-label="전체 메모 삭제"
            >
              전체 삭제
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {(results ? results.map((r) => r.memo) : memos).map((m) => {
            const isEditing = editingId === m.id;
            return (
              <li
                key={m.id}
                className={`bg-card border rounded-lg p-3 ${
                  isEditing ? "border-accent" : "border-gray-800"
                }`}
              >
                <div className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500">
                      {formatDate(m.createdAt)}
                    </div>
                    {isEditing ? (
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full bg-bg border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none mt-1 focus:outline-none focus:border-accent"
                      />
                    ) : (
                      <div className="text-sm text-gray-100 mt-1 whitespace-pre-wrap break-words">
                        {m.text}
                      </div>
                    )}
                    {!isEditing && m.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEdit(m)}
                        className="text-xs text-gray-400 hover:text-accent"
                        aria-label="편집"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-xs text-gray-500 hover:text-red-400"
                        aria-label="삭제"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div className="flex gap-2 mt-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 rounded-lg text-xs border border-gray-700 hover:border-gray-500 text-gray-300"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editingText.trim() || editingText.trim() === m.text}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                      저장
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {(results ? results.length : memos.length) === 0 && (
            <li className="text-sm text-gray-500 text-center py-8">
              {results ? "조건에 맞는 메모가 없습니다." : "아직 메모가 없습니다. 위에서 추가해보세요."}
            </li>
          )}
        </ul>
      </section>
    </>
  );
}

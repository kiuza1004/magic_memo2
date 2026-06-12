"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addMemo, deleteMemo, loadMemos } from "@/lib/storage";
import { describeRange, extractKeywords, parseDateRange, search } from "@/lib/search";
import {
  isSpeechSupported,
  startListening,
  type SpeechHandle,
} from "@/lib/speech";
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

export default function HomePage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState<"memo" | "query" | null>(null);
  const [speechErr, setSpeechErr] = useState("");
  const speechRef = useRef<SpeechHandle | null>(null);
  const draftBaseRef = useRef("");
  const queryBaseRef = useRef("");

  useEffect(() => {
    setMemos(loadMemos());
  }, []);

  const speechOk = useMemo(() => isSpeechSupported(), []);

  const handleSave = () => {
    const text = draft.trim();
    if (!text) return;
    addMemo(text);
    setDraft("");
    setMemos(loadMemos());
  };

  const handleDelete = (id: string) => {
    deleteMemo(id);
    setMemos(loadMemos());
  };

  const handleClearDraft = () => {
    if (listening === "memo") {
      speechRef.current?.stop();
      speechRef.current = null;
      setListening(null);
    }
    draftBaseRef.current = "";
    setDraft("");
  };

  const stopListening = () => {
    speechRef.current?.stop();
    speechRef.current = null;
    setListening(null);
  };

  const mergeBase = (base: string, committed: string, interim: string): string => {
    const live = [committed, interim].filter(Boolean).join(" ").trim();
    if (!base) return live;
    if (!live) return base;
    return `${base.replace(/\s+$/, "")} ${live}`;
  };

  const startMemoMic = () => {
    setSpeechErr("");
    draftBaseRef.current = draft;
    const h = startListening(
      ({ committed, interim }) => {
        setDraft(mergeBase(draftBaseRef.current, committed, interim));
      },
      (err) => {
        setSpeechErr(err);
        setListening(null);
      },
    );
    if (h) {
      speechRef.current = h;
      setListening("memo");
    }
  };

  const startQueryMic = () => {
    setSpeechErr("");
    queryBaseRef.current = "";
    const h = startListening(
      ({ committed, interim }) => {
        setQuery(mergeBase(queryBaseRef.current, committed, interim));
      },
      (err) => {
        setSpeechErr(err);
        setListening(null);
      },
    );
    if (h) {
      speechRef.current = h;
      setListening("query");
    }
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
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Magic Memo</h1>
        <p className="text-sm text-gray-400 mt-1">
          음성·텍스트로 기록하고, 자연어로 다시 찾으세요.
        </p>
      </header>

      <section className="bg-card rounded-xl p-4 mb-4 border border-gray-800">
        <label className="block text-xs text-gray-400 mb-2">새 메모</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="예) 마트에서 우유, 계란, 식빵 사기"
          className="w-full bg-bg border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none"
        />
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
            placeholder="예) 최근 3일 이내에 마트에서 살 물건"
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
        <h2 className="text-sm text-gray-400 mb-2">
          {results ? `검색 결과 (${results.length})` : `전체 메모 (${memos.length})`}
        </h2>
        <ul className="space-y-2">
          {(results ? results.map((r) => r.memo) : memos).map((m) => (
            <li
              key={m.id}
              className="bg-card border border-gray-800 rounded-lg p-3 flex gap-3 items-start"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500">{formatDate(m.createdAt)}</div>
                <div className="text-sm text-gray-100 mt-1 whitespace-pre-wrap break-words">
                  {m.text}
                </div>
                {m.tags.length > 0 && (
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
              <button
                onClick={() => handleDelete(m.id)}
                className="text-xs text-gray-500 hover:text-red-400 shrink-0"
                aria-label="삭제"
              >
                삭제
              </button>
            </li>
          ))}
          {(results ? results.length : memos.length) === 0 && (
            <li className="text-sm text-gray-500 text-center py-8">
              {results ? "조건에 맞는 메모가 없습니다." : "아직 메모가 없습니다. 위에서 추가해보세요."}
            </li>
          )}
        </ul>
      </section>

      <footer className="mt-10 text-center text-xs text-gray-600">
        브라우저 localStorage에 저장됩니다. 데이터는 이 기기에만 보관됩니다.
      </footer>
    </main>
  );
}

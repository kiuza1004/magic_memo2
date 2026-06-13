"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addAnniversary,
  addSchedule,
  deleteAnniversary,
  deleteSchedule,
  loadSchedule,
  saveSchedule,
  updateSchedule,
} from "@/lib/schedule-storage";
import {
  anniversariesForMonth,
  buildMonthGrid,
  downloadBlob,
  formatLunarShort,
  fromCSV,
  isoFromYMD,
  mergeImport,
  parseISO,
  replaceImport,
  schedulesByDate,
  search,
  toCSV,
  todayISO,
  ymd,
} from "@/lib/schedule-helpers";
import type {
  Anniversary,
  Schedule,
  ScheduleData,
  ScheduleHit,
} from "@/lib/schedule-types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Panel = "anniv" | "search" | "io" | null;

export default function ScheduleTab() {
  const [data, setData] = useState<ScheduleData>({
    schedules: [],
    anniversaries: [],
  });
  const [hydrated, setHydrated] = useState(false);

  const today = todayISO();
  const [selected, setSelected] = useState<string>(today);
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const { y, m } = ymd(today);
    return { year: y, month: m };
  });
  const [memoInput, setMemoInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmDel, setConfirmDel] = useState<
    | { kind: "schedule"; id: string }
    | { kind: "anniversary"; id: string }
    | null
  >(null);

  useEffect(() => {
    setData(loadSchedule());
    setHydrated(true);
  }, []);

  const persist = (next: ScheduleData) => {
    setData(next);
    saveSchedule(next);
  };

  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor],
  );
  const schedMap = useMemo(
    () => schedulesByDate(data.schedules),
    [data.schedules],
  );
  const annMap = useMemo(
    () => anniversariesForMonth(data.anniversaries, cursor.year, cursor.month),
    [data.anniversaries, cursor],
  );
  const selectedSchedules = data.schedules
    .filter((s) => s.date === selected)
    .sort((a, b) => a.createdAt - b.createdAt);
  const selectedAnniversaries = useMemo(() => {
    const { m, d } = ymd(selected);
    return data.anniversaries.filter((a) => a.month === m && a.day === d);
  }, [data.anniversaries, selected]);

  const gotoMonth = (delta: number) => {
    let y = cursor.year;
    let m = cursor.month + delta;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    setCursor({ year: y, month: m });
  };

  const gotoToday = () => {
    const { y, m } = ymd(today);
    setCursor({ year: y, month: m });
    setSelected(today);
  };

  const submitMemo = () => {
    const memo = memoInput.trim();
    if (!memo) return;
    if (editingId) {
      persist(updateSchedule(data, editingId, { memo, date: selected }));
      setEditingId(null);
    } else {
      persist(addSchedule(data, { date: selected, memo }));
    }
    setMemoInput("");
  };

  const startEdit = (s: Schedule) => {
    setEditingId(s.id);
    setMemoInput(s.memo);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setMemoInput("");
  };

  const doDelete = () => {
    if (!confirmDel) return;
    if (confirmDel.kind === "schedule") {
      persist(deleteSchedule(data, confirmDel.id));
      if (editingId === confirmDel.id) cancelEdit();
    } else {
      persist(deleteAnniversary(data, confirmDel.id));
    }
    setConfirmDel(null);
  };

  if (!hydrated) {
    return <div className="text-gray-500 text-sm">로딩…</div>;
  }

  const lunarSel = (() => {
    const { y, m, d } = ymd(selected);
    return formatLunarShort(y, m, d);
  })();

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between bg-card border border-gray-800 rounded-xl p-3">
        <button
          onClick={() => gotoMonth(-1)}
          className="px-3 py-1 rounded-lg hover:bg-bg text-gray-300"
          aria-label="이전 달"
        >
          ‹
        </button>
        <div className="text-base font-semibold">
          {cursor.year}년 {cursor.month}월
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={gotoToday}
            className="px-2 py-1 text-xs rounded-lg bg-bg hover:bg-gray-800 text-gray-300"
          >
            오늘
          </button>
          <button
            onClick={() => gotoMonth(1)}
            className="px-3 py-1 rounded-lg hover:bg-bg text-gray-300"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-gray-800 rounded-xl p-2">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`text-center text-xs py-1 ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
              }`}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((c) => {
            const isSelected = c.date === selected;
            const isToday = c.date === today;
            const schedCount = schedMap.get(c.date)?.length ?? 0;
            const annCount = annMap.get(c.date)?.length ?? 0;
            const { y, m, d } = ymd(c.date);
            const lunar = c.inMonth ? formatLunarShort(y, m, d) : "";
            return (
              <button
                key={c.date}
                onClick={() => setSelected(c.date)}
                className={`relative aspect-square rounded-lg text-left p-1 border transition-colors ${
                  isSelected
                    ? "border-accent bg-accent/15"
                    : "border-transparent hover:bg-bg"
                } ${!c.inMonth ? "opacity-40" : ""}`}
              >
                <div
                  className={`text-sm font-medium ${
                    isToday ? "text-accent" : c.weekday === 0
                      ? "text-red-400"
                      : c.weekday === 6
                        ? "text-blue-400"
                        : "text-gray-200"
                  }`}
                >
                  {c.day}
                </div>
                {lunar && (
                  <div className="text-[10px] text-gray-500 leading-tight">
                    {lunar}
                  </div>
                )}
                {(schedCount > 0 || annCount > 0) && (
                  <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 justify-start">
                    {schedCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                    {annCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date detail */}
      <div className="bg-card border border-gray-800 rounded-xl p-3 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-base font-semibold">{selected}</div>
            {lunarSel && (
              <div className="text-xs text-gray-500">음력 {lunarSel}</div>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {selectedSchedules.length}건 일정
            {selectedAnniversaries.length > 0 &&
              ` · ${selectedAnniversaries.length}건 기념일`}
          </div>
        </div>

        {selectedAnniversaries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedAnniversaries.map((a) => (
              <span
                key={a.id}
                className="text-xs px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30"
              >
                🎉 {a.content}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={memoInput}
            onChange={(e) => setMemoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitMemo();
            }}
            placeholder="일정 메모 입력…"
            className="flex-1 bg-bg border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <button
            onClick={submitMemo}
            disabled={!memoInput.trim()}
            className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40"
          >
            {editingId ? "수정" : "추가"}
          </button>
          {editingId && (
            <button
              onClick={cancelEdit}
              className="px-3 py-2 rounded-lg bg-bg border border-gray-800 text-sm text-gray-300"
            >
              취소
            </button>
          )}
        </div>

        <ul className="space-y-1">
          {selectedSchedules.length === 0 ? (
            <li className="text-xs text-gray-500 py-2">
              이 날짜에 등록된 일정이 없습니다.
            </li>
          ) : (
            selectedSchedules.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 bg-bg border border-gray-800 rounded-lg px-3 py-2"
              >
                <span className="text-sm flex-1 break-words">{s.memo}</span>
                <button
                  onClick={() => startEdit(s)}
                  className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1"
                >
                  편집
                </button>
                <button
                  onClick={() => setConfirmDel({ kind: "schedule", id: s.id })}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                >
                  삭제
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Panel toggles */}
      <div className="flex gap-2 text-sm">
        <PanelButton
          active={panel === "anniv"}
          onClick={() => setPanel(panel === "anniv" ? null : "anniv")}
        >
          🎉 기념일
        </PanelButton>
        <PanelButton
          active={panel === "search"}
          onClick={() => setPanel(panel === "search" ? null : "search")}
        >
          🔍 검색
        </PanelButton>
        <PanelButton
          active={panel === "io"}
          onClick={() => setPanel(panel === "io" ? null : "io")}
        >
          📦 가져오기/내보내기
        </PanelButton>
      </div>

      {panel === "anniv" && (
        <AnniversaryPanel
          anniversaries={data.anniversaries}
          onAdd={(month, day, content) =>
            persist(addAnniversary(data, { month, day, content }))
          }
          onDelete={(id) => setConfirmDel({ kind: "anniversary", id })}
        />
      )}
      {panel === "search" && (
        <SearchPanel
          data={data}
          onJump={(date) => {
            const { y, m } = ymd(date);
            setCursor({ year: y, month: m });
            setSelected(date);
            setPanel(null);
          }}
        />
      )}
      {panel === "io" && (
        <IOPanel
          data={data}
          onMerge={(incoming) => persist(mergeImport(data, incoming))}
          onReplace={(incoming) => persist(replaceImport(incoming))}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          message={
            confirmDel.kind === "schedule"
              ? "이 일정을 삭제할까요?"
              : "이 기념일을 삭제할까요?"
          }
          onCancel={() => setConfirmDel(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

function PanelButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg border transition-colors ${
        active
          ? "border-accent bg-accent/15 text-white"
          : "border-gray-800 bg-card text-gray-300 hover:bg-bg"
      }`}
    >
      {children}
    </button>
  );
}

function AnniversaryPanel({
  anniversaries,
  onAdd,
  onDelete,
}: {
  anniversaries: Anniversary[];
  onAdd: (month: number, day: number, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [content, setContent] = useState("");

  const submit = () => {
    const c = content.trim();
    if (!c) return;
    onAdd(month, day, c);
    setContent("");
  };

  const sorted = [...anniversaries].sort((a, b) =>
    a.month === b.month ? a.day - b.day : a.month - b.month,
  );

  return (
    <div className="bg-card border border-gray-800 rounded-xl p-3 space-y-3">
      <div className="flex gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="bg-bg border border-gray-800 rounded-lg px-2 py-2 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="bg-bg border border-gray-800 rounded-lg px-2 py-2 text-sm"
        >
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}일
            </option>
          ))}
        </select>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="기념일 이름"
          className="flex-1 bg-bg border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
        <button
          onClick={submit}
          disabled={!content.trim()}
          className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40"
        >
          추가
        </button>
      </div>
      <ul className="space-y-1">
        {sorted.length === 0 ? (
          <li className="text-xs text-gray-500 py-2">
            등록된 기념일이 없습니다. 매년 자동으로 반복 표시됩니다.
          </li>
        ) : (
          sorted.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 bg-bg border border-gray-800 rounded-lg px-3 py-2"
            >
              <span className="text-sm">
                <span className="text-pink-400 font-medium">
                  {a.month}/{a.day}
                </span>{" "}
                {a.content}
              </span>
              <button
                onClick={() => onDelete(a.id)}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
              >
                삭제
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function SearchPanel({
  data,
  onJump,
}: {
  data: ScheduleData;
  onJump: (date: string) => void;
}) {
  const today = todayISO();
  const defaultFrom = (() => {
    const d = parseISO(today);
    d.setMonth(d.getMonth() - 3);
    return isoFromYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
  })();
  const defaultTo = (() => {
    const d = parseISO(today);
    d.setMonth(d.getMonth() + 3);
    return isoFromYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
  })();

  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [hits, setHits] = useState<ScheduleHit[] | null>(null);

  const run = () => {
    if (from > to) return;
    setHits(search(data, query, from, to));
  };

  return (
    <div className="bg-card border border-gray-800 rounded-xl p-3 space-y-3">
      <div className="flex gap-2 items-center text-sm">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="bg-bg border border-gray-800 rounded-lg px-2 py-2 flex-1 min-w-0"
        />
        <span className="text-gray-500">~</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-bg border border-gray-800 rounded-lg px-2 py-2 flex-1 min-w-0"
        />
      </div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="키워드 (비워두면 범위 내 전체)"
          className="flex-1 bg-bg border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
        <button
          onClick={run}
          className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium"
        >
          검색
        </button>
      </div>
      {hits !== null && (
        <ul className="space-y-1">
          {hits.length === 0 ? (
            <li className="text-xs text-gray-500 py-2">결과가 없습니다.</li>
          ) : (
            hits.map((h, i) => (
              <li
                key={i}
                className="bg-bg border border-gray-800 rounded-lg px-3 py-2"
              >
                <button
                  onClick={() => onJump(h.date)}
                  className="w-full text-left"
                >
                  <div className="text-xs text-gray-400">{h.date}</div>
                  <div className="text-sm">
                    {h.kind === "schedule" ? (
                      h.schedule.memo
                    ) : (
                      <span className="text-pink-300">
                        🎉 {h.anniversary.content}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function IOPanel({
  data,
  onMerge,
  onReplace,
}: {
  data: ScheduleData;
  onMerge: (incoming: ReturnType<typeof fromCSV>) => void;
  onReplace: (incoming: ReturnType<typeof fromCSV>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ReturnType<typeof fromCSV> | null>(null);

  const exportCSV = () => {
    const ts = todayISO();
    downloadBlob(toCSV(data), `schedule-${ts}.csv`, "text/csv;charset=utf-8");
  };

  const exportJSON = () => {
    const ts = todayISO();
    const payload = JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), ...data },
      null,
      2,
    );
    downloadBlob(payload, `schedule-${ts}.json`, "application/json");
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".json")) {
      try {
        const obj = JSON.parse(text);
        const schedules = Array.isArray(obj.schedules)
          ? obj.schedules.map((s: Schedule) => ({ date: s.date, memo: s.memo }))
          : [];
        const anniversaries = Array.isArray(obj.anniversaries)
          ? obj.anniversaries.map((a: Anniversary) => ({
              month: a.month,
              day: a.day,
              content: a.content,
            }))
          : [];
        setPending({ schedules, anniversaries });
      } catch {
        alert("JSON 파일을 읽을 수 없습니다.");
      }
    } else {
      setPending(fromCSV(text));
    }
  };

  return (
    <div className="bg-card border border-gray-800 rounded-xl p-3 space-y-3">
      <div className="flex gap-2">
        <button
          onClick={exportCSV}
          className="flex-1 px-3 py-2 rounded-lg bg-bg border border-gray-800 text-sm text-gray-200 hover:bg-gray-800"
        >
          CSV 내보내기
        </button>
        <button
          onClick={exportJSON}
          className="flex-1 px-3 py-2 rounded-lg bg-bg border border-gray-800 text-sm text-gray-200 hover:bg-gray-800"
        >
          JSON 내보내기
        </button>
      </div>
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,application/json,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium"
        >
          파일 선택해서 가져오기
        </button>
        <p className="text-xs text-gray-500 mt-1">
          CSV(섹션 마커 =SCHEDULES=, =ANNIVERSARIES=) 또는 JSON 지원
        </p>
      </div>

      {pending && (
        <div className="bg-bg border border-accent/40 rounded-lg p-3 space-y-2">
          <div className="text-sm">
            가져올 항목: 일정 <b>{pending.schedules.length}</b>건 · 기념일{" "}
            <b>{pending.anniversaries.length}</b>건
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onMerge(pending);
                setPending(null);
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-accent text-white text-sm"
            >
              병합 (중복 제외 추가)
            </button>
            <button
              onClick={() => {
                if (confirm("기존 일정·기념일을 모두 삭제하고 덮어씁니다. 진행할까요?")) {
                  onReplace(pending);
                  setPending(null);
                }
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm"
            >
              전체 덮어쓰기
            </button>
            <button
              onClick={() => setPending(null)}
              className="px-3 py-2 rounded-lg bg-bg border border-gray-800 text-sm text-gray-300"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-card border border-gray-700 rounded-xl p-4 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-bg border border-gray-800 text-sm text-gray-300"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

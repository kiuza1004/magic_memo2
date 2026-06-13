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
  type ScheduleInput,
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
import {
  ALARM_BEFORE_OPTIONS,
  ALARM_SOUND_OPTIONS,
  ALARM_TYPE_OPTIONS,
  type AlarmBefore,
  type AlarmSound,
  type AlarmType,
  type Anniversary,
  type Schedule,
  type ScheduleData,
  type ScheduleHit,
} from "@/lib/schedule-types";

// ---------- 원본 색상 팔레트 ----------
const C = {
  primary: "#4A90D9",
  bg: "#F0F4FA",
  card: "#ffffff",
  cardSoft: "#F5F7FA",
  inputBg: "#FAFBFD",
  inputBorder: "#DDE3EE",
  text: "#333",
  textMute: "#666",
  textSoft: "#888",
  divider: "#EEE",
  sunday: "#E53935",
  saturday: "#1565C0",
  schedDot: "#FF7043",
  annivDot: "#FB8C00",
  annivBg: "#FFF3E0",
  annivBorder: "#FFB74D",
  annivText: "#E65100",
  selBg: "#EAF2FF",
  schedItemBg: "#F0F4FF",
  annivItemBg: "#F3E5F5",
  annivItemText: "#6A1B9A",
  annivBtn: "#7B1FA2",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const PAGE_SIZE = 10;

type ConfirmDel =
  | { kind: "schedule"; id: string }
  | { kind: "anniversary"; id: string }
  | null;

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

  const [openMemo, setOpenMemo] = useState(true);
  const [openAnniv, setOpenAnniv] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openIO, setOpenIO] = useState(false);

  const [confirmDel, setConfirmDel] = useState<ConfirmDel>(null);

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

  const doDelete = () => {
    if (!confirmDel) return;
    if (confirmDel.kind === "schedule") {
      persist(deleteSchedule(data, confirmDel.id));
    } else {
      persist(deleteAnniversary(data, confirmDel.id));
    }
    setConfirmDel(null);
  };

  if (!hydrated) {
    return <div className="p-4 text-sm" style={{ color: C.textMute }}>로딩…</div>;
  }

  return (
    <div className="px-3 py-3 max-w-2xl mx-auto space-y-3" style={{ color: C.text }}>
      <CalendarCard
        cursor={cursor}
        selected={selected}
        today={today}
        grid={grid}
        schedMap={schedMap}
        annMap={annMap}
        onPick={setSelected}
        onPrev={() => gotoMonth(-1)}
        onNext={() => gotoMonth(1)}
        onToday={gotoToday}
      />

      <AccordionCard
        title="📝 일정 메모 입력"
        open={openMemo}
        onToggle={() => setOpenMemo(!openMemo)}
      >
        <MemoPanel
          selected={selected}
          data={data}
          onAdd={(input) => persist(addSchedule(data, input))}
          onUpdate={(id, patch) => persist(updateSchedule(data, id, patch))}
          onDelete={(id) => setConfirmDel({ kind: "schedule", id })}
        />
      </AccordionCard>

      <AccordionCard
        title="🎉 기념일 등록"
        open={openAnniv}
        onToggle={() => setOpenAnniv(!openAnniv)}
      >
        <AnniversaryPanel
          anniversaries={data.anniversaries}
          onAdd={(m, d, c) => persist(addAnniversary(data, { month: m, day: d, content: c }))}
          onDelete={(id) => setConfirmDel({ kind: "anniversary", id })}
        />
      </AccordionCard>

      <AccordionCard
        title="🔍 전체 일정 검색"
        open={openSearch}
        onToggle={() => setOpenSearch(!openSearch)}
      >
        <SearchPanel
          data={data}
          onJump={(date) => {
            const { y, m } = ymd(date);
            setCursor({ year: y, month: m });
            setSelected(date);
            setOpenSearch(false);
            setOpenMemo(true);
          }}
        />
      </AccordionCard>

      <AccordionCard
        title="📤 내보내기 / 가져오기"
        open={openIO}
        onToggle={() => setOpenIO(!openIO)}
      >
        <IOPanel
          data={data}
          onMerge={(incoming) => persist(mergeImport(data, incoming))}
          onReplace={(incoming) => persist(replaceImport(incoming))}
        />
      </AccordionCard>

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

// ============================================================
// Calendar
// ============================================================
function CalendarCard({
  cursor,
  selected,
  today,
  grid,
  schedMap,
  annMap,
  onPick,
  onPrev,
  onNext,
  onToday,
}: {
  cursor: { year: number; month: number };
  selected: string;
  today: string;
  grid: ReturnType<typeof buildMonthGrid>;
  schedMap: Map<string, Schedule[]>;
  annMap: Map<string, Anniversary[]>;
  onPick: (d: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div
      className="rounded-xl p-3 shadow-sm"
      style={{ background: C.card, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onPrev}
          className="px-3 py-1 rounded-md text-base"
          style={{ color: C.text }}
          aria-label="이전 달"
        >
          ◀
        </button>
        <div className="text-base font-bold" style={{ color: C.text }}>
          {cursor.year}년 {String(cursor.month).padStart(2, "0")}월
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToday}
            className="px-2.5 py-1 rounded-md text-xs font-semibold"
            style={{ background: C.primary, color: "#fff" }}
          >
            당일
          </button>
          <button
            onClick={onNext}
            className="px-3 py-1 rounded-md text-base"
            style={{ color: C.text }}
            aria-label="다음 달"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className="text-center text-xs py-1 font-medium"
            style={{
              color: i === 0 ? C.sunday : i === 6 ? C.saturday : C.textMute,
            }}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((c) => {
          const isSelected = c.date === selected;
          const isToday = c.date === today;
          const scheds = schedMap.get(c.date) ?? [];
          const anns = annMap.get(c.date) ?? [];
          const hasAnn = anns.length > 0;
          const { y, m, d } = ymd(c.date);
          const lunar = c.inMonth ? formatLunarShort(y, m, d) : "";

          let cellBg = "transparent";
          let cellBorder = "1px solid transparent";
          if (hasAnn) {
            cellBg = C.annivBg;
            cellBorder = `1px solid ${C.annivBorder}`;
          }
          if (isSelected) {
            if (hasAnn) {
              cellBg = "#FFE0B2";
              cellBorder = `1.5px solid ${C.annivDot}`;
            } else {
              cellBg = C.selBg;
              cellBorder = `1.5px solid ${C.primary}`;
            }
          }

          const dayColor =
            c.weekday === 0 ? C.sunday : c.weekday === 6 ? C.saturday : C.text;

          return (
            <button
              key={c.date}
              onClick={() => onPick(c.date)}
              className="relative rounded-md p-1 text-left flex flex-col items-stretch"
              style={{
                background: cellBg,
                border: cellBorder,
                opacity: c.inMonth ? 1 : 0.35,
                minHeight: 62,
              }}
            >
              <div className="flex items-center justify-center mb-0.5">
                {isToday ? (
                  <span
                    className="rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                    style={{ background: C.primary, color: "#fff" }}
                  >
                    {c.day}
                  </span>
                ) : (
                  <span
                    className="text-sm font-medium"
                    style={{ color: dayColor }}
                  >
                    {c.day}
                  </span>
                )}
              </div>
              {lunar && (
                <div
                  className="text-center leading-tight"
                  style={{ fontSize: 9, color: C.textSoft }}
                >
                  {lunar}
                </div>
              )}
              {hasAnn && (
                <div
                  className="truncate text-center leading-tight"
                  style={{ fontSize: 9, color: C.annivText }}
                >
                  🎉{anns[0].content}
                </div>
              )}
              {scheds.length > 0 && (
                <div className="flex gap-0.5 justify-center mt-auto pt-0.5">
                  <span
                    className="rounded-full"
                    style={{
                      width: 5,
                      height: 5,
                      background: C.schedDot,
                    }}
                  />
                  {scheds.length > 1 && (
                    <span
                      className="text-[8px]"
                      style={{ color: C.schedDot }}
                    >
                      +{scheds.length - 1}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Accordion shell
// ============================================================
function AccordionCard({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden shadow-sm"
      style={{ background: C.card, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-3"
        style={{ background: C.cardSoft }}
      >
        <span className="text-sm font-bold" style={{ color: C.text }}>
          {title}
        </span>
        <span style={{ color: C.textSoft }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

// ============================================================
// MemoPanel — selected date schedule CRUD + alarm UI
// ============================================================
function MemoPanel({
  selected,
  data,
  onAdd,
  onUpdate,
  onDelete,
}: {
  selected: string;
  data: ScheduleData;
  onAdd: (input: ScheduleInput) => void;
  onUpdate: (id: string, patch: Partial<ScheduleInput>) => void;
  onDelete: (id: string) => void;
}) {
  const [memo, setMemo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmHour, setAlarmHour] = useState("09");
  const [alarmMin, setAlarmMin] = useState("00");
  const [alarmBefore, setAlarmBefore] = useState<AlarmBefore>("none");
  const [alarmType, setAlarmType] = useState<AlarmType>("sound");
  const [alarmSound, setAlarmSound] = useState<AlarmSound>("default");

  const selectedDay = useMemo(() => {
    const { y, m, d } = ymd(selected);
    const dow = new Date(y, m - 1, d).getDay();
    return { lunar: formatLunarShort(y, m, d), dow };
  }, [selected]);

  const daySchedules = data.schedules
    .filter((s) => s.date === selected)
    .sort((a, b) => a.createdAt - b.createdAt);
  const dayAnniversaries = useMemo(() => {
    const { m, d } = ymd(selected);
    return data.anniversaries.filter((a) => a.month === m && a.day === d);
  }, [data.anniversaries, selected]);

  const resetForm = () => {
    setMemo("");
    setEditingId(null);
    setAlarmEnabled(false);
    setAlarmHour("09");
    setAlarmMin("00");
    setAlarmBefore("none");
    setAlarmType("sound");
    setAlarmSound("default");
  };

  const startEdit = (s: Schedule) => {
    setEditingId(s.id);
    setMemo(s.memo);
    setAlarmEnabled(!!s.alarmEnabled);
    if (s.alarmTime) {
      const [h, m] = s.alarmTime.split(":");
      setAlarmHour(h);
      setAlarmMin(m);
    } else {
      setAlarmHour("09");
      setAlarmMin("00");
    }
    setAlarmBefore(s.alarmBefore ?? "none");
    setAlarmType(s.alarmType ?? "sound");
    setAlarmSound(s.alarmSound ?? "default");
  };

  const submit = () => {
    const text = memo.trim();
    if (!text) return;
    const input: ScheduleInput = {
      date: selected,
      memo: text,
      alarmEnabled,
      alarmTime: alarmEnabled ? `${alarmHour}:${alarmMin}` : null,
      alarmBefore,
      alarmType,
      alarmSound,
    };
    if (editingId) onUpdate(editingId, input);
    else onAdd(input);
    resetForm();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold" style={{ color: C.primary }}>
          {selected}
        </span>
        {selectedDay.lunar && (
          <span className="text-xs" style={{ color: C.textSoft }}>
            음력 {selectedDay.lunar}
          </span>
        )}
      </div>

      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="메모를 입력하세요"
        rows={3}
        className="w-full rounded-md px-3 py-2 text-sm resize-none focus:outline-none"
        style={{
          background: C.inputBg,
          border: `1px solid ${C.inputBorder}`,
          color: C.text,
        }}
      />

      {/* 알람 설정 */}
      <div className="space-y-2">
        <Row label="알람 설정">
          <Switch checked={alarmEnabled} onChange={setAlarmEnabled} />
        </Row>
        {alarmEnabled && (
          <>
            <Row label="알람 시간">
              <div className="flex items-center gap-1">
                <Select
                  value={alarmHour}
                  onChange={setAlarmHour}
                  options={Array.from({ length: 24 }, (_, i) => ({
                    value: String(i).padStart(2, "0"),
                    label: `${String(i).padStart(2, "0")}시`,
                  }))}
                />
                <Select
                  value={alarmMin}
                  onChange={setAlarmMin}
                  options={[0, 10, 20, 30, 40, 50].map((n) => ({
                    value: String(n).padStart(2, "0"),
                    label: `${String(n).padStart(2, "0")}분`,
                  }))}
                />
              </div>
            </Row>
            <Row label="사전 알림">
              <Select
                value={alarmBefore}
                onChange={(v) => setAlarmBefore(v as AlarmBefore)}
                options={ALARM_BEFORE_OPTIONS}
              />
            </Row>
            <Row label="알림 방식">
              <Select
                value={alarmType}
                onChange={(v) => setAlarmType(v as AlarmType)}
                options={ALARM_TYPE_OPTIONS}
              />
            </Row>
            <Row label="알림 소리">
              <Select
                value={alarmSound}
                onChange={(v) => setAlarmSound(v as AlarmSound)}
                options={ALARM_SOUND_OPTIONS}
              />
            </Row>
            {alarmSound === "recorded" && (
              <div
                className="rounded-md px-3 py-2 text-xs"
                style={{
                  background: "#FFF3E0",
                  border: "1px solid #FFB74D",
                  color: "#BF360C",
                }}
              >
                ⚠ 웹에서는 녹음 기능을 지원하지 않습니다. 기본음으로 대체됩니다.
              </div>
            )}
            <div
              className="text-[11px] px-1"
              style={{ color: C.textSoft }}
            >
              ※ 웹은 백그라운드 알람을 보낼 수 없습니다. 설정은 저장되며,
              실제 발화는 추후 지원 예정.
            </div>
          </>
        )}
      </div>

      {/* 저장 / 취소 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!memo.trim()}
          className="flex-1 py-2 rounded-md text-sm font-semibold disabled:opacity-40"
          style={{ background: C.primary, color: "#fff" }}
        >
          {editingId ? "일정 수정" : "일정 저장"}
        </button>
        {editingId && (
          <button
            onClick={resetForm}
            className="px-4 py-2 rounded-md text-sm"
            style={{
              border: `1px solid ${C.inputBorder}`,
              color: C.textMute,
              background: C.card,
            }}
          >
            취소
          </button>
        )}
      </div>

      {/* 등록된 일정 / 기념일 목록 */}
      {(dayAnniversaries.length > 0 || daySchedules.length > 0) && (
        <div
          className="pt-3 mt-2 space-y-1"
          style={{ borderTop: `1px solid ${C.divider}` }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: C.textMute }}>
            이 날의 항목
          </div>
          {dayAnniversaries.map((a) => (
            <div
              key={a.id}
              className="rounded-md px-3 py-2 text-sm"
              style={{
                background: C.annivItemBg,
                color: C.annivItemText,
              }}
            >
              🎉 {a.content}
            </div>
          ))}
          {daySchedules.map((s) => (
            <div
              key={s.id}
              className="rounded-md px-3 py-2 flex items-start gap-2"
              style={{
                background: C.schedItemBg,
                border:
                  editingId === s.id
                    ? `1.5px solid ${C.primary}`
                    : "1px solid transparent",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ color: C.text, whiteSpace: "pre-wrap" }}>
                  {s.memo}
                </div>
                {s.alarmEnabled && s.alarmTime && (
                  <div
                    className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "#FFF3E0",
                      color: C.annivText,
                    }}
                  >
                    🔔 {s.alarmTime}
                    {s.alarmBefore && s.alarmBefore !== "none"
                      ? ` · ${labelOf(ALARM_BEFORE_OPTIONS, s.alarmBefore)}`
                      : ""}
                  </div>
                )}
              </div>
              <button
                onClick={() => startEdit(s)}
                className="text-xs px-2 py-1 rounded-md"
                style={{ color: C.primary }}
              >
                편집
              </button>
              <button
                onClick={() => onDelete(s.id)}
                className="text-xs px-2 py-1 rounded-md"
                style={{ color: C.sunday }}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function labelOf<T extends string>(
  opts: { value: T; label: string }[],
  v: T,
): string {
  return opts.find((o) => o.value === v)?.label ?? v;
}

// ============================================================
// AnniversaryPanel
// ============================================================
function AnniversaryPanel({
  anniversaries,
  onAdd,
  onDelete,
}: {
  anniversaries: Anniversary[];
  onAdd: (m: number, d: number, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [content, setContent] = useState("");
  const [showList, setShowList] = useState(false);

  const daysInMonth = new Date(2024, month, 0).getDate();
  const sorted = [...anniversaries].sort((a, b) =>
    a.month === b.month ? a.day - b.day : a.month - b.month,
  );

  const submit = () => {
    const c = content.trim();
    if (!c) return;
    onAdd(month, day, c);
    setContent("");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <Select
          value={String(month)}
          onChange={(v) => {
            setMonth(Number(v));
            if (day > new Date(2024, Number(v), 0).getDate()) setDay(1);
          }}
          options={Array.from({ length: 12 }, (_, i) => ({
            value: String(i + 1),
            label: `${i + 1}월`,
          }))}
        />
        <Select
          value={String(day)}
          onChange={(v) => setDay(Number(v))}
          options={Array.from({ length: daysInMonth }, (_, i) => ({
            value: String(i + 1),
            label: `${i + 1}일`,
          }))}
        />
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="내용 (예: 결혼기념일)"
          className="flex-1 min-w-0 rounded-md px-3 py-2 text-sm focus:outline-none"
          style={{
            background: C.inputBg,
            border: `1px solid ${C.inputBorder}`,
            color: C.text,
          }}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!content.trim()}
          className="flex-1 py-2 rounded-md text-sm font-semibold disabled:opacity-40"
          style={{ background: C.annivBtn, color: "#fff" }}
        >
          기념일 추가
        </button>
        <button
          onClick={() => setShowList(!showList)}
          className="flex-1 py-2 rounded-md text-sm font-semibold"
          style={{
            border: `1px solid ${C.annivBtn}`,
            color: C.annivBtn,
            background: C.card,
          }}
        >
          기념일 내역 ({sorted.length})
        </button>
      </div>
      {showList && (
        <div
          className="pt-2"
          style={{ borderTop: `1px solid ${C.divider}` }}
        >
          {sorted.length === 0 ? (
            <div className="text-xs py-3 text-center" style={{ color: C.textSoft }}>
              등록된 기념일이 없습니다.
            </div>
          ) : (
            <ul className="space-y-1">
              {sorted.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: `1px solid ${C.divider}` }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{ color: C.annivBtn, minWidth: 44 }}
                  >
                    {String(a.month).padStart(2, "0")}/{String(a.day).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-sm" style={{ color: C.text }}>
                    {a.content}
                  </span>
                  <button
                    onClick={() => onDelete(a.id)}
                    className="text-base"
                    style={{ color: C.sunday }}
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SearchPanel
// ============================================================
function SearchPanel({
  data,
  onJump,
}: {
  data: ScheduleData;
  onJump: (date: string) => void;
}) {
  const today = todayISO();
  const defaults = useMemo(() => {
    const from = parseISO(today);
    from.setMonth(from.getMonth() - 3);
    const to = parseISO(today);
    to.setMonth(to.getMonth() + 3);
    return {
      from: isoFromYMD(from.getFullYear(), from.getMonth() + 1, from.getDate()),
      to: isoFromYMD(to.getFullYear(), to.getMonth() + 1, to.getDate()),
    };
  }, [today]);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ScheduleHit[] | null>(null);
  const [page, setPage] = useState(1);

  const run = () => {
    if (from > to) {
      alert("시작일이 종료일보다 늦을 수 없습니다.");
      return;
    }
    setHits(search(data, q, from, to));
    setPage(1);
  };

  const totalPages = hits ? Math.max(1, Math.ceil(hits.length / PAGE_SIZE)) : 1;
  const pageHits = hits ? hits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];

  return (
    <div className="space-y-3">
      <Row label="기간">
        <div className="flex items-center gap-1 w-full">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md px-2 py-1.5 text-sm flex-1 min-w-0 focus:outline-none"
            style={{
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              color: C.text,
            }}
          />
          <span style={{ color: C.textSoft }}>~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md px-2 py-1.5 text-sm flex-1 min-w-0 focus:outline-none"
            style={{
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              color: C.text,
            }}
          />
        </div>
      </Row>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="키워드 입력 (선택)"
          className="flex-1 rounded-md px-3 py-2 text-sm focus:outline-none"
          style={{
            background: C.inputBg,
            border: `1px solid ${C.inputBorder}`,
            color: C.text,
          }}
        />
        <button
          onClick={run}
          className="px-4 py-2 rounded-md text-sm font-semibold"
          style={{ background: C.primary, color: "#fff" }}
        >
          검색
        </button>
      </div>

      {hits !== null && (
        <>
          <div className="text-xs" style={{ color: C.textMute }}>
            총 {hits.length}건{hits.length > 0 && ` (${page}/${totalPages} 페이지)`}
          </div>
          {pageHits.length === 0 ? (
            <div
              className="text-center text-xs py-6"
              style={{ color: C.textSoft }}
            >
              결과가 없습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {pageHits.map((h, i) => (
                <li key={i}>
                  <button
                    onClick={() => onJump(h.date)}
                    className="w-full text-left rounded-md p-3"
                    style={{
                      background: h.kind === "schedule" ? "#F8F9FF" : C.annivBg,
                      borderLeft:
                        h.kind === "anniversary"
                          ? `3px solid ${C.annivDot}`
                          : `3px solid ${C.primary}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-bold"
                        style={{
                          color:
                            h.kind === "schedule" ? C.primary : C.annivText,
                        }}
                      >
                        {h.date}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background:
                            h.kind === "schedule" ? "#E3F2FD" : "#FFE0B2",
                          color:
                            h.kind === "schedule" ? "#1565C0" : C.annivText,
                        }}
                      >
                        {h.kind === "schedule" ? "📝 일정" : "🎉 기념일"}
                      </span>
                    </div>
                    <div className="text-sm" style={{ color: C.text }}>
                      {h.kind === "schedule"
                        ? h.schedule.memo
                        : h.anniversary.content}
                    </div>
                    {h.kind === "schedule" &&
                      h.schedule.alarmEnabled &&
                      h.schedule.alarmTime && (
                        <div
                          className="text-[11px] mt-1"
                          style={{ color: C.annivText }}
                        >
                          🔔 {h.schedule.alarmTime}
                        </div>
                      )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hits.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-md text-sm disabled:opacity-40"
                style={{
                  background: page === 1 ? "#CCC" : C.primary,
                  color: "#fff",
                }}
              >
                이전
              </button>
              <span className="text-xs" style={{ color: C.textMute }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-md text-sm disabled:opacity-40"
                style={{
                  background: page === totalPages ? "#CCC" : C.primary,
                  color: "#fff",
                }}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// IOPanel
// ============================================================
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

  const totalCount = data.schedules.length + data.anniversaries.length;

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
    <div className="space-y-3">
      <div>
        <div
          className="text-xs font-semibold mb-1.5"
          style={{ color: C.textMute }}
        >
          내보내기 · 전체 {totalCount}건
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex-1 py-3 rounded-md text-sm font-semibold"
            style={{ background: "#E8F5E9", color: "#2E7D32" }}
          >
            📊 CSV
            <div className="text-[10px] font-normal">(엑셀)</div>
          </button>
          <button
            onClick={exportJSON}
            className="flex-1 py-3 rounded-md text-sm font-semibold"
            style={{ background: "#E3F2FD", color: "#1565C0" }}
          >
            💾 JSON
            <div className="text-[10px] font-normal">(백업)</div>
          </button>
        </div>
      </div>

      <div>
        <div
          className="text-xs font-semibold mb-1.5"
          style={{ color: C.textMute }}
        >
          가져오기 · CSV 또는 JSON 파일을 선택하세요
        </div>
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
          className="w-full py-2.5 rounded-md text-sm font-semibold"
          style={{ background: C.primary, color: "#fff" }}
        >
          📂 파일 선택하여 가져오기
        </button>
        <div
          className="text-[11px] mt-1 text-center"
          style={{ color: C.textSoft }}
        >
          지원 형식: .csv · .json
        </div>
      </div>

      {pending && (
        <div
          className="rounded-md p-3 space-y-2"
          style={{ background: C.cardSoft, border: `1px solid ${C.primary}` }}
        >
          <div className="text-sm" style={{ color: C.text }}>
            가져올 항목: 일정 <b>{pending.schedules.length}</b>건 · 기념일{" "}
            <b>{pending.anniversaries.length}</b>건
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onMerge(pending);
                setPending(null);
                alert(
                  `병합 완료 (일정 ${pending.schedules.length}, 기념일 ${pending.anniversaries.length}건)`,
                );
              }}
              className="flex-1 py-2 rounded-md text-sm font-semibold"
              style={{ background: C.primary, color: "#fff" }}
            >
              병합 (기존 유지)
            </button>
            <button
              onClick={() => {
                if (
                  confirm("기존 일정·기념일을 모두 삭제하고 덮어씁니다. 진행할까요?")
                ) {
                  onReplace(pending);
                  setPending(null);
                }
              }}
              className="flex-1 py-2 rounded-md text-sm font-semibold"
              style={{ background: "#E53935", color: "#fff" }}
            >
              덮어쓰기
            </button>
            <button
              onClick={() => setPending(null)}
              className="px-3 py-2 rounded-md text-sm"
              style={{
                background: C.card,
                border: `1px solid ${C.inputBorder}`,
                color: C.textMute,
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared form bits
// ============================================================
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="text-sm font-medium"
        style={{ color: C.textMute, minWidth: 80 }}
      >
        {label}
      </div>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center"
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? C.primary : "#ccc",
        transition: "background 0.15s",
      }}
    >
      <span
        className="absolute"
        style={{
          left: checked ? 22 : 2,
          top: 2,
          width: 20,
          height: 20,
          borderRadius: 10,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none rounded-md pl-3 pr-7 py-1.5 text-sm focus:outline-none"
        style={{
          background: C.inputBg,
          border: `1px solid ${C.inputBorder}`,
          color: C.text,
          minWidth: 90,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]"
        style={{ color: C.textSoft }}
      >
        ▼
      </span>
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
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={onCancel}
    >
      <div
        className="rounded-xl p-5 max-w-sm w-full"
        style={{ background: C.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm mb-4" style={{ color: C.text }}>
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm"
            style={{
              border: `1px solid ${C.inputBorder}`,
              color: C.textMute,
              background: C.card,
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md text-sm font-semibold"
            style={{ background: "#E53935", color: "#fff" }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

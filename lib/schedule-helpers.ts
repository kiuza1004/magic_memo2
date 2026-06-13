import KoreanLunarCalendar from "korean-lunar-calendar";
import type {
  Anniversary,
  Schedule,
  ScheduleData,
  ScheduleHit,
} from "./schedule-types";

export function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function toISODate(d: Date): string {
  const z = new Date(d);
  z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
  return z.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function ymd(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

export function isoFromYMD(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

const lunarCache = new Map<string, { month: number; day: number; intercalation: boolean } | null>();

export function getLunar(
  year: number,
  month: number,
  day: number,
): { month: number; day: number; intercalation: boolean } | null {
  const key = `${year}-${month}-${day}`;
  if (lunarCache.has(key)) return lunarCache.get(key)!;
  try {
    const cal = new KoreanLunarCalendar();
    const ok = cal.setSolarDate(year, month, day);
    if (!ok) {
      lunarCache.set(key, null);
      return null;
    }
    const lunar = cal.getLunarCalendar();
    const out = {
      month: lunar.month,
      day: lunar.day,
      intercalation: !!lunar.intercalation,
    };
    lunarCache.set(key, out);
    return out;
  } catch {
    lunarCache.set(key, null);
    return null;
  }
}

export function formatLunarShort(
  year: number,
  month: number,
  day: number,
): string {
  const l = getLunar(year, month, day);
  if (!l) return "";
  return `${l.intercalation ? "윤" : ""}${l.month}.${l.day}`;
}

export type MonthCell = {
  date: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
  weekday: number; // 0=Sun
};

export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay();
  const start = new Date(year, month - 1, 1 - startWeekday);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: toISODate(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month - 1,
      weekday: d.getDay(),
    });
  }
  return cells;
}

export function schedulesByDate(
  schedules: Schedule[],
): Map<string, Schedule[]> {
  const map = new Map<string, Schedule[]>();
  for (const s of schedules) {
    const arr = map.get(s.date) ?? [];
    arr.push(s);
    map.set(s.date, arr);
  }
  return map;
}

export function anniversariesForMonth(
  anniversaries: Anniversary[],
  year: number,
  month: number,
): Map<string, Anniversary[]> {
  const map = new Map<string, Anniversary[]>();
  for (const a of anniversaries) {
    if (a.month !== month) continue;
    const date = isoFromYMD(year, month, a.day);
    const arr = map.get(date) ?? [];
    arr.push(a);
    map.set(date, arr);
  }
  return map;
}

export function search(
  data: ScheduleData,
  query: string,
  from: string,
  to: string,
): ScheduleHit[] {
  const q = query.trim().toLowerCase();
  const hits: ScheduleHit[] = [];

  for (const s of data.schedules) {
    if (s.date < from || s.date > to) continue;
    if (q && !s.memo.toLowerCase().includes(q)) continue;
    hits.push({ kind: "schedule", date: s.date, schedule: s });
  }

  const fromY = Number(from.slice(0, 4));
  const toY = Number(to.slice(0, 4));
  for (const a of data.anniversaries) {
    if (q && !a.content.toLowerCase().includes(q)) continue;
    for (let y = fromY; y <= toY; y++) {
      const date = isoFromYMD(y, a.month, a.day);
      if (date < from || date > to) continue;
      hits.push({ kind: "anniversary", date, anniversary: a });
    }
  }

  hits.sort((a, b) => a.date.localeCompare(b.date));
  return hits;
}

// ---------------------------- CSV ----------------------------

const SECTION_SCHEDULES = "=SCHEDULES=";
const SECTION_ANNIVERSARIES = "=ANNIVERSARIES=";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(data: ScheduleData): string {
  const lines: string[] = [];
  lines.push(SECTION_SCHEDULES);
  lines.push("date,memo");
  for (const s of data.schedules) {
    lines.push(`${csvEscape(s.date)},${csvEscape(s.memo)}`);
  }
  lines.push("");
  lines.push(SECTION_ANNIVERSARIES);
  lines.push("month,day,content");
  for (const a of data.anniversaries) {
    lines.push(`${csvEscape(a.month)},${csvEscape(a.day)},${csvEscape(a.content)}`);
  }
  return "\uFEFF" + lines.join("\n");
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        q = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function fromCSV(
  text: string,
): { schedules: Omit<Schedule, "id" | "createdAt" | "updatedAt">[]; anniversaries: Omit<Anniversary, "id">[] } {
  const stripped = text.replace(/^\uFEFF/, "");
  const lines = stripped.split(/\r?\n/);
  const schedules: Omit<Schedule, "id" | "createdAt" | "updatedAt">[] = [];
  const anniversaries: Omit<Anniversary, "id">[] = [];
  let section: "none" | "schedules" | "anniversaries" = "none";
  let headerSeen = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      headerSeen = false;
      continue;
    }
    if (line === SECTION_SCHEDULES) {
      section = "schedules";
      headerSeen = false;
      continue;
    }
    if (line === SECTION_ANNIVERSARIES) {
      section = "anniversaries";
      headerSeen = false;
      continue;
    }
    if (!headerSeen) {
      headerSeen = true;
      continue;
    }
    const cols = parseCSVLine(raw);
    if (section === "schedules") {
      const [date, memo] = cols;
      if (date && memo != null) schedules.push({ date, memo });
    } else if (section === "anniversaries") {
      const [m, d, content] = cols;
      const month = Number(m);
      const day = Number(d);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && content) {
        anniversaries.push({ month, day, content });
      }
    }
  }
  return { schedules, anniversaries };
}

export function mergeImport(
  base: ScheduleData,
  incoming: { schedules: Omit<Schedule, "id" | "createdAt" | "updatedAt">[]; anniversaries: Omit<Anniversary, "id">[] },
): ScheduleData {
  const schedKey = (s: { date: string; memo: string }) => `${s.date}::${s.memo}`;
  const existing = new Set(base.schedules.map(schedKey));
  const now = Date.now();
  const newSchedules: Schedule[] = incoming.schedules
    .filter((s) => !existing.has(schedKey(s)))
    .map((s) => ({
      id: Math.random().toString(36).slice(2),
      date: s.date,
      memo: s.memo,
      createdAt: now,
      updatedAt: now,
    }));

  const annKey = (a: { month: number; day: number; content: string }) =>
    `${a.month}::${a.day}::${a.content}`;
  const existingA = new Set(base.anniversaries.map(annKey));
  const newAnns: Anniversary[] = incoming.anniversaries
    .filter((a) => !existingA.has(annKey(a)))
    .map((a) => ({ id: Math.random().toString(36).slice(2), ...a }));

  return {
    schedules: [...base.schedules, ...newSchedules],
    anniversaries: [...base.anniversaries, ...newAnns],
  };
}

export function replaceImport(
  incoming: { schedules: Omit<Schedule, "id" | "createdAt" | "updatedAt">[]; anniversaries: Omit<Anniversary, "id">[] },
): ScheduleData {
  const now = Date.now();
  return {
    schedules: incoming.schedules.map((s) => ({
      id: Math.random().toString(36).slice(2),
      date: s.date,
      memo: s.memo,
      createdAt: now,
      updatedAt: now,
    })),
    anniversaries: incoming.anniversaries.map((a) => ({
      id: Math.random().toString(36).slice(2),
      ...a,
    })),
  };
}

export function downloadBlob(content: string, filename: string, mime: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

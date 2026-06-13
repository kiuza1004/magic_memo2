import type { Anniversary, Schedule, ScheduleData } from "./schedule-types";

const KEY = "schedule:v1";

export function loadSchedule(): ScheduleData {
  if (typeof window === "undefined") return { schedules: [], anniversaries: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { schedules: [], anniversaries: [] };
    const obj = JSON.parse(raw) as Partial<ScheduleData>;
    return {
      schedules: Array.isArray(obj.schedules) ? obj.schedules : [],
      anniversaries: Array.isArray(obj.anniversaries) ? obj.anniversaries : [],
    };
  } catch {
    return { schedules: [], anniversaries: [] };
  }
}

export function saveSchedule(data: ScheduleData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearSchedule(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function addSchedule(
  data: ScheduleData,
  fields: { date: string; memo: string },
): ScheduleData {
  const now = Date.now();
  const schedule: Schedule = {
    id: newId(),
    date: fields.date,
    memo: fields.memo,
    createdAt: now,
    updatedAt: now,
  };
  return { ...data, schedules: [...data.schedules, schedule] };
}

export function updateSchedule(
  data: ScheduleData,
  id: string,
  patch: Partial<Pick<Schedule, "date" | "memo">>,
): ScheduleData {
  const now = Date.now();
  return {
    ...data,
    schedules: data.schedules.map((s) =>
      s.id === id ? { ...s, ...patch, updatedAt: now } : s,
    ),
  };
}

export function deleteSchedule(data: ScheduleData, id: string): ScheduleData {
  return { ...data, schedules: data.schedules.filter((s) => s.id !== id) };
}

export function addAnniversary(
  data: ScheduleData,
  fields: { month: number; day: number; content: string },
): ScheduleData {
  const ann: Anniversary = {
    id: newId(),
    month: fields.month,
    day: fields.day,
    content: fields.content,
  };
  return { ...data, anniversaries: [...data.anniversaries, ann] };
}

export function deleteAnniversary(data: ScheduleData, id: string): ScheduleData {
  return { ...data, anniversaries: data.anniversaries.filter((a) => a.id !== id) };
}

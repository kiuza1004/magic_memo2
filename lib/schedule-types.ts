export type Schedule = {
  id: string;
  date: string; // YYYY-MM-DD
  memo: string;
  createdAt: number;
  updatedAt: number;
};

export type Anniversary = {
  id: string;
  month: number; // 1-12
  day: number; // 1-31
  content: string;
};

export type ScheduleData = {
  schedules: Schedule[];
  anniversaries: Anniversary[];
};

export type ScheduleHit =
  | { kind: "schedule"; date: string; schedule: Schedule }
  | { kind: "anniversary"; date: string; anniversary: Anniversary };

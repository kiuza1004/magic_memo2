export type AlarmType = "sound" | "vibration" | "both";
export type AlarmSound =
  | "default"
  | "bell"
  | "chime"
  | "alert"
  | "melody"
  | "recorded";
export type AlarmBefore =
  | "none"
  | "10min"
  | "30min"
  | "1hour"
  | "2hour"
  | "1day";

export type Schedule = {
  id: string;
  date: string; // YYYY-MM-DD
  memo: string;
  alarmEnabled?: boolean;
  alarmTime?: string | null; // "HH:mm"
  alarmBefore?: AlarmBefore;
  alarmType?: AlarmType;
  alarmSound?: AlarmSound;
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

export const ALARM_BEFORE_OPTIONS: { value: AlarmBefore; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "10min", label: "10분 전" },
  { value: "30min", label: "30분 전" },
  { value: "1hour", label: "1시간 전" },
  { value: "2hour", label: "2시간 전" },
  { value: "1day", label: "하루 전" },
];

export const ALARM_TYPE_OPTIONS: { value: AlarmType; label: string }[] = [
  { value: "sound", label: "벨소리만" },
  { value: "vibration", label: "진동만" },
  { value: "both", label: "벨+진동" },
];

export const ALARM_SOUND_OPTIONS: { value: AlarmSound; label: string }[] = [
  { value: "default", label: "기본음" },
  { value: "bell", label: "벨소리" },
  { value: "chime", label: "차임음" },
  { value: "alert", label: "경보음" },
  { value: "melody", label: "멜로디" },
  { value: "recorded", label: "🎙 내 녹음" },
];

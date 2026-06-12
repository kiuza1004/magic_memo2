import type { Memo, SearchResult } from "./types";

type DateRange = { from: number; to: number };

const DAY_MS = 24 * 60 * 60 * 1000;

const STOPWORDS = new Set([
  "메모", "내용", "기록", "기록한", "적은", "적었던", "쓴", "썼던",
  "물건", "것", "거", "걸", "게", "을", "를", "이", "가", "은", "는", "의", "에", "에서", "와", "과", "랑",
  "알려줘", "알려", "보여줘", "보여", "찾아줘", "찾아", "검색", "표시",
  "최근", "이내", "이내에", "이전", "안에", "동안", "사이",
  "오늘", "어제", "그제", "그저께", "내일", "모레",
  "지난", "이번", "다음", "주", "달", "월", "년", "일", "시간", "분",
  "주에", "달에", "월에", "년에", "일에",
  "전", "후", "까지", "부터",
]);

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function dayOffset(days: number, now = Date.now()): number {
  return now - days * DAY_MS;
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const KOREAN_NUM: Record<string, number> = {
  한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10,
  일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9, 십: 10,
};

function parseNum(token: string): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  if (token in KOREAN_NUM) return KOREAN_NUM[token];
  return null;
}

export function parseDateRange(query: string, now = Date.now()): DateRange | null {
  const q = query.replace(/\s+/g, " ").trim();

  if (/오늘/.test(q)) return { from: startOfDay(now), to: endOfDay(now) };
  if (/어제/.test(q)) {
    const y = dayOffset(1, now);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (/(그제|그저께)/.test(q)) {
    const y = dayOffset(2, now);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (/이번\s*주/.test(q)) return { from: startOfWeek(now), to: now };
  if (/지난\s*주/.test(q)) {
    const lastWeekStart = startOfWeek(now) - 7 * DAY_MS;
    return { from: lastWeekStart, to: lastWeekStart + 7 * DAY_MS - 1 };
  }
  if (/이번\s*달|이번\s*월/.test(q)) return { from: startOfMonth(now), to: now };
  if (/지난\s*달|지난\s*월/.test(q)) {
    const thisMonth = new Date(startOfMonth(now));
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(thisMonth.getMonth() - 1);
    return { from: lastMonth.getTime(), to: thisMonth.getTime() - 1 };
  }

  const m1 = q.match(/(?:최근|지난)\s*([\d한두세네다섯여섯일곱여덟아홉열일이삼사오육칠팔구십]+)\s*일/);
  if (m1) {
    const n = parseNum(m1[1]);
    if (n) return { from: startOfDay(dayOffset(n - 1, now)), to: now };
  }
  const m2 = q.match(/(?:최근|지난)\s*([\d한두세네다섯여섯일곱여덟아홉열일이삼사오육칠팔구십]+)\s*주/);
  if (m2) {
    const n = parseNum(m2[1]);
    if (n) return { from: dayOffset(n * 7, now), to: now };
  }
  const m3 = q.match(/(?:최근|지난)\s*([\d한두세네다섯여섯일곱여덟아홉열일이삼사오육칠팔구십]+)\s*(개월|달)/);
  if (m3) {
    const n = parseNum(m3[1]);
    if (n) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - n);
      return { from: d.getTime(), to: now };
    }
  }
  return null;
}

export function extractKeywords(query: string): string[] {
  let q = query;
  q = q.replace(/(?:최근|지난)\s*[\d한두세네다섯여섯일곱여덟아홉열일이삼사오육칠팔구십]+\s*(?:일|주|개월|달)\s*(?:이내|동안|간|안)?/g, " ");
  q = q.replace(/(오늘|어제|그제|그저께|이번\s*주|지난\s*주|이번\s*달|지난\s*달|이번\s*월|지난\s*월)/g, " ");

  const tokens = q.split(/[\s,.!?·、，。!？「」"'()/\\\[\]{}]+/).filter(Boolean);
  const kws: string[] = [];
  for (const raw of tokens) {
    const t = raw.replace(/[은는이가을를의에에서와과랑]+$/g, "");
    if (!t) continue;
    if (STOPWORDS.has(t)) continue;
    if (t.length < 2 && !/[\p{L}]/u.test(t)) continue;
    kws.push(t);
  }
  return Array.from(new Set(kws));
}

export function search(query: string, memos: Memo[], now = Date.now()): SearchResult[] {
  const range = parseDateRange(query, now);
  const keywords = extractKeywords(query);

  const filtered = range
    ? memos.filter((m) => m.createdAt >= range.from && m.createdAt <= range.to)
    : memos;

  if (keywords.length === 0) {
    return filtered.map((m) => ({ memo: m, score: 1 }));
  }

  const results: SearchResult[] = [];
  for (const memo of filtered) {
    const text = memo.text.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const lk = kw.toLowerCase();
      if (text.includes(lk)) score += 2;
      else if (memo.tags.some((t) => t.toLowerCase().includes(lk))) score += 1;
    }
    if (score > 0) results.push({ memo, score });
  }
  results.sort((a, b) => b.score - a.score || b.memo.createdAt - a.memo.createdAt);
  return results;
}

export function describeRange(range: DateRange | null): string {
  if (!range) return "전체 기간";
  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
  return `${fmt(range.from)} ~ ${fmt(range.to)}`;
}

export { type DateRange };

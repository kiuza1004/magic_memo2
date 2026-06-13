import type { WeightPoint, WeightUnit } from "./weight-types";

const LB_PER_KG = 2.2046226218;

export function toISODate(d: Date | string | number): string {
  const z = new Date(d);
  z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
  return z.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : "–";
}

export function displayUnit(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? kg * LB_PER_KG : kg;
}

export function toKg(input: number, unit: WeightUnit): number {
  return unit === "lb" ? input / LB_PER_KG : input;
}

export function unitLabel(unit: WeightUnit): string {
  return unit;
}

export function seriesFromEntries(entries: Record<string, number>): WeightPoint[] {
  return Object.keys(entries)
    .sort()
    .map((date) => ({ date, kg: entries[date] }));
}

export function sliceByRange(
  arr: WeightPoint[],
  days: number | "all",
): WeightPoint[] {
  if (days === "all" || arr.length === 0) return arr;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  const cutoffISO = toISODate(cutoff);
  return arr.filter((p) => p.date >= cutoffISO);
}

export function movingAvg(values: number[], win = 7): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - win + 1);
    const window = values.slice(from, i + 1);
    return window.reduce((s, v) => s + v, 0) / window.length;
  });
}

export function bmi(kg: number, heightCm: number): number {
  const m = heightCm / 100;
  return kg / (m * m);
}

import type { WeightData, WeightUnit } from "./weight-types";

const KEY = "weight-tracker:v1";

export function loadWeight(): WeightData {
  if (typeof window === "undefined") return { entries: {}, unit: "kg" };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { entries: {}, unit: "kg" };
    const obj = JSON.parse(raw) as Partial<WeightData>;
    const unit: WeightUnit = obj.unit === "lb" ? "lb" : "kg";
    return {
      entries: obj.entries && typeof obj.entries === "object" ? obj.entries : {},
      goal: typeof obj.goal === "number" ? obj.goal : undefined,
      height: typeof obj.height === "number" ? obj.height : undefined,
      unit,
    };
  } catch {
    return { entries: {}, unit: "kg" };
  }
}

export function saveWeight(data: WeightData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearWeight(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export type WeightUnit = "kg" | "lb";

export type WeightData = {
  entries: Record<string, number>;
  goal?: number;
  height?: number;
  unit: WeightUnit;
};

export type WeightPoint = {
  date: string;
  kg: number;
};

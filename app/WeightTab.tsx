"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { clearWeight, loadWeight, saveWeight } from "@/lib/weight-storage";
import {
  bmi,
  displayUnit,
  fmt,
  movingAvg,
  seriesFromEntries,
  sliceByRange,
  todayISO,
  toKg,
  unitLabel,
} from "@/lib/weight-helpers";
import type { WeightData, WeightUnit } from "@/lib/weight-types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

type Range = 30 | 90 | 365 | "all";

export default function WeightTab() {
  const [data, setData] = useState<WeightData>({ entries: {}, unit: "kg" });
  const [hydrated, setHydrated] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [weightInput, setWeightInput] = useState("");
  const [range, setRange] = useState<Range>(30);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [unitInput, setUnitInput] = useState<WeightUnit>("kg");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(loadWeight());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && data.entries[date] != null) {
      setWeightInput(String(displayUnit(data.entries[date], data.unit)));
    }
  }, [hydrated, date, data]);

  const persist = (next: WeightData) => {
    setData(next);
    saveWeight(next);
  };

  const all = useMemo(() => seriesFromEntries(data.entries), [data.entries]);
  const u = data.unit;
  const uLabel = unitLabel(u);

  const stats = useMemo(() => {
    if (all.length === 0) return null;
    const start = all[0].kg;
    const current = all[all.length - 1].kg;
    const delta = current - start;
    const min = Math.min(...all.map((p) => p.kg));
    const last7 = all.slice(-7);
    const avg7 = last7.reduce((s, p) => s + p.kg, 0) / last7.length;
    const bmiVal =
      data.height && data.height > 0 ? bmi(current, data.height) : null;
    return { start, current, delta, min, avg7, bmi: bmiVal };
  }, [all, data.height]);

  const goalProgress = useMemo(() => {
    if (!data.goal || !Number.isFinite(data.goal) || all.length === 0) return null;
    const start = all[0].kg;
    const current = all[all.length - 1].kg;
    const totalToLose = start - data.goal;
    const lost = start - current;
    const pct =
      totalToLose > 0
        ? Math.max(0, Math.min(100, (lost / totalToLose) * 100))
        : current <= data.goal
          ? 100
          : 0;
    const remain = current - data.goal;
    return { pct, remain, goal: data.goal };
  }, [data.goal, all]);

  const chart = useMemo<{ data: ChartData<"line">; options: ChartOptions<"line"> }>(() => {
    const filtered = sliceByRange(all, range);
    const labels = filtered.map((p) => p.date);
    const values = filtered.map((p) => displayUnit(p.kg, u));
    const ma = movingAvg(values, 7);

    const datasets: ChartData<"line">["datasets"] = [
      {
        label: `체중 (${uLabel})`,
        data: values,
        borderColor: "#6ea8fe",
        backgroundColor: "rgba(110,168,254,0.2)",
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.25,
        fill: true,
      },
      {
        label: "7일 이동평균",
        data: ma,
        borderColor: "#34d399",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.25,
        fill: false,
      },
    ];

    if (data.goal && filtered.length > 0) {
      const goalVal = displayUnit(data.goal, u);
      datasets.push({
        label: `목표 (${fmt(goalVal)} ${uLabel})`,
        data: filtered.map(() => goalVal),
        borderColor: "#fbbf24",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [2, 4],
        pointRadius: 0,
        fill: false,
      });
    }

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#e6e9f5", boxWidth: 14, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${Number(c.parsed.y).toFixed(1)} ${uLabel}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#94a0c2", maxRotation: 0, autoSkip: true },
          grid: { color: "#283154" },
        },
        y: { ticks: { color: "#94a0c2" }, grid: { color: "#283154" } },
      },
    };

    return { data: { labels, datasets }, options };
  }, [all, range, u, uLabel, data.goal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = parseFloat(weightInput);
    if (!date || !Number.isFinite(raw)) return;
    const kg = toKg(raw, u);
    if (kg < 20 || kg > 300) {
      alert("체중 범위가 올바르지 않습니다. (20–300 kg)");
      return;
    }
    const rounded = Math.round(kg * 10) / 10;
    persist({ ...data, entries: { ...data.entries, [date]: rounded } });
    setWeightInput("");
  };

  const handleDeleteRow = (d: string) => {
    if (!window.confirm(`${d} 기록을 삭제할까요?`)) return;
    const next = { ...data.entries };
    delete next[d];
    persist({ ...data, entries: next });
  };

  const openSettings = () => {
    setGoalInput(
      data.goal != null ? String(displayUnit(data.goal, data.unit)) : "",
    );
    setHeightInput(data.height != null ? String(data.height) : "");
    setUnitInput(data.unit);
    setSettingsOpen(true);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const goalRaw = parseFloat(goalInput);
    const heightRaw = parseFloat(heightInput);
    const goal = Number.isFinite(goalRaw) ? toKg(goalRaw, unitInput) : undefined;
    const height = Number.isFinite(heightRaw) ? heightRaw : undefined;
    persist({ ...data, goal, height, unit: unitInput });
    setSettingsOpen(false);
  };

  const handleReset = () => {
    if (!window.confirm("모든 체중 기록과 설정을 삭제할까요?")) return;
    if (!window.confirm("정말 모두 삭제합니다. 계속할까요?")) return;
    clearWeight();
    setData({ entries: {}, unit: "kg" });
    setSettingsOpen(false);
  };

  const exportCSV = () => {
    const rows = [
      ["date", "weight_kg"],
      ...Object.keys(data.entries)
        .sort()
        .map((d) => [d, String(data.entries[d])]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weight-${todayISO()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const lines = text.split(/\r?\n/).filter(Boolean);
        const next = { ...data.entries };
        let added = 0;
        for (const line of lines) {
          const [d, w] = line.split(",");
          if (!d || !w) continue;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) continue;
          const kg = parseFloat(w);
          if (!Number.isFinite(kg) || kg < 20 || kg > 300) continue;
          next[d.trim()] = Math.round(kg * 10) / 10;
          added++;
        }
        persist({ ...data, entries: next });
        alert(`${added}건을 가져왔습니다.`);
      } catch {
        alert("CSV 가져오기에 실패했습니다.");
      }
    };
    reader.readAsText(file);
  };

  const logRows = useMemo(() => all.slice().reverse(), [all]);

  return (
    <>
      <section className="bg-card rounded-xl p-4 mb-4 border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm text-gray-300 font-medium">오늘의 체중</h2>
          <div className="flex gap-1">
            <button
              onClick={exportCSV}
              className="text-xs px-2 py-1 rounded border border-gray-700 hover:border-gray-500 text-gray-400"
              title="CSV 내보내기"
            >
              ⬇
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs px-2 py-1 rounded border border-gray-700 hover:border-gray-500 text-gray-400"
              title="CSV 가져오기"
            >
              ⬆
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCSV(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={openSettings}
              className="text-xs px-2 py-1 rounded border border-gray-700 hover:border-gray-500 text-gray-400"
              title="설정"
            >
              ⚙
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-xs text-gray-400">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="bg-bg border border-gray-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-xs text-gray-400">체중 ({uLabel})</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="300"
              placeholder="예: 72.4"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              required
              className="bg-bg border border-gray-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="bg-accent hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg h-[38px]"
          >
            기록
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">같은 날짜를 다시 기록하면 덮어씁니다.</p>
      </section>

      <section className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="시작" value={stats ? `${fmt(displayUnit(stats.start, u))} ${uLabel}` : "–"} />
        <Stat label="현재" value={stats ? `${fmt(displayUnit(stats.current, u))} ${uLabel}` : "–"} />
        <Stat
          label="변화"
          value={
            stats
              ? `${stats.delta > 0 ? "+" : ""}${fmt(displayUnit(stats.delta, u))} ${uLabel}`
              : "–"
          }
          tone={stats ? (stats.delta > 0.05 ? "up" : stats.delta < -0.05 ? "down" : undefined) : undefined}
        />
        <Stat label="최저" value={stats ? `${fmt(displayUnit(stats.min, u))} ${uLabel}` : "–"} />
        <Stat label="7일 평균" value={stats ? `${fmt(displayUnit(stats.avg7, u))} ${uLabel}` : "–"} />
        <Stat
          label="BMI"
          value={stats && stats.bmi != null ? fmt(stats.bmi, 1) : "–"}
          tone={
            stats && stats.bmi != null
              ? stats.bmi >= 25 || stats.bmi < 18.5
                ? "warn"
                : "down"
              : undefined
          }
        />
      </section>

      <section className="bg-card rounded-xl p-4 mb-4 border border-gray-800">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm text-gray-300 font-medium">추세</h2>
          <div className="flex gap-1 bg-bg border border-gray-700 rounded-lg p-1">
            {([30, 90, 365, "all"] as Range[]).map((r) => (
              <button
                key={String(r)}
                onClick={() => setRange(r)}
                className={`text-xs px-2 py-1 rounded font-medium ${
                  range === r ? "bg-accent text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {r === "all" ? "전체" : r === 365 ? "1년" : `${r}일`}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[280px]">
          {all.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              기록을 추가하면 그래프가 표시됩니다.
            </div>
          ) : (
            <Line data={chart.data} options={chart.options} />
          )}
        </div>
        {goalProgress && (
          <div className="mt-3">
            <div className="h-2 bg-bg border border-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all"
                style={{ width: `${goalProgress.pct}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              목표 {fmt(displayUnit(goalProgress.goal, u))} {uLabel} · 진행률{" "}
              {goalProgress.pct.toFixed(0)}% ·{" "}
              {goalProgress.remain > 0
                ? `${fmt(displayUnit(goalProgress.remain, u))} ${uLabel} 남음`
                : `🎉 목표 달성! (${fmt(displayUnit(-goalProgress.remain, u))} ${uLabel} 초과 감량)`}
            </div>
          </div>
        )}
      </section>

      <section className="bg-card rounded-xl p-4 mb-4 border border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm text-gray-300 font-medium">기록 목록</h2>
          <span className="text-xs text-gray-500">{logRows.length}건</span>
        </div>
        {logRows.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6 m-0">
            아직 기록이 없습니다. 위에서 첫 체중을 입력해 보세요.
          </p>
        ) : (
          <div className="max-h-[320px] overflow-auto border border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bg">
                <tr className="text-xs text-gray-400">
                  <th className="text-left px-3 py-2 font-medium">날짜</th>
                  <th className="text-left px-3 py-2 font-medium">체중 ({uLabel})</th>
                  <th className="text-left px-3 py-2 font-medium">전일 대비</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {logRows.map((p, i) => {
                  const next = logRows[i + 1];
                  const diff = next ? p.kg - next.kg : null;
                  const diffCls =
                    diff == null
                      ? "text-gray-500"
                      : diff > 0.05
                        ? "text-red-400"
                        : diff < -0.05
                          ? "text-emerald-400"
                          : "text-gray-500";
                  return (
                    <tr key={p.date} className="border-t border-gray-800">
                      <td className="px-3 py-2 text-gray-200">{p.date}</td>
                      <td className="px-3 py-2 text-gray-200 tabular-nums">
                        {fmt(displayUnit(p.kg, u))} {uLabel}
                      </td>
                      <td className={`px-3 py-2 tabular-nums ${diffCls}`}>
                        {diff == null
                          ? "–"
                          : `${diff > 0 ? "+" : ""}${fmt(displayUnit(diff, u))} ${uLabel}`}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => handleDeleteRow(p.date)}
                          className="text-gray-500 hover:text-red-400 text-xs"
                          aria-label={`${p.date} 기록 삭제`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-card rounded-xl p-4 mb-4 border border-gray-800">
        <h2 className="text-sm text-gray-300 font-medium mb-3">
          💡 체중 감량에 도움되는 것들
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TIPS.map((t) => (
            <div
              key={t.title}
              className="bg-bg border border-gray-800 rounded-lg p-3"
            >
              <h3 className="text-sm text-gray-200 font-semibold mb-1">
                {t.title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
          ※ 일반적인 가이드입니다. 체중·건강 관련 의학적 결정은 의료진과 상의하세요.
        </p>
      </section>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveSettings}
            className="bg-card border border-gray-800 rounded-xl p-5 w-full max-w-md"
          >
            <h3 className="text-base font-medium text-gray-200 mb-4">설정</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">목표 체중 ({unitInput})</label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  placeholder="예: 65"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="bg-bg border border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">
                  키 (cm) <span className="text-gray-500">— BMI 계산용</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="100"
                  max="230"
                  placeholder="예: 175"
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  className="bg-bg border border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">단위</label>
                <select
                  value={unitInput}
                  onChange={(e) => setUnitInput(e.target.value === "lb" ? "lb" : "kg")}
                  className="bg-bg border border-gray-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb (파운드)</option>
                </select>
              </div>
            </div>
            <hr className="border-gray-800 my-4" />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-red-400 border border-red-500/40 hover:bg-red-500/10 rounded-lg px-3 py-2"
              >
                모든 데이터 삭제
              </button>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-sm border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2"
              >
                취소
              </button>
              <button
                type="submit"
                className="text-sm bg-accent hover:bg-blue-500 text-white rounded-lg px-4 py-2 font-medium"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const TIPS: { title: string; body: string }[] = [
  {
    title: "① 단백질 우선",
    body: "매 끼니 손바닥 1장 분량의 단백질로 포만감과 근육 유지.",
  },
  {
    title: "② 수분 2L",
    body: "공복감과 식욕을 줄여 주고 대사를 돕습니다.",
  },
  {
    title: "③ 같은 조건 측정",
    body: "아침 기상 직후, 같은 옷, 같은 저울로 매일 측정.",
  },
  {
    title: "④ 걷기 8천 보",
    body: "유산소 기초량. 하루 8천 보를 목표로 꾸준히.",
  },
  {
    title: "⑤ 수면 7시간",
    body: "수면 부족은 식욕 호르몬을 자극해 과식을 유발합니다.",
  },
  {
    title: "⑥ 정제 탄수화물 줄이기",
    body: "흰빵·과자·음료수의 빈도와 양을 점진적으로 감소.",
  },
  {
    title: "⑦ 추세를 보세요",
    body: "하루치 등락보다 7일 이동평균의 방향이 중요.",
  },
  {
    title: "⑧ 주 2회 근력운동",
    body: "근육량 보존이 기초대사량을 지킵니다.",
  },
];

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "warn";
}) {
  const toneCls =
    tone === "up"
      ? "text-red-400"
      : tone === "down"
        ? "text-emerald-400"
        : tone === "warn"
          ? "text-amber-400"
          : "text-gray-100";
  return (
    <div className="bg-card border border-gray-800 rounded-lg p-3 min-w-0">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-base font-bold tabular-nums truncate ${toneCls}`}>{value}</div>
    </div>
  );
}

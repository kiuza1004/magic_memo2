"use client";

import { useState } from "react";
import MemoTab from "./MemoTab";
import WeightTab from "./WeightTab";
import ScheduleTab from "./ScheduleTab";

type View = "home" | "schedule" | "memo" | "weight";

const TITLE: Record<Exclude<View, "home">, string> = {
  schedule: "📅 일정관리",
  memo: "📝 메모정리",
  weight: "⚖️ 체중기록",
};

export default function HomePage() {
  const [view, setView] = useState<View>("home");

  if (view === "home") {
    return (
      <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">My Life</h1>
          <p className="text-sm text-gray-400 mt-2">메뉴를 선택하세요.</p>
        </header>

        <nav className="grid gap-3">
          <MenuCard
            icon="📅"
            title="일정관리"
            desc="달력으로 일정·기념일을 관리하세요"
            onClick={() => setView("schedule")}
          />
          <MenuCard
            icon="📝"
            title="메모정리"
            desc="음성·텍스트로 기록하고, 자연어로 다시 찾으세요"
            onClick={() => setView("memo")}
          />
          <MenuCard
            icon="⚖️"
            title="체중기록"
            desc="매일 체중을 기록하고 추세를 확인하세요"
            onClick={() => setView("weight")}
          />
        </nav>

        <footer className="mt-12 text-center text-xs text-gray-600">
          브라우저 localStorage에 저장됩니다. 데이터는 이 기기에만 보관됩니다.
        </footer>
      </main>
    );
  }

  // 일정관리는 자체 라이트 톤 — 외부 wrapper 최소화
  if (view === "schedule") {
    return (
      <div className="min-h-screen" style={{ background: "#F0F4FA" }}>
        <BackBar
          title={TITLE.schedule}
          onBack={() => setView("home")}
          tone="light"
        />
        <ScheduleTab />
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-4 max-w-2xl mx-auto">
      <BackBar title={TITLE[view]} onBack={() => setView("home")} tone="dark" />
      {view === "memo" && <MemoTab />}
      {view === "weight" && <WeightTab />}
    </main>
  );
}

function MenuCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 bg-card border border-gray-800 hover:border-accent rounded-2xl p-5 text-left transition-colors group"
    >
      <span className="text-4xl">{icon}</span>
      <span className="flex-1">
        <span className="block text-lg font-semibold text-white">{title}</span>
        <span className="block text-xs text-gray-400 mt-0.5">{desc}</span>
      </span>
      <span className="text-gray-500 group-hover:text-accent text-xl">›</span>
    </button>
  );
}

function BackBar({
  title,
  onBack,
  tone,
}: {
  title: string;
  onBack: () => void;
  tone: "light" | "dark";
}) {
  if (tone === "light") {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 sticky top-0 z-30 shadow-sm"
        style={{ background: "#4A90D9", color: "#fff" }}
      >
        <button
          onClick={onBack}
          className="px-2 py-1 rounded-md hover:bg-white/15 text-sm"
          aria-label="홈으로"
        >
          ← 홈
        </button>
        <span className="text-base font-semibold flex-1 text-center pr-10">
          {title}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 mb-3">
      <button
        onClick={onBack}
        className="px-2 py-1 rounded-md bg-card border border-gray-800 hover:border-accent text-sm text-gray-300"
        aria-label="홈으로"
      >
        ← 홈
      </button>
      <h2 className="text-lg font-semibold flex-1">{title}</h2>
    </div>
  );
}

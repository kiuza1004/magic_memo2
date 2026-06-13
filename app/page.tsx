"use client";

import { useState } from "react";
import MemoTab from "./MemoTab";
import WeightTab from "./WeightTab";
import ScheduleTab from "./ScheduleTab";

type Tab = "memo" | "weight" | "schedule";

const SUBTITLE: Record<Tab, string> = {
  memo: "음성·텍스트로 기록하고, 자연어로 다시 찾으세요.",
  weight: "매일 체중을 기록하고 추세를 확인하세요.",
  schedule: "달력으로 일정·기념일을 관리하세요.",
};

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("memo");

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Magic Memo</h1>
        <p className="text-sm text-gray-400 mt-1">{SUBTITLE[tab]}</p>
      </header>

      <div
        role="tablist"
        aria-label="섹션"
        className="flex gap-1 bg-card border border-gray-800 rounded-xl p-1 mb-4"
      >
        <TabButton active={tab === "memo"} onClick={() => setTab("memo")}>
          📝 메모
        </TabButton>
        <TabButton active={tab === "weight"} onClick={() => setTab("weight")}>
          ⚖️ 체중기록
        </TabButton>
        <TabButton
          active={tab === "schedule"}
          onClick={() => setTab("schedule")}
        >
          📅 일정
        </TabButton>
      </div>

      {tab === "memo" && <MemoTab />}
      {tab === "weight" && <WeightTab />}
      {tab === "schedule" && <ScheduleTab />}

      <footer className="mt-10 text-center text-xs text-gray-600">
        브라우저 localStorage에 저장됩니다. 데이터는 이 기기에만 보관됩니다.
      </footer>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
        active
          ? "bg-accent text-white"
          : "text-gray-400 hover:text-gray-200 hover:bg-bg"
      }`}
    >
      {children}
    </button>
  );
}

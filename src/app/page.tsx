"use client";

import { useState } from "react";
import Dashboard from "@/components/Dashboard";
import ScenarioSimulator from "@/components/ScenarioSimulator";
import DataEditor from "@/components/DataEditor";
import ChatPanel from "@/components/ChatPanel";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "scenario", label: "Scenario simulator" },
  { id: "data", label: "Data editor" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">MGS OS — Finance</h1>
        <p className="text-xs text-zinc-500">Manx Growth Solutions · interactive forecasting</p>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <main className="flex-1 space-y-4">
          <nav className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1 text-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
                  tab === t.id ? "bg-sky-600 text-white" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === "dashboard" && <Dashboard />}
          {tab === "scenario" && <ScenarioSimulator />}
          {tab === "data" && <DataEditor />}
        </main>

        <aside className="h-[75vh] w-full lg:h-auto lg:w-[380px] lg:shrink-0">
          <ChatPanel />
        </aside>
      </div>
    </div>
  );
}

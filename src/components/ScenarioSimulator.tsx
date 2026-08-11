"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/store";
import { applyScenario, computeSeries, type NewClientScenario } from "@/lib/calculations";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);

export default function ScenarioSimulator() {
  const { months } = useData();
  const [name, setName] = useState("New client");
  const [mrr, setMrr] = useState(1500);
  const [startKey, setStartKey] = useState(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return months.find((m) => m.key === key)?.key ?? months[months.length - 1].key;
  });
  const [extraCost, setExtraCost] = useState(0);

  const scenario: NewClientScenario = useMemo(
    () => ({ name: name || "New client", monthlyRevenue: mrr, startKey, extraMonthlyCost: extraCost || undefined }),
    [name, mrr, startKey, extraCost]
  );

  const baseline = useMemo(() => computeSeries(months, { useKnownValues: false }), [months]);
  const scenarioComputed = useMemo(() => {
    const modified = applyScenario([scenario], months);
    return computeSeries(modified, { useKnownValues: false });
  }, [scenario, months]);

  const startIdx = baseline.findIndex((m) => m.key === startKey);
  const affected = scenarioComputed.slice(startIdx).map((after, i) => ({ before: baseline[startIdx + i], after }));

  const totalProfitDelta = affected.reduce((s, { before, after }) => s + (after.profit - before.profit), 0);
  const endBalanceBefore = baseline[baseline.length - 1]?.closingBalance ?? 0;
  const endBalanceAfter = scenarioComputed[scenarioComputed.length - 1]?.closingBalance ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">What if we onboard a new client?</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-zinc-500">
            Client name
            <input
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Monthly revenue (£)
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              value={mrr}
              onChange={(e) => setMrr(Number(e.target.value))}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Extra delivery cost / mo (£)
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              value={extraCost}
              onChange={(e) => setExtraCost(Number(e.target.value))}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Starting month
            <select
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              value={startKey}
              onChange={(e) => setStartKey(e.target.value)}
            >
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Total profit impact</div>
          <div className={`mt-1 text-2xl font-semibold ${totalProfitDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {totalProfitDelta >= 0 ? "+" : ""}
            {gbp.format(totalProfitDelta)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">across {affected.length} months, {scenario.name} @ {gbp.format(mrr)}/mo from {baseline[startIdx]?.label}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Balance at end of model</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-100">{gbp.format(endBalanceAfter)}</div>
          <div className="mt-1 text-xs text-zinc-500">vs {gbp.format(endBalanceBefore)} without this client</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Margin, first affected month</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-100">{pct(affected[0]?.after.margin ?? null)}</div>
          <div className="mt-1 text-xs text-zinc-500">vs {pct(affected[0]?.before.margin ?? null)} without</div>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Month-by-month, with vs without</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Month</th>
                <th className="py-2 pr-4 text-right">Profit before</th>
                <th className="py-2 pr-4 text-right">Profit after</th>
                <th className="py-2 pr-4 text-right">Margin before</th>
                <th className="py-2 pr-4 text-right">Margin after</th>
                <th className="py-2 pr-4 text-right">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {affected.map(({ before, after }) => (
                <tr key={before.key} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 whitespace-nowrap">{before.label}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">{gbp.format(before.profit)}</td>
                  <td className={`py-2 pr-4 text-right tabular-nums ${after.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {gbp.format(after.profit)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">{pct(before.margin)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{pct(after.margin)}</td>
                  <td className={`py-2 pr-4 text-right tabular-nums ${after.closingBalance >= 0 ? "text-zinc-300" : "text-rose-400"}`}>
                    {gbp.format(after.closingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

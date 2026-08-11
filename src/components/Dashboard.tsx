"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "@/lib/store";
import { runway } from "@/lib/calculations";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const gbp2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 });
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral" }) {
  const toneClass =
    tone === "good"
      ? "text-emerald-500"
      : tone === "bad"
      ? "text-rose-500"
      : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { computed } = useData();

  const today = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return computed.find((m) => m.key === key) ?? computed[computed.length - 1];
  }, [computed]);

  const r = useMemo(() => runway(computed), [computed]);

  const chartData = computed.map((m) => ({
    label: m.label.replace(" 20", " '"),
    revenue: Math.round(m.revenue),
    profit: Math.round(m.profit),
    fixed: Math.round(m.fixedCost),
    variable: Math.round(m.variableCost),
    balance: Math.round(m.closingBalance),
    margin: m.margin === null ? null : Math.round(m.margin * 10) / 10,
    forecast: m.forecast,
  }));

  const currentMargin = today?.margin ?? null;
  const marginTone = currentMargin === null ? "neutral" : currentMargin >= 15 ? "good" : currentMargin >= 0 ? "neutral" : "bad";
  const profitTone = (today?.profit ?? 0) >= 0 ? "good" : "bad";
  const balanceTone = r.currentBalance >= 0 ? "good" : "bad";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={`${today?.label ?? ""} revenue`} value={gbp.format(today?.revenue ?? 0)} />
        <KpiCard
          label={`${today?.label ?? ""} profit`}
          value={gbp.format(today?.profit ?? 0)}
          tone={profitTone}
          sub={today?.isActual ? "from sheet" : "projected"}
        />
        <KpiCard label="Profit margin" value={pct(currentMargin)} tone={marginTone} />
        <KpiCard
          label="Cash balance"
          value={gbp.format(r.currentBalance)}
          tone={balanceTone}
          sub={r.monthsInDeficit > 0 ? `${r.monthsInDeficit} month(s) go negative (lowest ${gbp.format(r.lowestBalance)} in ${r.lowestBalanceMonth})` : "never goes negative"}
        />
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Revenue vs profit</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => gbp.format(v)} width={70} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }}
                formatter={(v) => gbp2.format(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#38bdf8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="#4ade80" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Profit margin %</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} unit="%" width={40} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Area type="monotone" dataKey="margin" name="Margin" stroke="#c084fc" fill="#c084fc33" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Fixed vs variable cost</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => gbp.format(v)} width={70} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} formatter={(v) => gbp2.format(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="fixed" name="Fixed (subscriptions)" stackId="cost" fill="#facc15" />
              <Bar dataKey="variable" name="Variable (delivery + brand)" stackId="cost" fill="#fb7185" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Cash balance over time</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => gbp.format(v)} width={70} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} formatter={(v) => gbp2.format(Number(v))} />
              <Area type="monotone" dataKey="balance" name="Balance" stroke="#38bdf8" fill="#38bdf833" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Monthly detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Month</th>
                <th className="py-2 pr-4">Clients</th>
                <th className="py-2 pr-4 text-right">Revenue</th>
                <th className="py-2 pr-4 text-right">Fixed</th>
                <th className="py-2 pr-4 text-right">Variable</th>
                <th className="py-2 pr-4 text-right">Profit</th>
                <th className="py-2 pr-4 text-right">Margin</th>
                <th className="py-2 pr-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {computed.map((m) => (
                <tr key={m.key} className="border-b border-zinc-900 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {m.label}
                    {m.forecast && <span className="ml-1 text-[10px] text-amber-400">forecast</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {m.clients.map((c, i) => (
                        <span
                          key={i}
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            c.predicted ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {c.name} {gbp.format(c.amount)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{gbp.format(m.revenue)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">{gbp.format(m.fixedCost)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">{gbp.format(m.variableCost)}</td>
                  <td className={`py-2 pr-4 text-right tabular-nums ${m.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {gbp.format(m.profit)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{pct(m.margin)}</td>
                  <td className={`py-2 pr-4 text-right tabular-nums ${m.closingBalance >= 0 ? "text-zinc-300" : "text-rose-400"}`}>
                    {gbp.format(m.closingBalance)}
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

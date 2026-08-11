"use client";

import { useState } from "react";
import { useData } from "@/lib/store";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 });

export default function DataEditor() {
  const { months, computed, isEdited, updateMonth, updateClient, addClient, removeClient, resetMonth, resetAll } = useData();
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm text-zinc-400">
          Correct any figure here and every chart, KPI and chat answer recalculates instantly. Edits are saved in
          this browser only.
        </p>
        <button
          onClick={resetAll}
          className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Reset all edits
        </button>
      </div>

      <div className="space-y-2">
        {months.map((m, idx) => {
          const c = computed[idx];
          const open = openKey === m.key;
          return (
            <div key={m.key} className="rounded-xl border border-zinc-800 bg-zinc-900/60">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => setOpenKey(open ? null : m.key)}
              >
                <span className="flex items-center gap-2 text-sm">
                  {m.label}
                  {isEdited(m.key) && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-400">edited</span>}
                  {m.forecast && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">forecast</span>}
                </span>
                <span className="text-xs tabular-nums text-zinc-500">
                  rev {gbp.format(c.revenue)} · profit {gbp.format(c.profit)}
                </span>
              </button>

              {open && (
                <div className="space-y-4 border-t border-zinc-800 px-4 py-4">
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Clients / revenue lines</div>
                    <div className="space-y-2">
                      {m.clients.map((client, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                            value={client.name}
                            onChange={(e) => updateClient(m.key, i, { name: e.target.value })}
                          />
                          <input
                            type="number"
                            className="w-28 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                            value={client.amount}
                            onChange={(e) => updateClient(m.key, i, { amount: Number(e.target.value) })}
                          />
                          <label className="flex items-center gap-1 text-xs text-zinc-500">
                            <input
                              type="checkbox"
                              checked={!!client.predicted}
                              onChange={(e) => updateClient(m.key, i, { predicted: e.target.checked })}
                            />
                            predicted
                          </label>
                          <button
                            onClick={() => removeClient(m.key, i)}
                            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-rose-400 hover:bg-zinc-800"
                          >
                            remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addClient(m.key, { name: "New line", amount: 0 })}
                        className="rounded-md border border-dashed border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                      >
                        + add line
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="text-xs text-zinc-500">
                      Subscriptions (fixed cost)
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                        value={m.subscriptions}
                        onChange={(e) => updateMonth(m.key, { subscriptions: Number(e.target.value) })}
                      />
                    </label>
                    <label className="text-xs text-zinc-500">
                      Brand / marketing spend
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                        value={m.brandExpense}
                        onChange={(e) => updateMonth(m.key, { brandExpense: Number(e.target.value) })}
                      />
                    </label>
                    <label className="text-xs text-zinc-500">
                      Subcontractors & wages
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                        value={m.subcontractExpense}
                        onChange={(e) => updateMonth(m.key, { subcontractExpense: Number(e.target.value) })}
                      />
                    </label>
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>
                      Recomputed: revenue {gbp.format(c.revenue)} · profit {gbp.format(c.profit)} · margin{" "}
                      {c.margin === null ? "—" : `${c.margin.toFixed(1)}%`} · balance {gbp.format(c.closingBalance)}
                    </span>
                    {isEdited(m.key) && (
                      <button onClick={() => resetMonth(m.key)} className="text-sky-400 hover:underline">
                        revert this month
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

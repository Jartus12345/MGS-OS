"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MONTHS } from "./data";
import type { ClientLine, MonthRecord } from "./types";
import { computeSeries, type ComputedMonth } from "./calculations";

type MonthEdit = Partial<Pick<MonthRecord, "clients" | "subscriptions" | "brandExpense" | "subcontractExpense">>;
type Edits = Record<string, MonthEdit>;

const STORAGE_KEY = "mgs-os-edits-v1";

function loadEdits(): Edits {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Edits) : {};
  } catch {
    return {};
  }
}

function applyEdits(base: MonthRecord[], edits: Edits): MonthRecord[] {
  return base.map((m) => {
    const e = edits[m.key];
    if (!e) return m;
    return {
      ...m,
      ...e,
      // an edit invalidates the sheet's stated profit/balance for this month;
      // the calc engine will recompute it from the (now edited) inputs instead.
      knownProfit: undefined,
      knownClosingBalance: undefined,
    };
  });
}

interface DataContextValue {
  months: MonthRecord[];
  computed: ComputedMonth[];
  edits: Edits;
  isEdited: (key: string) => boolean;
  updateMonth: (key: string, patch: MonthEdit) => void;
  updateClient: (monthKey: string, index: number, patch: Partial<ClientLine>) => void;
  addClient: (monthKey: string, client: ClientLine) => void;
  removeClient: (monthKey: string, index: number) => void;
  resetMonth: (key: string) => void;
  resetAll: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [edits, setEdits] = useState<Edits>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading localStorage must happen after mount to avoid an SSR/client
    // hydration mismatch, so this can't be computed during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdits(loadEdits());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  }, [edits, hydrated]);

  const months = useMemo(() => applyEdits(MONTHS, edits), [edits]);
  const computed = useMemo(() => computeSeries(months), [months]);

  const value: DataContextValue = {
    months,
    computed,
    edits,
    isEdited: (key) => !!edits[key],
    updateMonth: (key, patch) =>
      setEdits((prev) => ({
        ...prev,
        [key]: { ...(prev[key] ?? baseMonthEdit(key)), ...patch },
      })),
    updateClient: (monthKey, index, patch) =>
      setEdits((prev) => {
        const currentClients = prev[monthKey]?.clients ?? findBaseMonth(monthKey)?.clients ?? [];
        const nextClients = currentClients.map((c, i) => (i === index ? { ...c, ...patch } : c));
        return { ...prev, [monthKey]: { ...(prev[monthKey] ?? baseMonthEdit(monthKey)), clients: nextClients } };
      }),
    addClient: (monthKey, client) =>
      setEdits((prev) => {
        const currentClients = prev[monthKey]?.clients ?? findBaseMonth(monthKey)?.clients ?? [];
        return {
          ...prev,
          [monthKey]: { ...(prev[monthKey] ?? baseMonthEdit(monthKey)), clients: [...currentClients, client] },
        };
      }),
    removeClient: (monthKey, index) =>
      setEdits((prev) => {
        const currentClients = prev[monthKey]?.clients ?? findBaseMonth(monthKey)?.clients ?? [];
        return {
          ...prev,
          [monthKey]: {
            ...(prev[monthKey] ?? baseMonthEdit(monthKey)),
            clients: currentClients.filter((_, i) => i !== index),
          },
        };
      }),
    resetMonth: (key) =>
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      }),
    resetAll: () => setEdits({}),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function findBaseMonth(key: string): MonthRecord | undefined {
  return MONTHS.find((m) => m.key === key);
}

function baseMonthEdit(key: string): MonthEdit {
  const base = findBaseMonth(key);
  return base
    ? {
        clients: base.clients,
        subscriptions: base.subscriptions,
        brandExpense: base.brandExpense,
        subcontractExpense: base.subcontractExpense,
      }
    : {};
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

import { MONTHS } from "./data";
import type { ClientLine, MonthRecord } from "./types";

export interface ComputedMonth {
  key: string;
  label: string;
  phase: MonthRecord["phase"];
  forecast: boolean;
  clients: ClientLine[];
  revenue: number;
  subscriptions: number;
  brandExpense: number;
  subcontractExpense: number;
  fixedCost: number;
  variableCost: number;
  totalCost: number;
  profit: number;
  /** null when revenue is 0 (margin is undefined, not 0%) */
  margin: number | null;
  openingBalance: number;
  closingBalance: number;
  isActual: boolean; // true if this month's profit came from the sheet, not a projection
  notes?: string;
}

export interface ComputeOptions {
  /** Use the sheet's stated Profit/Closing Balance where available. Default true. */
  useKnownValues?: boolean;
  startingBalance?: number;
}

export function computeSeries(
  months: MonthRecord[] = MONTHS,
  opts: ComputeOptions = {}
): ComputedMonth[] {
  const { useKnownValues = true, startingBalance = 0 } = opts;
  let balance = startingBalance;
  const out: ComputedMonth[] = [];

  for (const m of months) {
    const revenue = m.clients.reduce((sum, c) => sum + c.amount, 0);
    const fixedCost = m.subscriptions;
    const variableCost = m.brandExpense + m.subcontractExpense;
    const totalCost = fixedCost + variableCost;
    const computedProfit = revenue - totalCost + (m.investment ?? 0);

    const isActual = useKnownValues && m.knownProfit !== undefined;
    const profit = isActual ? (m.knownProfit as number) : computedProfit;

    const opening = balance;
    const closing =
      useKnownValues && m.knownClosingBalance !== undefined
        ? (m.knownClosingBalance as number)
        : opening + profit;

    out.push({
      key: m.key,
      label: m.label,
      phase: m.phase,
      forecast: m.forecast,
      clients: m.clients,
      revenue,
      subscriptions: m.subscriptions,
      brandExpense: m.brandExpense,
      subcontractExpense: m.subcontractExpense,
      fixedCost,
      variableCost,
      totalCost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : null,
      openingBalance: opening,
      closingBalance: closing,
      isActual,
      notes: m.notes,
    });

    balance = closing;
  }

  return out;
}

/** Loose lookup: exact key ("2026-07"), exact label ("July 2026"), or a bare
 * month name ("july") which may match multiple years - all matches returned. */
export function findMonths(query: string, months: MonthRecord[] = MONTHS): MonthRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const byKey = months.find((m) => m.key === q);
  if (byKey) return [byKey];

  const byLabel = months.find((m) => m.label.toLowerCase() === q);
  if (byLabel) return [byLabel];

  // bare month name, e.g. "july" or "jul"
  const nameMatches = months.filter((m) => {
    const monthName = m.label.split(" ")[0].toLowerCase();
    return monthName === q || monthName.startsWith(q);
  });
  if (nameMatches.length) return nameMatches;

  // partial/contains match on the full label, e.g. "july 26"
  return months.filter((m) => m.label.toLowerCase().includes(q));
}

export interface NewClientScenario {
  name: string;
  monthlyRevenue: number;
  startKey: string;
  /** Omit for "runs indefinitely to the end of the modelled range" */
  endKey?: string;
  /** Extra delivery/subcontractor cost per month this client adds, if any */
  extraMonthlyCost?: number;
}

/** Returns a deep-cloned, modified month list with a hypothetical client layered in. */
export function applyScenario(
  scenarios: NewClientScenario[],
  base: MonthRecord[] = MONTHS
): MonthRecord[] {
  const clone: MonthRecord[] = base.map((m) => ({
    ...m,
    clients: m.clients.map((c) => ({ ...c })),
  }));

  const keyIndex = new Map(clone.map((m, i) => [m.key, i]));

  for (const s of scenarios) {
    const startIdx = keyIndex.get(s.startKey);
    if (startIdx === undefined) continue;
    const endIdx = s.endKey ? keyIndex.get(s.endKey) ?? clone.length - 1 : clone.length - 1;

    for (let i = startIdx; i <= endIdx; i++) {
      clone[i].clients.push({ name: s.name, amount: s.monthlyRevenue, predicted: true });
      if (s.extraMonthlyCost) {
        clone[i].subcontractExpense += s.extraMonthlyCost;
      }
    }
  }

  return clone;
}

export function costBreakdown(computed: ComputedMonth) {
  return {
    fixed: [{ label: "Subscriptions & tools", amount: computed.subscriptions }],
    variable: [
      { label: "Subcontractors & wages", amount: computed.subcontractExpense },
      { label: "Brand / marketing spend", amount: computed.brandExpense },
    ],
  };
}

/** Cumulative net position (starting balance + running profit) across a series. */
export function runway(computed: ComputedMonth[]) {
  const negativeMonths = computed.filter((m) => m.closingBalance < 0);
  return {
    monthsInDeficit: negativeMonths.length,
    lowestBalance: Math.min(...computed.map((m) => m.closingBalance)),
    lowestBalanceMonth: computed.reduce((min, m) =>
      m.closingBalance < min.closingBalance ? m : min
    ).label,
    currentBalance: computed[computed.length - 1]?.closingBalance ?? 0,
  };
}

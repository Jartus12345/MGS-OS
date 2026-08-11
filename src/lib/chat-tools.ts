import { MONTHS } from "./data";
import type { MonthRecord } from "./types";
import {
  applyScenario,
  computeSeries,
  costBreakdown,
  findMonths,
  runway,
  type ComputedMonth,
  type NewClientScenario,
} from "./calculations";

const round2 = (n: number) => Math.round(n * 100) / 100;

function fmtMonth(m: ComputedMonth) {
  return {
    month: m.label,
    key: m.key,
    revenue: round2(m.revenue),
    fixed_cost: round2(m.fixedCost),
    variable_cost: round2(m.variableCost),
    total_cost: round2(m.totalCost),
    profit: round2(m.profit),
    profit_margin_pct: m.margin === null ? null : round2(m.margin),
    closing_balance: round2(m.closingBalance),
    is_actual: m.isActual,
    forecast: m.forecast,
    clients: m.clients.map((c) => ({
      name: c.name,
      amount: c.amount,
      predicted: !!c.predicted,
    })),
    notes: m.notes ?? null,
  };
}

export function listMonths(months: MonthRecord[]) {
  return months.map((m) => ({ key: m.key, label: m.label, phase: m.phase, forecast: m.forecast }));
}

export function getMonthMetrics(months: MonthRecord[], args: { month: string }) {
  const matches = findMonths(args.month, months);
  if (matches.length === 0) {
    return { error: `No month found matching "${args.month}". Call list_months to see available months.` };
  }
  const computed = computeSeries(months);
  const results = matches.map((m) => {
    const c = computed.find((cm) => cm.key === m.key)!;
    return fmtMonth(c);
  });
  return { matches: results };
}

export function getCostBreakdown(months: MonthRecord[], args: { month: string }) {
  const matches = findMonths(args.month, months);
  if (matches.length === 0) {
    return { error: `No month found matching "${args.month}".` };
  }
  const computed = computeSeries(months);
  return {
    matches: matches.map((m) => {
      const c = computed.find((cm) => cm.key === m.key)!;
      const breakdown = costBreakdown(c);
      return {
        month: c.label,
        fixed: breakdown.fixed.map((f) => ({ ...f, amount: round2(f.amount) })),
        variable: breakdown.variable.map((v) => ({ ...v, amount: round2(v.amount) })),
        total_fixed: round2(c.fixedCost),
        total_variable: round2(c.variableCost),
      };
    }),
  };
}

export function compareRange(months: MonthRecord[], args: { start_month: string; end_month: string }) {
  const startMatches = findMonths(args.start_month, months);
  const endMatches = findMonths(args.end_month, months);
  if (!startMatches.length || !endMatches.length) {
    return { error: "Could not resolve start_month or end_month. Call list_months first." };
  }
  const computed = computeSeries(months);
  const startIdx = computed.findIndex((c) => c.key === startMatches[0].key);
  const endIdx = computed.findIndex((c) => c.key === endMatches[endMatches.length - 1].key);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { error: "start_month must be before end_month." };
  }
  const slice = computed.slice(startIdx, endIdx + 1);
  const totalRevenue = slice.reduce((s, m) => s + m.revenue, 0);
  const totalProfit = slice.reduce((s, m) => s + m.profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;
  return {
    range: `${slice[0].label} - ${slice[slice.length - 1].label}`,
    months: slice.map(fmtMonth),
    total_revenue: round2(totalRevenue),
    total_profit: round2(totalProfit),
    average_margin_pct: avgMargin === null ? null : round2(avgMargin),
    closing_balance_at_end: round2(slice[slice.length - 1].closingBalance),
  };
}

export function getRunway(months: MonthRecord[]) {
  const computed = computeSeries(months);
  const r = runway(computed);
  return {
    current_balance: round2(r.currentBalance),
    lowest_balance: round2(r.lowestBalance),
    lowest_balance_month: r.lowestBalanceMonth,
    months_with_negative_balance: r.monthsInDeficit,
  };
}

export function simulateNewClient(
  months: MonthRecord[],
  args: {
    name: string;
    monthly_revenue: number;
    start_month: string;
    end_month?: string;
    extra_monthly_cost?: number;
  }
) {
  const startMatches = findMonths(args.start_month, months);
  if (!startMatches.length) {
    return { error: `Could not resolve start_month "${args.start_month}". Call list_months first.` };
  }
  const endMatches = args.end_month ? findMonths(args.end_month, months) : undefined;

  const scenario: NewClientScenario = {
    name: args.name || "New client",
    monthlyRevenue: args.monthly_revenue,
    startKey: startMatches[0].key,
    endKey: endMatches?.[0]?.key,
    extraMonthlyCost: args.extra_monthly_cost,
  };

  const baseline = computeSeries(months, { useKnownValues: false });
  const modifiedMonths = applyScenario([scenario], months);
  const scenarioComputed = computeSeries(modifiedMonths, { useKnownValues: false });

  const startIdx = baseline.findIndex((m) => m.key === scenario.startKey);
  const endIdx = scenario.endKey
    ? baseline.findIndex((m) => m.key === scenario.endKey)
    : baseline.length - 1;

  const affected = scenarioComputed.slice(startIdx, endIdx + 1).map((after, i) => {
    const before = baseline[startIdx + i];
    return {
      month: after.label,
      profit_before: round2(before.profit),
      profit_after: round2(after.profit),
      margin_before_pct: before.margin === null ? null : round2(before.margin),
      margin_after_pct: after.margin === null ? null : round2(after.margin),
      closing_balance_before: round2(before.closingBalance),
      closing_balance_after: round2(after.closingBalance),
    };
  });

  return {
    scenario: {
      client_name: scenario.name,
      monthly_revenue: args.monthly_revenue,
      extra_monthly_cost: args.extra_monthly_cost ?? 0,
      starts: baseline[startIdx].label,
      ends: scenario.endKey ? baseline[endIdx].label : "end of modelled range",
    },
    months_affected: affected,
    note: "profit/margin/balance figures above are recomputed from revenue and costs directly (not the sheet's historical stated profit), so both 'before' and 'after' are on the same, comparable basis.",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dispatch table for tool calls with varying argument shapes
export function createToolImplementations(months: MonthRecord[] = MONTHS): Record<string, (args: any) => unknown> {
  return {
    list_months: () => listMonths(months),
    get_month_metrics: (args) => getMonthMetrics(months, args),
    get_cost_breakdown: (args) => getCostBreakdown(months, args),
    compare_range: (args) => compareRange(months, args),
    get_runway: () => getRunway(months),
    simulate_new_client: (args) => simulateNewClient(months, args),
  };
}

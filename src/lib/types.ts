export type Phase = "self-employed" | "limited-company";

export interface ClientLine {
  name: string;
  amount: number;
  /** Predicted / not-yet-signed client (shown in orange on the source spreadsheet) */
  predicted?: boolean;
}

export interface MonthRecord {
  /** e.g. "2025-08" */
  key: string;
  label: string;
  phase: Phase;
  /** true once we're past the spreadsheet's known actuals and into pure forecast */
  forecast: boolean;
  clients: ClientLine[];
  /** Recurring software/tools cost - treated as FIXED cost */
  subscriptions: number;
  /** Marketing / branding / one-off growth spend - treated as VARIABLE (discretionary) cost */
  brandExpense: number;
  /** Subcontractors + owner wage tied to client delivery - treated as VARIABLE cost */
  subcontractExpense: number;
  /** Capital injected by owner or investors this month (not trading income) */
  investment?: number;
  /**
   * Ground-truth profit/closing-balance from the spreadsheet, where known.
   * Left undefined for forecast months so the calculation engine derives them.
   */
  knownProfit?: number;
  knownClosingBalance?: number;
  /**
   * Revenue implied by the spreadsheet's own Revenue row for this month.
   * Used to reconcile against the sum of `clients` (which may be an
   * incomplete/approximate breakdown for far-future forecast months).
   */
  knownRevenue?: number;
  notes?: string;
}

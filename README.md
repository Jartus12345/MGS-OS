# MGS OS — Finance

An interactive financial forecasting tool for Manx Growth Solutions, built from the
company's cashflow spreadsheet. It's a live dashboard plus a chat assistant that
answers real questions ("what's our margin in November?", "what if we sign a client
at £1,500/month?") using the same numbers the dashboard shows — the chat never
guesses a figure, it calls the same calculation engine the charts use.

## What's here

- **Dashboard** — revenue vs profit, profit margin %, fixed vs variable cost, cash
  balance over time, and a full monthly breakdown with predicted (not-yet-signed)
  clients flagged in orange, matching the source spreadsheet's convention.
- **Scenario simulator** — model onboarding (or losing) a client at a given monthly
  value from a chosen month, and see the month-by-month profit/margin/balance impact
  next to the baseline.
- **Data editor** — every client revenue line and cost figure is editable in the
  browser. Edits recalculate everything instantly and persist to this browser's
  local storage (no backend/database needed).
- **Chat** — text or voice (browser mic) questions answered by Claude, which calls
  real tool functions (`get_month_metrics`, `simulate_new_client`, `get_cost_breakdown`,
  etc.) against the live, possibly-edited data rather than estimating numbers itself.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then add your Anthropic API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The chat panel needs
`ANTHROPIC_API_KEY` set in `.env.local` (get one at
[console.anthropic.com](https://console.anthropic.com)) — without it, everything
else (dashboard, scenario simulator, data editor) still works, only the chat will
show a setup error.

## About the seed data

`src/lib/data.ts` was transcribed from the source spreadsheet PDF. Every month's
Revenue, Subscriptions, Brand Expense, Subcontractor Expense, and (where the sheet
states them) Profit and Closing Balance are taken directly from the sheet's own
totals — those are ground truth. The per-client breakdown for each month was
reconstructed by solving it against those totals, since the PDF export lost some of
the spreadsheet's column alignment; every month reconciles exactly. A few line items
near the end of the forecast (predicted-client start dates, subscription costs
beyond Sep 2026) are reasonable assumptions rather than stated figures — anything
that looks off can be corrected in the **Data editor** tab, which is exactly what
it's there for.

Two header years in the source PDF read "January 2026" / "February 2026" a second
time near the end of the sheet — almost certainly a typo for 2027, so this model
treats them as Jan/Feb 2027.

## Deploying

This is a standard Next.js app — deploy it to [Vercel](https://vercel.com/new) (or
any Node host) and set `ANTHROPIC_API_KEY` as an environment variable there. No
database or other backend is required; edits made in the Data editor live in each
visitor's browser only.

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS · Recharts · Anthropic SDK
(`@anthropic-ai/sdk`) with tool use for the chat.

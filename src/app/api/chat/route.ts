import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createToolImplementations } from "@/lib/chat-tools";
import { MONTHS } from "@/lib/data";
import type { MonthRecord } from "@/lib/types";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are the finance assistant built into MGS OS, an internal financial
forecasting tool for Manx Growth Solutions (MGS), a marketing company run by Jenson.

MGS is deliberately entering a phase of spending ahead of revenue (investing in brand,
hiring, subcontractors) before it expects a bigger payoff later. Jenson is deciding
whether to inject personal capital or raise investment, so he needs a sharp, honest
read on margins, runway, and the effect of hypothetical decisions (new clients, new
costs) at any moment - including via quick voice-note style questions.

Rules:
- NEVER estimate or eyeball a number yourself. Always call a tool to get real figures -
  revenue, costs, profit, margin, and balance all come from the underlying model, not
  from you. If a tool doesn't cover what's asked, say so rather than guessing.
- When asked about a specific month, call get_month_metrics. If the user names only a
  month (e.g. "July") with no year, the tool may return multiple matches - use context
  (or ask) to pick the right one, or present both briefly if genuinely ambiguous.
- When asked "what if we signed a client at £X/month" or similar, call
  simulate_new_client. Report the profit/margin/balance before vs after for the
  affected months, not just one number.
- When asked about fixed vs variable costs, call get_cost_breakdown. Subscriptions/
  software is fixed; subcontractors, wages and brand/marketing spend are variable.
- Some months in the model are marked "predicted" - clients not yet signed. Say so
  plainly when a figure depends on unconfirmed revenue.
- Be direct and concise, like a sharp co-founder giving a straight answer, not a
  corporate report. Lead with the number, then one or two sentences of context. No
  disclaimers, no fluff, no "as an AI" hedging.
- Money is in GBP (£).`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_months",
    description:
      "List every month in the financial model with its key, label, phase (self-employed vs limited-company) and whether it's forecast. Call this first if unsure what months are available.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_month_metrics",
    description:
      "Get revenue, fixed/variable/total cost, profit, profit margin %, and closing cash balance for one month. Accepts a month name, label, or key (e.g. 'july', 'July 2026', '2026-07').",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Month to look up, e.g. 'November 2025' or 'july'." },
      },
      required: ["month"],
    },
  },
  {
    name: "get_cost_breakdown",
    description: "Get the fixed vs variable cost breakdown (with line items) for one month.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Month to look up." },
      },
      required: ["month"],
    },
  },
  {
    name: "compare_range",
    description:
      "Get totals and average margin across a range of months (inclusive), e.g. for 'how did Q3 look' or 'last 6 months'.",
    input_schema: {
      type: "object",
      properties: {
        start_month: { type: "string" },
        end_month: { type: "string" },
      },
      required: ["start_month", "end_month"],
    },
  },
  {
    name: "get_runway",
    description:
      "Get current cash balance, the lowest projected balance and when it occurs, and how many months the balance goes negative. Use this for runway / 'can we afford to keep losing money' questions.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "simulate_new_client",
    description:
      "Model the effect of signing (or losing, with a negative monthly_revenue) a client from a given start month onward. Returns profit, margin and cash balance before vs after for every affected month, recomputed on a consistent basis.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Label for the hypothetical client." },
        monthly_revenue: { type: "number", description: "Monthly revenue in GBP this client adds. Use a negative number to model losing a client." },
        start_month: { type: "string", description: "First month this client's revenue applies, e.g. 'November 2026'." },
        end_month: { type: "string", description: "Optional last month it applies. Omit for 'runs to the end of the modelled range'." },
        extra_monthly_cost: { type: "number", description: "Optional extra delivery cost per month (e.g. subcontractor time) this client requires." },
      },
      required: ["name", "monthly_revenue", "start_month"],
    },
  },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  const body: { messages: ChatMessage[]; months?: MonthRecord[] } = await request.json();
  const { messages, months } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const activeMonths = Array.isArray(months) && months.length > 0 ? months : MONTHS;
  const toolImplementations = createToolImplementations(activeMonths);

  const anthropic = new Anthropic({ apiKey });

  const conversation: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let finalText = "";

  for (let iteration = 0; iteration < 6; iteration++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: conversation,
    });

    const textBlocks = response.content.filter((b) => b.type === "text") as Anthropic.TextBlock[];
    finalText = textBlocks.map((b) => b.text).join("\n").trim();

    if (response.stop_reason !== "tool_use") {
      break;
    }

    conversation.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const impl = toolImplementations[block.name];
      let result: unknown;
      try {
        result = impl ? impl(block.input) : { error: `Unknown tool: ${block.name}` };
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Tool execution failed." };
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    conversation.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({ reply: finalText || "I couldn't work that out - try rephrasing." });
}

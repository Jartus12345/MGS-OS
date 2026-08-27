import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export interface StageCallResult {
  json: unknown;
  rawText: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Calls Claude for a single pipeline stage and parses a strict-JSON response.
 * Every stage prompt instructs the model to respond with ONLY a JSON object
 * matching the given shape — this keeps every stage's output structured and
 * traceable (Part O — Internal Traceability) rather than free text.
 */
export async function runStagePrompt(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<StageCallResult> {
  const { system, user, maxTokens = 32000 } = params;
  const anthropic = getClient();

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    messages: [{ role: "user", content: user }],
  });

  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") {
    throw new Error(
      `Claude declined this stage (${response.stop_details?.category ?? "unspecified"}): ${
        response.stop_details?.explanation ?? "no explanation given"
      }`
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

  return {
    json: parseJsonResponse(rawText),
    rawText,
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

function parseJsonResponse(text: string): unknown {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new Error("Stage response was not valid JSON. Raw response has been preserved for inspection.");
  }
}

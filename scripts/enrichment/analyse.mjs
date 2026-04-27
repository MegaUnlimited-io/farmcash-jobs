import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const AGENT_MD = readFileSync(join(__dir, "agent.md"), "utf8");

const ENRICHMENT_TOOL = {
  name: "submit_enrichment",
  description: "Submit your analysis of the reward app offer for FarmCash Jobs.",
  input_schema: {
    type: "object",
    properties: {
      ad_aggression: {
        type: "number",
        description: "1–5. Higher = fewer / less intrusive ads (better for farmer).",
      },
      description: {
        type: "string",
        description: "2–3 sentence wiki description of the app and what the farmer does.",
      },
      comment: {
        type: "string",
        description: "1–2 sentence tip for farmers: lead with a positive, then any important caveat.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Confidence in the ad_aggression rating based on available reviews.",
      },
    },
    required: ["ad_aggression", "description", "comment", "confidence"],
  },
};

/**
 * @param {object} job  - Row from the jobs table
 * @param {import('./scraper.mjs').PlayStoreData|null} playStoreData
 * @param {object} [options]
 * @param {string} [options.model]
 * @returns {Promise<{ad_aggression:number, task_difficulty:number, payment_speed:number, description:string, comment:string, confidence:string}>}
 */
export async function analyseJob(job, playStoreData, options = {}) {
  const model =
    options.model ??
    process.env.ENRICHMENT_MODEL ??
    "claude-haiku-4-5-20251001";

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = buildUserPrompt(job, playStoreData);

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: AGENT_MD,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [ENRICHMENT_TOOL],
    tool_choice: { type: "tool", name: "submit_enrichment" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not call submit_enrichment");

  const result = toolUse.input;

  result.ad_aggression = Math.min(5, Math.max(1, Math.round(result.ad_aggression)));

  return result;
}

/** @param {object} job @param {import('./scraper.mjs').PlayStoreData|null} ps */
function buildUserPrompt(job, ps) {
  const lines = [
    `## Offer Analysis Request`,
    ``,
    `**App:** ${job.name} (\`${job.app_package_id}\`)`,
  ];

  if (job.payout_min != null || job.payout_max != null) {
    const range =
      job.payout_min != null && job.payout_min !== job.payout_max
        ? `${job.payout_min}–${job.payout_max} Seeds`
        : `${job.payout_max ?? job.payout_min} Seeds`;
    lines.push(`**Reward:** ${range}`);
  }

  if (ps?.description) {
    lines.push(``, `### Play Store Description`, ps.description.slice(0, 1500));
  } else {
    lines.push(``, `_No Play Store description available._`);
  }

  if (ps?.reviews?.length) {
    lines.push(
      ``,
      `### User Reviews (${ps.reviews.length} most helpful)`,
      ps.reviews.join("\n---\n")
    );
  } else {
    lines.push(``, `_No Play Store reviews available._`);
  }

  lines.push(``, `Call \`submit_enrichment\` with your analysis.`);
  return lines.join("\n");
}

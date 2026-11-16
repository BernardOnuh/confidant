// The contestants: every model gets the same instructions, the same prices and one choice per question.
import { config } from "./config.mjs";
import { parseDecision, toleranceText } from "./grade.mjs";

export function systemPrompt(mistakeCost = config.mistakeCostUsd) {
  return [
    "You are an autonomous agent answering questions for a principal who pays for your mistakes.",
    "For every question you choose one of two actions:",
    `- "answer": reply from your own knowledge. Free, but if your answer is outside the tolerance, it costs the principal $${mistakeCost.toFixed(2)}.`,
    "- \"buy\": buy a verified answer from the Telegraph intelligence network for about $0.01, and use that instead.",
    "Buy only when the chance your own answer is wrong is worth more than the price. Do not buy what you already know.",
    "Always give your best guess, even when you decide to buy.",
    "Reply with one JSON object and nothing else:",
    '{"guess": <number>, "confidence": <0 to 1, the probability your guess is within tolerance>, "decision": "answer" or "buy", "why": "<one short sentence>"}',
  ].join("\n");
}

export function userPrompt(q, now = new Date()) {
  return `Current date and time: ${now.toISOString().slice(0, 16).replace("T", " ")} UTC.\n` +
    `Question: ${q.prompt}\nAnswer in ${q.unit}. It counts as correct if it is ${toleranceText(q.tolerance, q.unit)} of the true value.`;
}

async function askOnce(model, q, now, maxTokens = 1500) {
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/BernardOnuh/confidant",
      "X-Title": "Confidant",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt() }, { role: "user", content: userPrompt(q, now) }],
      temperature: 0,
      max_tokens: maxTokens,
      reasoning: { effort: "low", exclude: true },
      usage: { include: true },
    }),
    signal: AbortSignal.timeout(90000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw Object.assign(new Error(body.error?.message || `OpenRouter answered ${res.status}`), { retry: !/more credits/i.test(body.error?.message || "") && (res.status === 402 || res.status === 429 || res.status >= 500 || /in-flight/i.test(body.error?.message || "")) });
  const choice = body.choices?.[0];
  const text = choice?.message?.content || "";
  const d = parseDecision(text);
  if (!d || d.guess === null) {
    throw Object.assign(new Error(text ? "the reply was not the requested JSON: " + text.slice(0, 120) : `empty reply (finish reason: ${choice?.finish_reason || "none"})`), { retry: true });
  }
  return { ...d, llm_cost_usd: body.usage?.cost ?? 0, tokens: body.usage?.total_tokens ?? null, ms: Date.now() - t0 };
}

// One retry for an empty or malformed reply, a rate limit or a provider error; the same question and prompt both times,
// with room for longer reasoning in case the first reply ran out of tokens.
export async function ask(model, q, { now = new Date() } = {}) {
  try {
    return await askOnce(model, q, now);
  } catch (e) {
    if (!e.retry) throw e;
    await new Promise(r => setTimeout(r, 2000));
    return { ...(await askOnce(model, q, now, 4000)), retried: true };
  }
}

// Offline stand-ins with fixed personalities, for MOCK=1.
export const MOCK_MODELS = ["mock/know-it-all", "mock/cautious", "mock/calibrated"];

export async function mockAsk(model, q, truthValue) {
  const t = Array.isArray(truthValue) ? truthValue[0] : truthValue;
  const live = q.category !== "cve";
  const knows = !live && Math.random() < 0.6;
  const guess = knows ? t : t * (1 + (Math.random() - 0.5) * (live ? 0.2 : 0.3));
  const style = model.split("/")[1];
  const confidence = style === "know-it-all" ? 0.95 : style === "cautious" ? 0.3 : knows ? 0.9 : 0.2;
  const decision = style === "know-it-all" ? "answer" : style === "cautious" ? "buy" : confidence < 0.8 ? "buy" : "answer";
  return { guess: +guess.toFixed(4), confidence, decision, why: "mock", llm_cost_usd: 0.0001, tokens: 0, ms: 3 };
}

// Formatting shared by the server-rendered page and the browser.
export const pct = x => (x === null || x === undefined ? "–" : Math.round(x * 100) + "%");
export const usd = x => (x === null || x === undefined ? "–" : x === 0 ? "$0" : x < 0.01 ? "$" + x.toFixed(4) : "$" + x.toFixed(3));
export const num = v => v === null || v === undefined ? "–"
  : typeof v === "number" ? (Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(+v.toFixed(4))) : String(v);
export const plural = (n, w) => `${n} ${w}${n === 1 ? "" : w.endsWith("s") ? "es" : "s"}`;

export function ago(iso, now = Date.now()) {
  const s = (now - new Date(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return plural(Math.floor(s / 60), "minute") + " ago";
  if (s < 86400) return plural(Math.floor(s / 3600), "hour") + " ago";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Model names and makers, made readable: "openai/gpt-6.1-terra" → GPT 6.1 Terra, OpenAI.
const ORGS = { anthropic: "Anthropic", openai: "OpenAI", google: "Google", "x-ai": "xAI", deepseek: "DeepSeek",
  "meta-llama": "Meta", qwen: "Qwen", mistralai: "Mistral", mock: "Simulated" };
export function modelName(m) {
  const [org, id = m] = m.split("/");
  const nice = id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bGpt\b/g, "GPT").replace(/\bDeepseek\b/g, "DeepSeek").replace(/\bQwen(\d)/g, "Qwen $1").replace(/\b(\d) (\d)$/, "$1.$2");
  return { nice, maker: ORGS[org] || org, initials: nice.split(" ").map(w => w[0]).join("").slice(0, 2) };
}

// Plain words for the technical failures a model or a purchase can hit.
export function niceError(msg = "") {
  if (/more credits|in-flight|afford/i.test(msg)) return "Skipped: the model account ran out of credit";
  if (/empty reply/i.test(msg)) return "Gave no answer";
  if (/requested JSON/i.test(msg)) return "Reply could not be read";
  if (/timeout|aborted/i.test(msg)) return "Timed out";
  if (/fetch failed|session|ECONN|socket/i.test(msg)) return "Network error";
  if (/could not route/i.test(msg)) return "No Telegraph miner was available";
  if (/had no/i.test(msg)) return "Telegraph had no answer for this";
  if (/budget/i.test(msg)) return msg;
  return msg.slice(0, 80);
}

export const HINTS = {
  crypto: s => `What is the price of ${s} right now?`,
  fx: s => `How much ${s} is one US dollar worth right now?`,
  weather: s => `What is the temperature in ${s} right now?`,
  gas: () => "What is Ethereum's gas price right now?",
  cve: s => `What is the CVSS severity score of ${s}?`,
};

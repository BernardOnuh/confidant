// Data for the pages, loaded on the server. Each loader falls back to an empty value, so a storage hiccup
// shows an empty section instead of an error page.
import { adviceTerms, getSavings, getSummary, listRounds, oneRound, options, showcase } from "@/src/api.mjs";

export const EMPTY_SUMMARY = { rounds: 0, questions: 0, decisions: 0, leaderboard: [], telegraph: { purchases: 0, spent_usd: 0, correct: 0 }, mistake_cost_usd: 0.25, updated_at: null };

async function safe(work, fallback, name) {
  try { return (await work())[1]; } catch (e) { console.error(`${name}:`, e.message); return fallback; }
}

export const loadSummary = () => safe(getSummary, EMPTY_SUMMARY, "summary");
export const loadOptions = async () => (await options())[1];
export const loadShowcase = () => safe(showcase, { replay: [], receipts: [] }, "showcase");
export const loadSavings = () => safe(getSavings, null, "savings");
export const loadRounds = n => safe(() => listRounds(n), [], "rounds");
export async function loadRound(id) {
  try { const [status, r] = await oneRound(id); return status === 200 ? r : null; } catch (e) { console.error("round:", e.message); return null; }
}
export { adviceTerms };

// The public address, for share cards and code samples. Vercel provides it; SITE_URL overrides (a custom domain).
export const siteUrl = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

// Settings, read once from the environment (and .env next to package.json).
import "./http.mjs";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  const p = join(ROOT, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv();

// Where test USDC lives on each network Telegraph accepts (from the Telegraph x402 docs).
export const NETWORKS = {
  "eip155:11155111": { name: "Ethereum Sepolia", asset: "0xcc194e1a843B658526D0D5C431f670028582Ae17", rpc: "https://ethereum-sepolia-rpc.publicnode.com", explorer: "https://sepolia.etherscan.io" },
  "eip155:84532": { name: "Base Sepolia", asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", rpc: "https://sepolia.base.org", explorer: "https://sepolia.basescan.org" },
};

// The contestants. Any OpenRouter model id works; override with MODELS=a,b,c.
export const DEFAULT_MODELS = [
  "anthropic/claude-sonnet-5.5",
  "openai/gpt-6.1-terra",
  "google/gemini-4-hydrogen",
  "x-ai/grok-4.7",
  "deepseek/deepseek-v4.1-flash",
  "meta-llama/llama-4-maverick",
  "qwen/qwen3.8-flash",
  "mistralai/mistral-large-4-0",
];

const env = process.env;
export const config = {
  port: Number(env.PORT || 8800),
  host: env.HOST || "127.0.0.1",
  dataDir: env.DATA_DIR || join(ROOT, "data"),
  openrouterKey: env.OPENROUTER_API_KEY || "",
  models: (env.MODELS ? env.MODELS.split(",") : DEFAULT_MODELS).map(s => s.trim()).filter(Boolean),
  telegraphNode: (env.TELEGRAPH_NODE || "https://devnode.telegraphprotocol.com").replace(/\/$/, ""),
  walletKey: env.EVM_PRIVATE_KEY || "",
  payNetwork: env.PAY_NETWORK || "eip155:11155111",
  maxPricePerCall: env.MAX_PRICE_PER_CALL || "50000",     // 6-decimal USDC: 50000 = $0.05, a hard cap per purchase
  dailyBudgetUsd: Number(env.DAILY_BUDGET_USD || 5),     // stop buying once today's Telegraph spend reaches this
  mistakeCostUsd: Number(env.MISTAKE_COST_USD || 0.25),  // what a wrong final answer costs, as told to every model
  tryPerHour: Number(env.TRY_PER_HOUR) || 3,           // visitor questions per IP per hour
  roundEveryMin: Number(env.ROUND_EVERY_MIN || 0),       // 0 = no scheduled rounds
  questionsPerRound: Number(env.QUESTIONS_PER_ROUND || 9),
  nvdKey: env.NVD_API_KEY || "",
  mock: env.MOCK === "1",                                // fake models and fake purchases, for trying the pipeline offline
};

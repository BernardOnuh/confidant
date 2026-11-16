#!/usr/bin/env node
// npm run round [-- --mock] [--questions 5] [--models a,b]
// npm run wallet [-- mint]
// npm run check      is everything ready for a real round?
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, formatEther, formatUnits, parseAbi } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia, baseSepolia } from "viem/chains";
import { config, NETWORKS, ROOT } from "./config.mjs";
import { runRound } from "./round.mjs";
import { summary } from "./store.mjs";

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf("--" + name); return i === -1 ? null : args[i + 1] ?? true; };
const usdc = parseAbi(["function balanceOf(address) view returns (uint256)", "function mint(address,uint256)"]);
const chains = { "eip155:11155111": sepolia, "eip155:84532": baseSepolia };

async function wallet() {
  let key = config.walletKey;
  if (!key) {
    // A fresh throwaway testnet key, kept only in .env (git-ignored) and never printed.
    key = generatePrivateKey();
    const p = join(ROOT, ".env");
    const prev = existsSync(p) ? readFileSync(p, "utf8") : "";
    writeFileSync(p, prev + (prev && !prev.endsWith("\n") ? "\n" : "") + `EVM_PRIVATE_KEY=${key}\n`, { mode: 0o600 });
    console.log("Made a new testnet wallet and saved its key to .env");
  }
  const account = privateKeyToAccount(key);
  console.log("Address:", account.address);
  for (const [id, net] of Object.entries(NETWORKS)) {
    const client = createPublicClient({ chain: chains[id], transport: http(net.rpc) });
    const [eth, bal] = await Promise.all([
      client.getBalance({ address: account.address }).catch(() => null),
      client.readContract({ address: net.asset, abi: usdc, functionName: "balanceOf", args: [account.address] }).catch(() => null),
    ]);
    console.log(`  ${net.name.padEnd(17)} ${eth === null ? "?" : formatEther(eth)} ETH   ${bal === null ? "?" : formatUnits(bal, 6)} test USDC${id === config.payNetwork ? "   <- pays for purchases" : ""}`);
  }
  if (args.includes("mint")) {
    // Telegraph's Sepolia test USDC lets anyone mint; it needs a little Sepolia ETH for gas.
    const net = NETWORKS["eip155:11155111"];
    const w = createWalletClient({ account, chain: sepolia, transport: http(net.rpc) });
    const hash = await w.writeContract({ address: net.asset, abi: usdc, functionName: "mint", args: [account.address, 10_000_000n] });
    console.log(`Minting 10 test USDC: ${net.explorer}/tx/${hash}`);
    await createPublicClient({ chain: sepolia, transport: http(net.rpc) }).waitForTransactionReceipt({ hash });
    console.log("Done.");
  }
}

// Checks the OpenRouter key, the model list, the wallet balance and Telegraph's payment terms, without spending anything.
async function check() {
  let ready = true;
  const line = (ok, what, detail = "") => { console.log(`${ok ? "  ok  " : "  --  "} ${what}${detail ? ": " + detail : ""}`); if (!ok) ready = false; };

  if (!config.openrouterKey) line(false, "OpenRouter key", "add OPENROUTER_API_KEY to .env");
  else {
    // The key's own limit isn't money: the account balance is credits bought minus usage.
    const r = await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${config.openrouterKey}` } }).catch(e => ({ ok: false, statusText: e.message }));
    const j = r.ok ? (await r.json()).data : null;
    const left = j ? j.total_credits - j.total_usage : null;
    line(r.ok && left >= 0.5, "OpenRouter key", !r.ok ? `rejected (${r.status || r.statusText})` : `valid, $${left.toFixed(2)} credit left${left < 0.5 ? ": add credit at openrouter.ai/settings/credits" : ""}`);
  }

  const list = await fetch("https://openrouter.ai/api/v1/models").then(r => r.json()).then(j => new Set(j.data.map(m => m.id))).catch(() => null);
  const missing = list ? config.models.filter(m => !list.has(m)) : [];
  line(list && !missing.length, `${config.models.length} models on OpenRouter`, !list ? "couldn't fetch the model list" : missing.length ? "missing " + missing.join(", ") : "");

  const net = NETWORKS[config.payNetwork];
  if (!config.walletKey) line(false, "Wallet", "run `npm run wallet` to make one");
  else {
    const account = privateKeyToAccount(config.walletKey);
    const client = createPublicClient({ chain: chains[config.payNetwork], transport: http(net.rpc) });
    const bal = await client.readContract({ address: net.asset, abi: usdc, functionName: "balanceOf", args: [account.address] }).catch(() => null);
    const usd = bal === null ? null : Number(formatUnits(bal, 6));
    line(usd > 0, `Wallet on ${net.name}`, usd === null ? "couldn't read the balance" : `${usd} test USDC (about ${Math.floor(usd / 0.01)} purchases) at ${account.address}`);
  }

  // Ask unpaid: the 402 reply lists the payment options. One retry, as the node occasionally drops a request.
  let terms = null;
  for (let i = 0; i < 2 && !terms; i++) {
    try {
      const res = await fetch(`${config.telegraphNode}/engine/v1/ask`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "CRYPTO_PRICE_USD", params: { symbol: "BTC" } }), signal: AbortSignal.timeout(20000) });
      terms = JSON.parse(Buffer.from(res.headers.get("payment-required"), "base64").toString()).accepts.find(a => a.network === config.payNetwork && a.scheme === "exact");
    } catch {}
  }
  line(!!terms && terms.asset.toLowerCase() === net.asset.toLowerCase(), "Telegraph accepts this wallet's USDC",
    terms ? `$${Number(terms.amount) / 1e6} per answer on ${net.name}` : `no ${net.name} payment option from ${config.telegraphNode}`);

  console.log(ready ? "\nReady: run `npm run round`." : "\nNot ready yet: fix the lines marked --.");
}

async function round() {
  const models = flag("models");
  const n = Number(flag("questions")) || undefined;
  if (n) config.questionsPerRound = n;
  if (args.includes("--mock")) config.mock = true;
  await runRound({ models: typeof models === "string" ? models.split(",") : undefined, source: "cli" });
  const s = summary();
  console.log("\nLeaderboard (all rounds):");
  for (const r of s.leaderboard) {
    console.log(`  ${r.model.padEnd(32)} judgment ${(r.judgment * 100).toFixed(0).padStart(3)}%  accuracy ${r.accuracy === null ? "  –" : (r.accuracy * 100).toFixed(0).padStart(3)}%  ` +
      `bought ${(r.buy_rate * 100).toFixed(0).padStart(3)}%  overconfident ${r.overconfident}  true cost/q $${r.true_cost_per_question.toFixed(4)}`);
  }
}

const cmd = args[0];
if (cmd === "wallet") await wallet();
else if (cmd === "round") await round();
else if (cmd === "check") await check();
else console.log("usage: node src/cli.mjs round [--mock] [--questions N] [--models a,b] | wallet [mint] | check");

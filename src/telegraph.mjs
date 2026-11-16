// Buying intelligence from Telegraph: POST /engine/v1/ask, paid per call with x402 in test USDC.
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { config, NETWORKS } from "./config.mjs";

export function signalUrl(hash) {
  return hash ? `${config.telegraphNode}/engine/v1/signal/${hash}` : null;
}

function decodeReceipt(header) {
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, "base64").toString()); } catch { return null; }
}

export function makeBuyer({ privateKey = config.walletKey, network = config.payNetwork, cap = config.maxPricePerCall } = {}) {
  if (!privateKey) throw new Error("EVM_PRIVATE_KEY is not set: run `npm run wallet` to make a testnet wallet");
  const net = NETWORKS[network];
  if (!net) throw new Error(`PAY_NETWORK ${network} is not one Confidant knows`);
  const account = privateKeyToAccount(privateKey);
  const pay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network, client: new ExactEvmScheme(account) }],
    // Telegraph's test USDC isn't a built-in asset; allow it, and cap what any single call may cost.
    spendControls: { allowedAssets: [{ network, asset: net.asset, maxAmountPerPayment: String(cap) }] },
  });

  // A network error before any response (the connection dropped) gets one retry.
  async function buy(intent, params, field) {
    const first = await buyOnce(intent, params, field);
    if (first.ok || first.status || !/fetch failed|ECONNRESET|socket/i.test(first.error || "")) return first;
    await new Promise(r => setTimeout(r, 1500));
    return { ...(await buyOnce(intent, params, field)), retried: true };
  }

  async function buyOnce(intent, params, field) {
    const t0 = Date.now();
    try {
      const res = await pay(`${config.telegraphNode}/engine/v1/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, params }),
        signal: AbortSignal.timeout(60000),
      });
      const body = await res.json().catch(() => ({}));
      const receipt = decodeReceipt(res.headers.get("x-telegraph-receipt"));
      if (!res.ok) {
        return { ok: false, status: res.status, error: body.error || body.message || `HTTP ${res.status}`, receipt, ms: Date.now() - t0 };
      }
      const value = body.result?.[field];
      return {
        ok: value !== undefined && value !== null && body.field_status?.[field] !== "missing",
        value: value ?? null,
        miner_id: body.miner_id, miner_name: body.miner_name,
        cost_usd: body.cost_usd ?? 0.01,
        signal_hash: body.signal_hash, signal_url: signalUrl(body.signal_hash),
        field_status: body.field_status?.[field],
        receipt, payer: account.address, network,
        ms: Date.now() - t0,
        ...(value === undefined || value === null ? { error: `the answer had no ${field}` } : {}),
      };
    } catch (e) {
      return { ok: false, error: e.cause?.message ? `${e.message}: ${e.cause.message}` : e.message, ms: Date.now() - t0 };
    }
  }
  return { buy, address: account.address, network };
}

// Offline stand-in: "buys" a slightly noisy copy of the truth, so the pipeline can run with no wallet.
export function makeMockBuyer() {
  return {
    address: "0xMOCK", network: "mock",
    async buy(intent, params, field, q, t) {
      const v = Array.isArray(t.value) ? t.value[0] : t.value * (1 + (Math.random() - 0.5) * 0.004);
      return { ok: true, value: v, miner_id: "mock", miner_name: "Mock miner", cost_usd: 0.01, signal_hash: null, signal_url: null, ms: 5 };
    },
  };
}

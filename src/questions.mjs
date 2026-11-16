// The question bank. Every category maps to one Telegraph Intent and one independent truth source.
import { randomUUID } from "node:crypto";
import * as truth from "./truth.mjs";

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export const CATEGORIES = {
  crypto: {
    label: "Crypto price",
    subjects: () => truth.COINS,
    intent: () => "CRYPTO_PRICE_USD",
    params: s => ({ symbol: s }),
    field: "price_usd",
    prompt: s => `What is the price of ${s} in US dollars right now?`,
    unit: "US dollars",
    tolerance: { rel: 0.01 },
    truth: s => truth.cryptoPrice(s),
  },
  fx: {
    label: "Exchange rate",
    subjects: () => truth.CURRENCIES,
    intent: s => `FX_NOW_${s}`,
    params: s => ({ currency: s }),
    field: "rate",
    prompt: s => `How many ${s} does one US dollar buy right now (mid-market rate)?`,
    unit: s => `${s} per US dollar`,
    tolerance: { rel: 0.01 },
    truth: s => truth.fxRate(s),
  },
  weather: {
    label: "Temperature",
    subjects: () => Object.keys(truth.CITIES),
    intent: () => "WEATHER_CHECK_TEMPERATURE",
    params: s => ({ location: s }),
    field: "temperature_c",
    prompt: s => `What is the air temperature in ${s} right now, in degrees Celsius?`,
    unit: "degrees Celsius",
    tolerance: { abs: 2.5 },
    truth: s => truth.temperatureC(s),
  },
  gas: {
    label: "Ethereum gas",
    subjects: () => ["ethereum"],
    intent: () => "GAS_PRICE_GENERAL",
    params: s => ({ chain: s }),
    field: "gas_price_gwei",
    prompt: () => "What is the current gas price on Ethereum mainnet, in gwei?",
    unit: "gwei",
    tolerance: { rel: 0.35, abs: 0.3 },
    truth: () => truth.gasPriceGwei(),
  },
  cve: {
    label: "CVE severity",
    subjects: () => truth.FAMOUS_CVES,
    intent: () => "CVE_LOOKUP_CVSS",
    params: s => ({ cve_id: s }),
    field: "cvss_score",
    prompt: s => `What is the CVSS base score (0.0 to 10.0) of ${s}?`,
    unit: "CVSS points",
    tolerance: { abs: 0.05 },
    truth: s => truth.cvssTruth(s),
  },
};

export const CVE_RX = /^CVE-\d{4}-\d{4,7}$/;

export function makeQuestion(category, subject) {
  const c = CATEGORIES[category];
  if (!c) throw new Error(`unknown category ${category}`);
  return {
    id: randomUUID().slice(0, 8),
    category, subject,
    intent: c.intent(subject),
    params: c.params(subject),
    field: c.field,
    prompt: c.prompt(subject),
    unit: typeof c.unit === "function" ? c.unit(subject) : c.unit,
    tolerance: c.tolerance,
  };
}

// A round's mix: live data no model can know, plus CVEs some models will remember.
export async function roundQuestions(n = 9, recent = null) {
  const plan = ["crypto", "crypto", "fx", "weather", "weather", "gas", "cve-famous", "cve-recent", "cve-recent"];
  while (plan.length < n) plan.push(pick(["crypto", "fx", "weather", "cve-famous", "cve-recent"]));
  const qs = [];
  const used = new Set();
  // A repeated question is redrawn from the same slot, so a round always has n questions.
  const slots = plan.slice(0, n);
  for (let i = 0; i < slots.length && i < n + 30; i++) {
    const slot = slots[i];
    let category = slot, subject;
    if (slot === "cve-recent") {
      category = "cve";
      recent = recent || await truth.recentCves().catch(() => []);
      subject = recent.length ? pick(recent) : pick(truth.FAMOUS_CVES);
    } else {
      if (slot === "cve-famous") category = "cve";
      subject = pick(CATEGORIES[category].subjects());
    }
    const key = category + ":" + subject;
    if (used.has(key)) { slots.push(slot); continue; }
    used.add(key);
    qs.push(makeQuestion(category, subject));
  }
  return qs;
}

export function fetchTruth(q) {
  return CATEGORIES[q.category].truth(q.subject);
}

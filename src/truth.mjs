// Ground truth from sources independent of Telegraph. Each source has a fallback,
// and a question whose truth can't be fetched is voided rather than guessed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.mjs";

export async function getJSON(url, { timeout = 15000, headers = {}, method = "GET", body } = {}) {
  const res = await fetch(url, { method, headers: { "User-Agent": "confidant/0.1", ...headers }, body, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}

async function firstOf(sources) {
  const errors = [];
  for (const [name, fn] of sources) {
    try {
      const value = await fn();
      if (value !== undefined && value !== null && !Number.isNaN(value)) return { value, source: name };
      errors.push(`${name}: empty`);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  }
  throw new Error("no truth source answered (" + errors.join("; ") + ")");
}

const GECKO_IDS = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", DOGE: "dogecoin", ADA: "cardano", AVAX: "avalanche-2",
  LINK: "chainlink", DOT: "polkadot", LTC: "litecoin", NEAR: "near", TRX: "tron" };
export const COINS = Object.keys(GECKO_IDS);

export function cryptoPrice(symbol) {
  return firstOf([
    ["Coinbase", async () => Number((await getJSON(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`)).data.amount)],
    ["CoinGecko", async () => (await getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${GECKO_IDS[symbol]}&vs_currencies=usd`))[GECKO_IDS[symbol]].usd],
    ["Kraken", async () => {
      const r = await getJSON(`https://api.kraken.com/0/public/Ticker?pair=${symbol === "BTC" ? "XBT" : symbol}USD`);
      return Number(Object.values(r.result)[0].c[0]);
    }],
  ]);
}

// Telegraph sells FX_NOW_<code> for these currencies: units of <code> one US dollar buys.
export const CURRENCIES = ["EUR", "CAD", "SEK"];

export function fxRate(code) {
  return firstOf([
    ["ExchangeRate-API", async () => (await getJSON("https://open.er-api.com/v6/latest/USD")).rates[code]],
    ["Frankfurter (ECB)", async () => (await getJSON(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${code}`)).rates[code]],
  ]);
}

// Fixed coordinates, so the truth doesn't depend on a geocoder.
export const CITIES = {
  "Lagos": [6.4541, 3.3947], "London": [51.5072, -0.1276], "New York": [40.7128, -74.006], "Tokyo": [35.6762, 139.6503],
  "Sydney": [-33.8688, 151.2093], "Sao Paulo": [-23.5505, -46.6333], "Cairo": [30.0444, 31.2357], "Mumbai": [19.076, 72.8777],
  "Toronto": [43.6532, -79.3832], "Paris": [48.8566, 2.3522], "Nairobi": [-1.2921, 36.8219], "Dubai": [25.2048, 55.2708],
  "Singapore": [1.3521, 103.8198], "Mexico City": [19.4326, -99.1332], "Berlin": [52.52, 13.405], "Reykjavik": [64.1466, -21.9426],
  "Johannesburg": [-26.2041, 28.0473], "Seoul": [37.5665, 126.978], "Buenos Aires": [-34.6037, -58.3816], "Accra": [5.6037, -0.187],
};

export function temperatureC(city) {
  const [lat, lon] = CITIES[city];
  return firstOf([
    ["Open-Meteo", async () => (await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`)).current.temperature_2m],
    ["MET Norway", async () => (await getJSON(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`)).properties.timeseries[0].data.instant.details.air_temperature],
  ]);
}

const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://cloudflare-eth.com"];

export function gasPriceGwei() {
  return firstOf(RPCS.map(url => [new URL(url).host, async () => {
    const r = await getJSON(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }) });
    return Number(BigInt(r.result)) / 1e9;
  }]));
}

// ----- CVEs, from NIST's National Vulnerability Database -----
// Keyless NVD allows 5 requests per 30 seconds, so calls are spaced and CVE scores are cached.
let nvdNext = 0;
async function nvd(query) {
  const gap = config.nvdKey ? 700 : 6500;
  const wait = nvdNext - Date.now();
  nvdNext = Math.max(Date.now(), nvdNext) + gap;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  return getJSON(`https://services.nvd.nist.gov/rest/json/cves/2.0?${query}`, { timeout: 30000, headers: config.nvdKey ? { apiKey: config.nvdKey } : {} });
}

// Every base score NVD lists (v4.0, v3.1, v3.0 from NIST and from the reporting CNA).
// Sources disagree on versions, so an answer matching any one of them counts.
export function cvssScores(cve) {
  const m = cve.metrics || {};
  const scores = [];
  for (const k of ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30"]) for (const x of m[k] || []) scores.push(x.cvssData.baseScore);
  return [...new Set(scores)];
}

function cachePath() { return join(config.dataDir, "cve-cache.json"); }
function readCache() { try { return JSON.parse(readFileSync(cachePath(), "utf8")); } catch { return {}; } }
function writeCache(c) { mkdirSync(config.dataDir, { recursive: true }); writeFileSync(cachePath(), JSON.stringify(c)); }

export async function cvssTruth(id) {
  const cache = readCache();
  if (cache[id] && Date.now() - cache[id].t < 7 * 864e5) return { value: cache[id].scores, source: "NVD (cached)" };
  const r = await nvd(`cveId=${encodeURIComponent(id)}`);
  const cve = r.vulnerabilities?.[0]?.cve;
  if (!cve) throw new Error(`${id} is not in NVD`);
  const scores = cvssScores(cve);
  if (!scores.length) throw new Error(`${id} has no CVSS v3/v4 score yet`);
  cache[id] = { scores, t: Date.now() };
  writeCache(cache);
  return { value: scores, source: "NVD" };
}

// Well-known CVEs that a model may simply remember.
export const FAMOUS_CVES = ["CVE-2021-44228", "CVE-2014-0160", "CVE-2014-6271", "CVE-2017-0144", "CVE-2019-0708", "CVE-2023-4863",
  "CVE-2024-3094", "CVE-2017-5638", "CVE-2021-26855", "CVE-2018-13379", "CVE-2022-22965", "CVE-2023-34362"];

// Recently published CVEs with a score: after every model's training cutoff.
export async function recentCves(days = 20) {
  const end = new Date(), start = new Date(Date.now() - days * 864e5);
  const iso = d => d.toISOString().replace(/\.\d+Z$/, ".000");
  const r = await nvd(`pubStartDate=${iso(start)}&pubEndDate=${iso(end)}&noRejected&resultsPerPage=300`);
  const cache = readCache();
  const out = [];
  for (const v of r.vulnerabilities || []) {
    const scores = cvssScores(v.cve);
    if (!scores.length) continue;
    cache[v.cve.id] = { scores, t: Date.now() };
    out.push(v.cve.id);
  }
  writeCache(cache);
  return out;
}

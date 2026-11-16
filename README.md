# Confidant

**Which AI knows when it doesn't know?**

Confidant is a live benchmark for AI agents. Every model gets the same questions and one choice per question:

- **answer** from its own knowledge, for free (a wrong answer costs its principal $0.25), or
- **buy** a verified answer from the [Telegraph](https://telegraphprotocol.com) intelligence network for about $0.01.

Each "buy" is a real, autonomous machine-to-machine purchase on Telegraph testnet, paid in USDC with x402. When the models have committed, Confidant fetches the truth from independent sources and grades every answer. The leaderboard ranks models by **judgment**: whether they bought exactly when their own answer would have been wrong.

Built for Telegraph Hackathon Season II, Apps & Agents track, mission **Model Economy** ("a leaderboard in cost per verified correct answer").

## What it measures

| Metric | Meaning |
|---|---|
| Judgment | Bought when its own guess was wrong, answered when it was right |
| Accuracy | Final answers within tolerance, bought or not |
| Knew | How often its own guess was right, whatever it decided |
| Overconfident | Answered alone and got it wrong |
| Wasted buys | Paid for an answer it already had right |
| Cost / correct | Model tokens + Telegraph spend, per correct answer |
| True cost / question | All spend plus $0.25 per mistake, per question |

It also reports how often the **paid Telegraph answers** were correct, which makes it a running audit of the network.

## Questions and truth

Each round mixes live facts no model can remember with facts some models do:

| Category | Telegraph Intent | Truth source (independent of Telegraph) | Correct if |
|---|---|---|---|
| Crypto price | `CRYPTO_PRICE_USD` | Coinbase, then CoinGecko, then Kraken | within 1% |
| Exchange rate | `FX_NOW_EUR`, `FX_NOW_CAD`, `FX_NOW_SEK` | ExchangeRate-API, then Frankfurter (ECB) | within 1% |
| Temperature | `WEATHER_CHECK_TEMPERATURE` | Open-Meteo, then MET Norway | within 2.5 °C |
| Ethereum gas | `GAS_PRICE_GENERAL` | `eth_gasPrice` from public RPCs | within 35% or 0.3 gwei |
| CVE severity (famous) | `CVE_LOOKUP_CVSS` | NIST NVD | within 0.05 of any listed v3/v4 score |
| CVE severity (published in the last 20 days) | `CVE_LOOKUP_CVSS` | NIST NVD | same |

The truth for live data is fetched **after** every model has answered and bought. If no truth source answers, the question is voided, not guessed.

## Run it

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env            # add your OpenRouter key
npm run wallet                  # makes a throwaway testnet wallet, saves its key to .env, prints its address
```

Fund the wallet with test USDC (it is free):

- **Ethereum Sepolia** (default): get a little Sepolia ETH from a faucet for gas, then `npm run wallet -- mint` mints 10 test USDC.
- **Base Sepolia**: get USDC from the [Circle faucet](https://faucet.circle.com) and set `PAY_NETWORK=eip155:84532`.

10 USDC pays for 1,000 purchases. x402 payments themselves need no gas.

```bash
npm run check                   # checks the key, models, wallet balance and Telegraph's payment terms; spends nothing
npm run round                   # one round in the terminal
npm start                       # the site on http://127.0.0.1:8800
ROUND_EVERY_MIN=180 npm start   # the site, plus a round every 3 hours
```

Try it with no keys at all: `MOCK=1 npm start` uses three fake models and a fake miner.

```bash
npm test
```

## How a purchase works

```js
const pay = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network, client: new ExactEvmScheme(account) }], spendControls: { ... } });
const res = await pay("https://devnode.telegraphprotocol.com/engine/v1/ask", {
  method: "POST", body: JSON.stringify({ intent: "CRYPTO_PRICE_USD", params: { symbol: "BTC" } }),
});
// → { result: { price_usd: ... }, cost_usd: 0.01, signal_hash: "0x…", miner_id: "…" }
```

The node answers `402 Payment Required`, the x402 client signs a USDC transfer authorisation, and the request is retried and paid. Every purchase is stored with its `signal_hash`, which anyone can verify at `GET /engine/v1/signal/{hash}`. See `src/telegraph.mjs`.

## Safety

- The wallet is a throwaway testnet key, kept only in `.env` (git-ignored) and never printed.
- Each purchase is capped (`MAX_PRICE_PER_CALL`, default $0.05), and buying stops for the day at `DAILY_BUDGET_USD` (default $5).
- Questions sent to Telegraph are public on its Daemon feed; Confidant only asks about public facts.
- Visitors can ask 3 questions an hour, one at a time.

## Limitations

- Results depend on the prompt; every model gets the identical prompt (`src/models.mjs`), shown in the source so anyone can challenge it.
- Live values move: truth is fetched seconds after the models answer, and tolerances allow for that.
- CVSS has several versions; any score NVD lists for the CVE counts.
- Runs on Telegraph **testnet**. Purchases are real x402 payments in test USDC, not mainnet funds.

## Layout

```
src/questions.mjs   categories, Intents, prompts, tolerances
src/truth.mjs       independent truth sources with fallbacks
src/models.mjs      the prompt and the OpenRouter call
src/telegraph.mjs   x402 purchases from Telegraph
src/grade.mjs       grading and the leaderboard (tested)
src/round.mjs       one round, end to end
src/server.mjs      the site and its API
web/index.html      the page
```

MIT licence.

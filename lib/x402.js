// Selling Confidant's judgment over x402: an agent's first call gets 402 with the price; it pays in USDC and retries.
// Payments are checked and settled by an x402 facilitator, and only charged when the answer is delivered.
import { x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "@/src/config.mjs";

export const payTo = config.payTo || (config.walletKey ? privateKeyToAccount(config.walletKey).address : "");

export const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: config.facilitator }))
  .register(config.adviceNetwork, new ExactEvmScheme());

export const adviceRoute = {
  accepts: [{ scheme: "exact", price: config.advicePrice, network: config.adviceNetwork, payTo }],
  description: "Confidant judgment: should this AI model answer from memory, or buy a verified answer on Telegraph?",
  mimeType: "application/json",
};

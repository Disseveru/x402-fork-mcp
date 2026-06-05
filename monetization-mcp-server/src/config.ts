/**
 * Centralised environment configuration + validation.
 *
 * Fails fast with friendly, copy-paste-able guidance if something required is
 * missing — important because the operator is configuring this from a phone.
 */

import { config as loadEnv } from "dotenv";

loadEnv();

/** Throws with a readable message if no receiving wallet is configured. */
function requireAtLeastOneWallet(evm?: string, svm?: string): void {
  if (!evm && !svm) {
    console.error(
      [
        "",
        "❌  No receiving wallet configured.",
        "    Open your .env file and set AT LEAST ONE of these to your PUBLIC address:",
        "      EVM_ADDRESS=0x....   (Base)",
        "      SVM_ADDRESS=....     (Solana)",
        "",
        "    Reminder: use your PUBLIC address only. Never paste a private key.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}

const evmAddress = process.env.EVM_ADDRESS?.trim() || undefined;
const svmAddress = process.env.SVM_ADDRESS?.trim() || undefined;

requireAtLeastOneWallet(evmAddress, svmAddress);

export interface AppConfig {
  /** Public EVM (Base) address that receives USDC, if EVM is enabled. */
  evmAddress?: `0x${string}`;
  /** Public Solana address that receives USDC, if SVM is enabled. */
  svmAddress?: string;
  /** CAIP-2 EVM network id (e.g. eip155:84532 for Base Sepolia). */
  evmNetwork: `${string}:${string}`;
  /** CAIP-2 SVM network id. */
  svmNetwork: `${string}:${string}`;
  /** x402 facilitator base URL used for verification + settlement. */
  facilitatorUrl: string;
  /** Price strings (e.g. "$0.05") per paid tool. */
  prices: {
    solanaFeed: string;
    apifyScraper: string;
  };
  /** Solana JSON-RPC endpoint used by the MEV feed tool. */
  solanaRpcUrl: string;
  /** Apify API token (optional — mock mode when absent). */
  apifyToken?: string;
  /** HTTP port. */
  port: number;
  /** Public base URL for logs / receipts. */
  publicBaseUrl: string;
}

export const appConfig: AppConfig = {
  evmAddress: evmAddress as `0x${string}` | undefined,
  svmAddress,
  evmNetwork: (process.env.EVM_NETWORK?.trim() || "eip155:84532") as `${string}:${string}`,
  svmNetwork: (process.env.SVM_NETWORK?.trim() ||
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1") as `${string}:${string}`,
  facilitatorUrl:
    process.env.FACILITATOR_URL?.trim() || "https://x402.org/facilitator",
  prices: {
    solanaFeed: process.env.SOLANA_FEED_PRICE?.trim() || "$0.05",
    apifyScraper: process.env.APIFY_SCRAPER_PRICE?.trim() || "$0.10",
  },
  solanaRpcUrl:
    process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com",
  apifyToken: process.env.APIFY_TOKEN?.trim() || undefined,
  port: parseInt(process.env.PORT || "4022", 10),
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL?.trim() ||
    `http://localhost:${process.env.PORT || "4022"}`,
};

export const evmEnabled = Boolean(appConfig.evmAddress);
export const svmEnabled = Boolean(appConfig.svmAddress);

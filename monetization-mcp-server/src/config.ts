/**
 * Centralised environment configuration + validation.
 *
 * Fails fast with friendly, copy-paste-able guidance if something required is
 * missing — important because the operator is configuring this from a phone.
 */

import { config as loadEnv } from 'dotenv'

loadEnv()

/**
 * Validates that an EVM address has the correct format (0x followed by 40 hex characters).
 *
 * @param address - The address string to validate
 * @returns true if the address is a valid EVM format
 */
function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

/**
 * Validates that a Solana address has the correct format (base58, typically 32-44 chars).
 *
 * @param address - The address string to validate
 * @returns true if the address appears to be a valid Solana format
 */
function isValidSvmAddress(address: string): boolean {
  // Solana addresses are base58 encoded, typically 32-44 characters
  // Base58 alphabet excludes 0, O, I, l to avoid confusion
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

/**
 * Ensures at least one receiving wallet address is configured.
 *
 * If both `evm` and `svm` are missing or empty, logs setup guidance and terminates the process with exit code 1.
 *
 * @param evm - EVM (Ethereum-like) public address (e.g. `0x...`)
 * @param svm - Solana public address
 */
function requireAtLeastOneWallet(evm?: string, svm?: string): void {
  if (!evm && !svm) {
    console.error(
      [
        '',
        '❌  No receiving wallet configured.',
        '    Open your .env file and set AT LEAST ONE of these to your PUBLIC address:',
        '      EVM_ADDRESS=0x....   (Base)',
        '      SVM_ADDRESS=....     (Solana)',
        '',
        '    Reminder: use your PUBLIC address only. Never paste a private key.',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }
}

const rawEvmAddress = process.env.EVM_ADDRESS?.trim()
const rawSvmAddress = process.env.SVM_ADDRESS?.trim()

let evmAddress: string | undefined
let svmAddress: string | undefined

if (rawEvmAddress) {
  if (!isValidEvmAddress(rawEvmAddress)) {
    console.error(
      [
        '',
        '❌  Invalid EVM_ADDRESS format.',
        `    Got: ${rawEvmAddress}`,
        '    Expected: 0x followed by 40 hexadecimal characters (e.g., 0x1234...abcd)',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }
  evmAddress = rawEvmAddress
}

if (rawSvmAddress) {
  if (!isValidSvmAddress(rawSvmAddress)) {
    console.error(
      [
        '',
        '❌  Invalid SVM_ADDRESS format.',
        `    Got: ${rawSvmAddress}`,
        '    Expected: Base58-encoded Solana address (32-44 characters)',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }
  svmAddress = rawSvmAddress
}

requireAtLeastOneWallet(evmAddress, svmAddress)

export interface AppConfig {
  /** Public EVM (Base) address that receives USDC, if EVM is enabled. */
  evmAddress?: `0x${string}`
  /** Public Solana address that receives USDC, if SVM is enabled. */
  svmAddress?: string
  /** CAIP-2 EVM network id (e.g. eip155:84532 for Base Sepolia). */
  evmNetwork: `${string}:${string}`
  /** CAIP-2 SVM network id. */
  svmNetwork: `${string}:${string}`
  /** x402 facilitator base URL used for verification + settlement. */
  facilitatorUrl: string
  /** Price strings (e.g. "$0.05") per paid tool. */
  prices: {
    solanaFeed: string
    apifyScraper: string
  }
  /** Solana JSON-RPC endpoint used by the MEV feed tool. */
  solanaRpcUrl: string
  /** Apify API token (optional — mock mode when absent). */
  apifyToken?: string
  /** HTTP port. */
  port: number
  /** Public base URL for logs / receipts. */
  publicBaseUrl: string
}

// Validate and parse the PORT environment variable
let port = 4022
if (process.env.PORT) {
  const parsedPort = parseInt(process.env.PORT, 10)
  if (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    console.error(
      [
        '',
        '❌  Invalid PORT value.',
        `    Got: ${process.env.PORT}`,
        '    Expected: an integer between 1 and 65535',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }
  port = parsedPort
}

export const appConfig: AppConfig = {
  evmAddress: evmAddress as `0x${string}` | undefined,
  svmAddress,
  evmNetwork: (process.env.EVM_NETWORK?.trim() || 'eip155:84532') as `${string}:${string}`,
  svmNetwork: (process.env.SVM_NETWORK?.trim() ||
    'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1') as `${string}:${string}`,
  facilitatorUrl: process.env.FACILITATOR_URL?.trim() || 'https://x402.org/facilitator',
  prices: {
    solanaFeed: process.env.SOLANA_FEED_PRICE?.trim() || '$0.05',
    apifyScraper: process.env.APIFY_SCRAPER_PRICE?.trim() || '$0.10',
  },
  solanaRpcUrl: process.env.SOLANA_RPC_URL?.trim() || 'https://api.devnet.solana.com',
  apifyToken: process.env.APIFY_TOKEN?.trim() || undefined,
  port,
  publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() || `http://localhost:${port}`,
}

export const evmEnabled = Boolean(appConfig.evmAddress)
export const svmEnabled = Boolean(appConfig.svmAddress)

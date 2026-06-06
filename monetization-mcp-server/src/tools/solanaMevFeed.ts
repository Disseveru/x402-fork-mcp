/**
 * Tool: solana_mev_arbitrage_feed
 *
 * SCAFFOLD. Returns a feed of (currently simulated) cross-DEX arbitrage / MEV
 * opportunities on Solana. It performs a real, lightweight liveness check
 * against your configured Solana RPC (current slot + health) so you can see the
 * wiring works end-to-end, then returns structured opportunity rows.
 *
 * To make this production-grade, replace `generateOpportunities` with real logic:
 *   - Pull pool reserves from Raydium / Orca / Meteora (or an aggregator).
 *   - Compute price deltas and net profit after fees + priority fees.
 *   - Optionally surface a Jito bundle / route you can execute.
 *
 * The payment gating is handled by the caller (createPaymentWrapper), so this
 * file only contains the business logic.
 */

import { z } from 'zod'
import { appConfig } from '../config.js'

export const solanaMevInputSchema = {
  minProfitUsd: z
    .number()
    .min(0)
    .optional()
    .describe('Only return opportunities with at least this net profit in USD.'),
  dexes: z
    .array(z.string())
    .optional()
    .describe("Optional filter, e.g. ['Raydium','Orca','Meteora']."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Max number of opportunities to return (default 5).'),
}

const SolanaMevArgs = z.object(solanaMevInputSchema)
export type SolanaMevArgs = z.infer<typeof SolanaMevArgs>

interface ArbitrageOpportunity {
  pair: string
  buyDex: string
  sellDex: string
  spreadBps: number
  estProfitUsd: number
  notionalUsd: number
  route: string[]
  confidence: number
}

const DEFAULT_DEXES = ['Raydium', 'Orca', 'Meteora', 'Phoenix', 'Lifinity']
const PAIRS = ['SOL/USDC', 'JUP/USDC', 'BONK/SOL', 'WIF/USDC', 'JTO/USDC', 'PYTH/USDC']

/**
 * Checks the configured Solana RPC for liveness and obtains the current slot.
 *
 * @returns An object with `ok` indicating whether the RPC responded successfully, `slot` set to the reported slot number when available, and `detail` containing a short status or error message.
 */
async function probeRpc(): Promise<{ ok: boolean; slot?: number; detail: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(appConfig.solanaRpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot' }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      return { ok: false, detail: `RPC HTTP ${res.status}` }
    }
    const json = (await res.json()) as { result?: number; error?: { message?: string } }
    if (typeof json.result === 'number') {
      return { ok: true, slot: json.result, detail: 'ok' }
    }
    return { ok: false, detail: json.error?.message || 'unexpected RPC response' }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'RPC unreachable' }
  }
}

/**
 * Generate a list of simulated cross-DEX arbitrage opportunities for the given DEXs.
 *
 * Each produced entry is a synthetic ArbitrageOpportunity containing buy/sell DEXs (always different),
 * a trading pair, estimated spread, notional and profit in USD, a simple route, and a confidence score.
 *
 * @param dexes - Array of DEX identifiers to use as buy/sell venues
 * @param limit - Number of opportunity objects to generate
 * @returns An array of `ArbitrageOpportunity` objects with simulated values
 */
function generateOpportunities(dexes: string[], limit: number): ArbitrageOpportunity[] {
  const out: ArbitrageOpportunity[] = []
  for (let i = 0; i < limit; i++) {
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)]
    let buy = dexes[Math.floor(Math.random() * dexes.length)]
    let sell = dexes[Math.floor(Math.random() * dexes.length)]
    if (sell === buy) sell = dexes[(dexes.indexOf(buy) + 1) % dexes.length]
    const spreadBps = Math.round((Math.random() * 80 + 5) * 10) / 10
    const notionalUsd = Math.round((Math.random() * 9000 + 1000) * 100) / 100
    const estProfitUsd = Math.round((spreadBps / 10000) * notionalUsd * 100) / 100
    out.push({
      pair,
      buyDex: buy,
      sellDex: sell,
      spreadBps,
      estProfitUsd,
      notionalUsd,
      route: [buy, 'Jupiter', sell],
      confidence: Math.round((Math.random() * 0.4 + 0.55) * 100) / 100,
    })
  }
  return out
}

/**
 * Produce an MCP tool response containing a simulated feed of Solana cross-DEX arbitrage opportunities.
 *
 * Validates and coerces `rawArgs` against `SolanaMevArgs`, probes the configured Solana RPC for liveness,
 * generates simulated opportunity rows across the selected DEXes, applies the optional `minProfitUsd`
 * filter, and returns the assembled payload as JSON text.
 *
 * @param rawArgs - Caller-supplied arguments to be parsed by `SolanaMevArgs`
 * @returns The MCP tool response with a single text content item whose `text` is the JSON-formatted opportunity feed
 */
export async function runSolanaMevFeed(
  rawArgs: Record<string, unknown>,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const args = SolanaMevArgs.parse(rawArgs)
  const limit = args.limit ?? 5
  const dexes = args.dexes?.length ? args.dexes : DEFAULT_DEXES

  const rpc = await probeRpc()

  let opportunities = generateOpportunities(dexes, limit)
  if (typeof args.minProfitUsd === 'number') {
    opportunities = opportunities.filter((o) => o.estProfitUsd >= args.minProfitUsd!)
  }

  const payload = {
    status: 'ok',
    note: 'SCAFFOLD: opportunities are simulated. Replace generateOpportunities() with real DEX pool data to go live.',
    network: appConfig.svmNetwork,
    rpc: {
      endpoint: appConfig.solanaRpcUrl,
      live: rpc.ok,
      currentSlot: rpc.slot ?? null,
      detail: rpc.detail,
    },
    filters: { minProfitUsd: args.minProfitUsd ?? null, dexes },
    count: opportunities.length,
    opportunities,
    generatedAt: new Date().toISOString(),
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  }
}

/**
 * monetization-mcp-server  —  an x402 "vending machine" for AI agents.
 *
 * WHAT THIS IS
 * ------------
 * A Model Context Protocol (MCP) server, exposed over SSE, whose tools are
 * gated by the x402 payment protocol. Any AI agent that wants to call a paid
 * tool must attach a USDC payment; otherwise it receives an HTTP-402-style
 * "Payment Required" response and cannot use the tool. You (the seller) receive
 * the funds directly to your wallet address.
 *
 * HOW PAYMENT IS APPLIED (important design note)
 * ----------------------------------------------
 * For MCP, the correct place to charge is the *tool call*, not the raw SSE HTTP
 * route. We use `createPaymentWrapper` from `@x402/mcp` to wrap each paid tool's
 * handler. The wrapper:
 *   1. returns a 402 (PaymentRequired) result if no/insufficient payment,
 *   2. verifies the payment with the facilitator,
 *   3. runs the tool, then
 *   4. settles the payment on-chain and attaches the receipt.
 *
 * Gating the /sse stream itself with HTTP middleware would break the MCP
 * handshake (clients could not even initialize), so we do NOT do that. For
 * completeness we ALSO mount the classic `@x402/express` paymentMiddleware on a
 * plain (non-MCP) REST route — see `/premium/arbitrage-snapshot` — to show the
 * literal HTTP 402 middleware in action for ordinary HTTP buyers.
 *
 * TOOLS
 * -----
 *   - solana_mev_arbitrage_feed (paid) — Solana cross-DEX arbitrage / MEV feed.
 *   - apify_social_scraper       (paid) — runs an Apify Actor and returns items.
 *   - ping                       (free) — health check.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { x402ResourceServer, createPaymentWrapper } from '@x402/mcp'
import { HTTPFacilitatorClient } from '@x402/core/server'
import type { PaymentRequirements } from '@x402/core/types'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { ExactSvmScheme } from '@x402/svm/exact/server'
import { paymentMiddleware } from '@x402/express'
import express from 'express'

import { appConfig, evmEnabled, svmEnabled } from './config.js'
import { runSolanaMevFeed, solanaMevInputSchema } from './tools/solanaMevFeed.js'
import { runApifyScraper, apifyScraperInputSchema } from './tools/apifyScraper.js'

const EVM_EXTRA = { name: 'USDC', version: '2' } as const

/**
 * Builds the `accepts` array (one entry per enabled network) for a given price.
 * Lets a paying agent settle on EVM (Base) or SVM (Solana) — whichever the
 * seller has configured.
 *
 * @param resourceServer - Configured x402 resource server.
 * @param price - Human price string, e.g. "$0.05".
 * @returns Payment requirements covering every enabled network.
 */
async function buildAccepts(
  resourceServer: x402ResourceServer,
  price: string,
): Promise<PaymentRequirements[]> {
  const accepts: PaymentRequirements[] = []
  if (evmEnabled) {
    accepts.push(
      ...(await resourceServer.buildPaymentRequirements({
        scheme: 'exact',
        network: appConfig.evmNetwork,
        payTo: appConfig.evmAddress!,
        price,
        extra: EVM_EXTRA,
      })),
    )
  }
  if (svmEnabled) {
    accepts.push(
      ...(await resourceServer.buildPaymentRequirements({
        scheme: 'exact',
        network: appConfig.svmNetwork,
        payTo: appConfig.svmAddress!,
        price,
      })),
    )
  }
  return accepts
}

/** Inline accepts config for the classic @x402/express HTTP middleware. */
function inlineAccepts(price: string): Array<Record<string, unknown>> {
  const accepts: Array<Record<string, unknown>> = []
  if (evmEnabled) {
    accepts.push({
      scheme: 'exact',
      price,
      network: appConfig.evmNetwork,
      payTo: appConfig.evmAddress,
      extra: EVM_EXTRA,
    })
  }
  if (svmEnabled) {
    accepts.push({
      scheme: 'exact',
      price,
      network: appConfig.svmNetwork,
      payTo: appConfig.svmAddress,
    })
  }
  return accepts
}

/**
 * Boots the resource server, MCP server, tools, and Express transport.
 *
 * @returns Promise that resolves once the HTTP server is listening.
 */
async function main(): Promise<void> {
  // --------------------------------------------------------------------------
  // 1. x402 resource server: handles verification + settlement via facilitator
  // --------------------------------------------------------------------------
  const facilitatorClient = new HTTPFacilitatorClient({ url: appConfig.facilitatorUrl })
  const resourceServer = new x402ResourceServer(facilitatorClient)
  if (evmEnabled) resourceServer.register(appConfig.evmNetwork, new ExactEvmScheme())
  if (svmEnabled) resourceServer.register(appConfig.svmNetwork, new ExactSvmScheme())
  await resourceServer.initialize()

  // --------------------------------------------------------------------------
  // 2. Build payment requirements + wrappers per tool
  // --------------------------------------------------------------------------
  const solanaFeedAccepts = await buildAccepts(resourceServer, appConfig.prices.solanaFeed)
  const apifyAccepts = await buildAccepts(resourceServer, appConfig.prices.apifyScraper)

  const paidSolanaFeed = createPaymentWrapper(resourceServer, {
    accepts: solanaFeedAccepts,
    resource: {
      url: 'mcp://tool/solana_mev_arbitrage_feed',
      description: 'Solana cross-DEX arbitrage / MEV opportunity feed',
      serviceName: 'x402 Monetization MCP',
      tags: ['solana', 'mev', 'arbitrage', 'defi'],
    },
  })

  const paidApifyScraper = createPaymentWrapper(resourceServer, {
    accepts: apifyAccepts,
    resource: {
      url: 'mcp://tool/apify_social_scraper',
      description: 'Run an Apify Actor to scrape social media and return items',
      serviceName: 'x402 Monetization MCP',
      tags: ['apify', 'scraping', 'social'],
    },
  })

  // --------------------------------------------------------------------------
  // 3. MCP server + tools
  // --------------------------------------------------------------------------
  const mcpServer = new McpServer({
    name: 'x402 Monetization MCP',
    version: '1.0.0',
  })

  mcpServer.tool(
    'solana_mev_arbitrage_feed',
    `Fetch a live feed of Solana cross-DEX arbitrage / MEV opportunities. ` +
      `Requires payment of ${appConfig.prices.solanaFeed}.`,
    solanaMevInputSchema,
    paidSolanaFeed(async (args) => runSolanaMevFeed(args)),
  )

  mcpServer.tool(
    'apify_social_scraper',
    `Run an Apify Actor (e.g. instagram/tweet scraper) and return the scraped ` +
      `dataset items. Requires payment of ${appConfig.prices.apifyScraper}.`,
    apifyScraperInputSchema,
    paidApifyScraper(async (args) => runApifyScraper(args)),
  )

  mcpServer.tool('ping', "Free health check. Returns 'pong'.", {}, async () => ({
    content: [{ type: 'text' as const, text: 'pong' }],
  }))

  // --------------------------------------------------------------------------
  // 4. Express transport (SSE) + optional HTTP-402 demo route
  // --------------------------------------------------------------------------
  startExpressServer(mcpServer, resourceServer)
}

/**
 * Starts the Express server exposing the MCP SSE transport and a demo HTTP-402
 * gated REST endpoint.
 *
 * @param mcpServer - The MCP server whose tools are exposed over SSE.
 * @param resourceServer - Shared x402 resource server for the HTTP middleware.
 */
function startExpressServer(mcpServer: McpServer, resourceServer: x402ResourceServer): void {
  const app = express()
  const transports = new Map<string, SSEServerTransport>()

  // ---- MCP SSE transport (gating happens per-tool, NOT on these routes) ----
  app.get('/sse', async (_req, res) => {
    const transport = new SSEServerTransport('/messages', res)
    transports.set(transport.sessionId, transport)
    console.log(`📡 SSE client connected (session ${transport.sessionId})`)
    res.on('close', () => {
      transports.delete(transport.sessionId)
      console.log(`📡 SSE client disconnected (session ${transport.sessionId})`)
    })
    await mcpServer.connect(transport)
  })

  app.post('/messages', express.json(), async (req, res) => {
    const sessionId = (req.query.sessionId as string) || ''
    const transport = transports.get(sessionId) || Array.from(transports.values())[0]
    if (!transport) {
      res.status(400).json({ error: 'No active SSE session. Open GET /sse first.' })
      return
    }
    await transport.handlePostMessage(req, res, req.body)
  })

  // ---- Classic @x402/express HTTP 402 middleware (non-MCP REST buyers) ----
  // Demonstrates the literal paymentMiddleware on an ordinary HTTP route.
  app.use(
    paymentMiddleware(
      {
        'GET /premium/arbitrage-snapshot': {
          accepts: inlineAccepts(appConfig.prices.solanaFeed),
          description: 'One-shot Solana arbitrage snapshot (plain HTTP, non-MCP)',
          mimeType: 'application/json',
        },
      } as never,
      resourceServer,
    ),
  )

  app.get('/premium/arbitrage-snapshot', async (_req, res) => {
    const result = await runSolanaMevFeed({ limit: 3 })
    res.json(JSON.parse(result.content[0].text))
  })

  // ---- Free, public info routes ----
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'x402 Monetization MCP',
      networks: {
        evm: evmEnabled ? appConfig.evmNetwork : null,
        svm: svmEnabled ? appConfig.svmNetwork : null,
      },
      tools: [
        { name: 'solana_mev_arbitrage_feed', price: appConfig.prices.solanaFeed },
        { name: 'apify_social_scraper', price: appConfig.prices.apifyScraper },
        { name: 'ping', price: 'free' },
      ],
    })
  })

  app.get('/', (_req, res) => {
    res
      .type('text/plain')
      .send(
        [
          'x402 Monetization MCP server is running.',
          '',
          `MCP SSE endpoint:  ${appConfig.publicBaseUrl}/sse`,
          `Health:            ${appConfig.publicBaseUrl}/health`,
          `HTTP-402 demo:     ${appConfig.publicBaseUrl}/premium/arbitrage-snapshot`,
          '',
          'Paid tools (agents must pay to call):',
          `  - solana_mev_arbitrage_feed  (${appConfig.prices.solanaFeed})`,
          `  - apify_social_scraper       (${appConfig.prices.apifyScraper})`,
          '  - ping                       (free)',
        ].join('\n'),
      )
  })

  app.listen(appConfig.port, () => {
    console.log('')
    console.log('🚀 x402 Monetization MCP server is LIVE')
    console.log(`   Local:   http://localhost:${appConfig.port}`)
    console.log(`   Public:  ${appConfig.publicBaseUrl}`)
    console.log('')
    console.log('   Receiving payments to:')
    if (evmEnabled) console.log(`     EVM (${appConfig.evmNetwork}): ${appConfig.evmAddress}`)
    if (svmEnabled) console.log(`     SVM (${appConfig.svmNetwork}): ${appConfig.svmAddress}`)
    console.log('')
    console.log('   Paid tools:')
    console.log(`     - solana_mev_arbitrage_feed  ${appConfig.prices.solanaFeed}`)
    console.log(`     - apify_social_scraper       ${appConfig.prices.apifyScraper}`)
    console.log(`     - ping                       free`)
    console.log('')
    console.log(`   🔗 Connect an agent via SSE:  ${appConfig.publicBaseUrl}/sse`)
    console.log('')
  })
}

main().catch((err) => {
  console.error('Fatal error during startup:', err)
  process.exit(1)
})

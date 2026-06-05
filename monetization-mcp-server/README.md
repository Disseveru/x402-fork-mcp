# x402 Monetization MCP Server 💰🤖

A pay-per-call **MCP server** that charges *other AI agents* in **USDC** to use your
tools — a "vending machine" for autonomous services. It uses the
[**x402** payment protocol](https://x402.org) for the money side and the
[**Model Context Protocol** (MCP)](https://modelcontextprotocol.io) over **SSE**
for the agent side.

You are the **seller** (resource server). When an agent calls a paid tool without
paying, it gets an HTTP-402 "Payment Required" response with your price. When it
pays, the payment is verified + settled on-chain by a *facilitator*, the money
lands in **your wallet**, and the tool result is returned.

### Tools included (scaffolded, ready to extend)

| Tool | Type | What it does |
| --- | --- | --- |
| `solana_mev_arbitrage_feed` | 💵 paid | Returns a feed of Solana cross‑DEX arbitrage / MEV opportunities. Pings your Solana RPC for liveness; opportunity rows are simulated until you plug in real DEX data. |
| `apify_social_scraper` | 💵 paid | Runs an [Apify](https://apify.com) Actor (e.g. Instagram / X scrapers) and returns the scraped items. Real when `APIFY_TOKEN` is set, mock otherwise. |
| `ping` | 🆓 free | Health check. Returns `pong`. |

---

## ⚠️ Read this first (money safety)

You are **receiving** money, so you only ever need your **public wallet address**.
**Never put a private key or seed phrase in this server.** A private key is only
needed by the *buyer* (the agent paying you). If any guide tells you to paste
`EVM_PRIVATE_KEY` / `SVM_PRIVATE_KEY` into a server, ignore it — this project is
deliberately built to use **public addresses only**.

By default the server runs on **free test networks** (Base Sepolia + Solana
Devnet), so you can try the whole flow with **no real money** before going live.

---

## 🚀 Quick start (copy‑paste)

You need [Node.js](https://nodejs.org) 18+ (works in Termux and Replit).

**One command to install everything, create your config, and start:**

```bash
git clone https://github.com/x402-foundation/x402.git && cd x402/monetization-mcp-server && npm install && cp .env.example .env && npm run dev
```

The first run starts in **safe demo mode**. It will print where it's listening
(default `http://localhost:4022`). Open `http://localhost:4022/health` to confirm
it's alive.

> Already cloned the repo? Just run the part after the first `&&`.

### Then add your wallet (so you actually get paid)

Open the `.env` file and set **at least one** public address:

```bash
EVM_ADDRESS=0xYourBaseAddressHere
# and/or
SVM_ADDRESS=YourSolanaAddressHere
```

Save and restart (`Ctrl+C`, then `npm run dev`). That's it — the server now
charges agents and routes the USDC to your address.

---

## 🔌 Connect an AI agent (client config)

Paste this into your MCP client's config (e.g. Claude Desktop's
`claude_desktop_config.json`). It uses the `mcp-remote` bridge to reach your
SSE server:

```json
{
  "mcpServers": {
    "x402-monetization": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:4022/sse"]
    }
  }
}
```

If your server is deployed (Replit / a VPS / ngrok), replace the URL with your
public HTTPS URL, e.g. `https://your-app.replit.app/sse`.

> **Paying clients:** a stock client (like Claude Desktop) can *discover* your
> tools and will *see* the 402 price, but it can't pay on its own. To actually
> pay and use the tools, the calling agent must be **x402-aware** — i.e. wrap its
> MCP client with a wallet using [`@x402/mcp`](https://www.npmjs.com/package/@x402/mcp)
> (`createX402MCPClient`). See the x402 MCP client examples in this repo under
> [`examples/typescript/clients/mcp`](../examples/typescript/clients/mcp).

---

## 🧠 How payment is wired (for the curious)

For MCP, the **right place to charge is the tool call**, not the raw SSE HTTP
route. This server wraps each paid tool handler with `createPaymentWrapper` from
`@x402/mcp`, which:

1. returns a `402 PaymentRequired` result if no/insufficient payment is attached,
2. verifies the payment via the facilitator,
3. runs your tool, then
4. settles the payment on-chain and attaches the receipt to the result.

Gating the `/sse` stream itself with HTTP middleware would break the MCP
handshake, so we don't. For completeness, the classic `@x402/express`
`paymentMiddleware` is also mounted on a **plain REST** demo route
(`GET /premium/arbitrage-snapshot`) to show the literal HTTP 402 flow for
non-MCP buyers.

```
Agent ──call tool──▶  MCP server (SSE)  ──verify/settle──▶  x402 facilitator
      ◀─402 + price─                                              │ on-chain
      ──retry w/ pay─▶                                            ▼
      ◀─result+recpt─                                        your wallet 💰
```

---

## ⚙️ Configuration reference

All settings live in `.env` (copied from [`.env.example`](./.env.example)).

| Variable | Default | Description |
| --- | --- | --- |
| `EVM_ADDRESS` | — | Your **public** Base address to receive USDC. |
| `SVM_ADDRESS` | — | Your **public** Solana address to receive USDC. |
| `EVM_NETWORK` | `eip155:84532` | CAIP-2 EVM network. Base Mainnet = `eip155:8453`. |
| `SVM_NETWORK` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | CAIP-2 Solana network (Devnet). |
| `FACILITATOR_URL` | `https://x402.org/facilitator` | Verifies + settles payments. |
| `SOLANA_FEED_PRICE` | `$0.05` | Price per `solana_mev_arbitrage_feed` call. |
| `APIFY_SCRAPER_PRICE` | `$0.10` | Price per `apify_social_scraper` call. |
| `SOLANA_RPC_URL` | public mainnet RPC | Used by the MEV feed liveness probe. |
| `APIFY_TOKEN` | — | Apify API token. Blank ⇒ scraper returns mock data. |
| `PORT` | `4022` | HTTP port. |
| `PUBLIC_BASE_URL` | `http://localhost:4022` | Public URL shown in logs/receipts. |

At least one of `EVM_ADDRESS` / `SVM_ADDRESS` is required; the server enables
both networks if both are set, letting paying agents choose.

---

## 🛠️ Extending the tools

- **Solana MEV feed** — open [`src/tools/solanaMevFeed.ts`](./src/tools/solanaMevFeed.ts)
  and replace `generateOpportunities()` with real DEX pool data (Raydium / Orca /
  Meteora or an aggregator), profit math after fees, and optionally a Jito route.
- **Apify scraper** — open [`src/tools/apifyScraper.ts`](./src/tools/apifyScraper.ts).
  It already calls Apify's `run-sync-get-dataset-items` endpoint when a token is
  present. Pass the Actor id and its input via the tool arguments.
- **Add a new paid tool** — build an `accepts` array with `buildAccepts(...)`,
  wrap your handler with `createPaymentWrapper`, and register it with
  `mcpServer.tool(...)` in [`src/server.ts`](./src/server.ts).

---

## 📜 Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with auto-reload (recommended). |
| `npm start` | Start once. |
| `npm run typecheck` | Type-check without emitting. |

## License

MIT

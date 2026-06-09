# x402 Monetization MCP Server 💰🤖

A pay-per-call **MCP server** that charges _other AI agents_ in **USDC** to use your
tools — a "vending machine" for autonomous services. It uses the
[**x402** payment protocol](https://x402.org) for the money side and the
[**Model Context Protocol** (MCP)](https://modelcontextprotocol.io) over **SSE**
for the agent side.

You are the **seller** (resource server). When an agent calls a paid tool without
paying, it gets an HTTP-402 "Payment Required" response with your price. When it
pays, the payment is verified + settled on-chain by a _facilitator_, the money
lands in **your wallet**, and the tool result is returned.

## Tools included (scaffolded, ready to extend)

| Tool                        | Type    | What it does                                                                                                                                                          |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solana_mev_arbitrage_feed` | 💵 paid | Returns a feed of Solana cross‑DEX arbitrage / MEV opportunities. Pings your Solana RPC for liveness; opportunity rows are simulated until you plug in real DEX data. |
| `apify_social_scraper`      | 💵 paid | Runs an [Apify](https://apify.com) Actor (e.g. Instagram / X scrapers) and returns the scraped items. Real when `APIFY_TOKEN` is set, mock otherwise.                 |
| `ping`                      | 🆓 free | Health check. Returns `pong`.                                                                                                                                         |

---

## ⚠️ Read this first (money safety)

You are **receiving** money, so you only ever need your **public wallet address**.
**Never put a private key or seed phrase in this server.** A private key is only
needed by the _buyer_ (the agent paying you). If any guide tells you to paste
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

## 📱 Run from a phone — NO Termux, NO command line

Everything below happens in your mobile **web browser** by tapping and pasting.
Pick one path.

### Path A — Replit (easiest way to run + test for free)

1. In your browser go to **https://replit.com** and sign in (Google works).
2. Tap **Create App → Import from GitHub** and paste this repo URL:
   `https://github.com/x402-foundation/x402`
3. Replit opens an editor. Open the file named **`.replit`** (create it if it
   isn't there) and paste **exactly** this, then save:

   ```
   run = "cd monetization-mcp-server && npm install && npm start"
   ```

4. Open the **Secrets** tool (the 🔒 lock icon). Add these key/value pairs
   (tap "New secret" for each). You only need your **public** address:

   | Key                   | Value                                   |
   | --------------------- | --------------------------------------- |
   | `EVM_ADDRESS`         | your public Base address (`0x...`)      |
   | `SVM_ADDRESS`         | _(optional)_ your public Solana address |
   | `EVM_NETWORK`         | `eip155:84532`                          |
   | `FACILITATOR_URL`     | `https://x402.org/facilitator`          |
   | `SOLANA_FEED_PRICE`   | `$0.05`                                 |
   | `APIFY_SCRAPER_PRICE` | `$0.10`                                 |

5. Tap the big **Run** button. Wait for it to install and start.
6. A small web preview (Webview) opens with a URL like
   `https://something.replit.dev`. **That is your live server.** Tap it — you'll
   see the info page listing your tools and prices. ✅

> Defaults use **free test networks**, so nothing costs real money while you try
> it. To go live with real USDC, change `EVM_NETWORK` to `eip155:8453`
> (Base Mainnet) in Secrets and press Run again.

### Path B — Render (a permanent, always-on server with a public link)

Best when you want your "vending machine" to stay online so agents can pay it
any time.

1. In your browser go to **https://render.com** and sign in with GitHub.
2. Tap **New + → Web Service**, then pick this repository.
3. Fill in the web form (just tap the fields and paste):

   | Field              | Value                     |
   | ------------------ | ------------------------- |
   | **Root Directory** | `monetization-mcp-server` |
   | **Runtime**        | `Node`                    |
   | **Build Command**  | `npm install`             |
   | **Start Command**  | `npm start`               |

4. Scroll to **Environment Variables** and add the same keys as the Replit table
   above (at minimum `EVM_ADDRESS`). Do **not** add a `PORT` — Render sets it.
5. Tap **Create Web Service**. Render builds it and gives you a public HTTPS URL
   like `https://your-app.onrender.com`. That's your server. ✅

### Path C — Railway (also permanent + public, very few taps)

Another always-on host. Same idea as Render, slightly different buttons.

1. In your browser go to **https://railway.app** and sign in with GitHub.
2. Tap **New Project → Deploy from GitHub repo**, then pick this repository.
3. Open the service → **Settings** and set:

   | Field             | Value                     |
   | ----------------- | ------------------------- |
   | **Root Directory** | `monetization-mcp-server` |
   | **Build Command**  | `npm install`             |
   | **Start Command**  | `npm start`               |

4. Open the **Variables** tab and add the same keys as the Replit table above (at
   minimum `EVM_ADDRESS`). Do **not** add a `PORT` — Railway sets it.
5. In **Settings → Networking**, tap **Generate Domain** to get a public HTTPS URL
   like `https://your-app.up.railway.app`. That's your server. ✅

---

## ✅ How to test it (also no command line)

Just open these in your phone's browser, using your live URL from above:

- `https://YOUR-URL/` → a plain page listing your tools + prices (proves it's running).
- `https://YOUR-URL/health` → a JSON status with networks and prices.

Seeing those means the server is live and ready to charge agents. (Calling a
_paid_ tool requires a paying, x402-aware agent — see the next section — because
a normal browser can't sign a USDC payment.)

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

> **Paying clients:** a stock client (like Claude Desktop) can _discover_ your
> tools and will _see_ the 402 price, but it can't pay on its own. To actually
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

| Variable              | Default                                   | Description                                         |
| --------------------- | ----------------------------------------- | --------------------------------------------------- |
| `EVM_ADDRESS`         | —                                         | Your **public** Base address to receive USDC.       |
| `SVM_ADDRESS`         | —                                         | Your **public** Solana address to receive USDC.     |
| `EVM_NETWORK`         | `eip155:84532`                            | CAIP-2 EVM network. Base Mainnet = `eip155:8453`.   |
| `SVM_NETWORK`         | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | CAIP-2 Solana network (Devnet).                     |
| `FACILITATOR_URL`     | `https://x402.org/facilitator`            | Verifies + settles payments.                        |
| `SOLANA_FEED_PRICE`   | `$0.05`                                   | Price per `solana_mev_arbitrage_feed` call.         |
| `APIFY_SCRAPER_PRICE` | `$0.10`                                   | Price per `apify_social_scraper` call.              |
| `SOLANA_RPC_URL`      | public mainnet RPC                        | Used by the MEV feed liveness probe.                |
| `APIFY_TOKEN`         | —                                         | Apify API token. Blank ⇒ scraper returns mock data. |
| `PORT`                | `4022`                                    | HTTP port.                                          |
| `PUBLIC_BASE_URL`     | `http://localhost:4022`                   | Public URL shown in logs/receipts.                  |

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

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start with auto-reload (recommended). |
| `npm start`         | Start once.                           |
| `npm run typecheck` | Type-check without emitting.          |

## License

MIT

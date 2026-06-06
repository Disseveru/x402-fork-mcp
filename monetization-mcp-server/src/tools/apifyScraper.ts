/**
 * Tool: apify_social_scraper
 *
 * Triggers an Apify Actor and returns its dataset items. This is a real
 * integration: when APIFY_TOKEN is set it calls Apify's
 * `run-sync-get-dataset-items` endpoint, which starts the actor, waits for it to
 * finish, and returns the scraped items in one request.
 *
 * When APIFY_TOKEN is NOT set, it returns clearly-labelled MOCK data so the
 * server is fully runnable out-of-the-box (great for testing the payment flow
 * before wiring real keys).
 *
 * Docs: https://docs.apify.com/api/v2#/reference/actors/run-actor-synchronously-with-input-and-get-dataset-items
 *
 * Payment gating is handled by the caller (createPaymentWrapper).
 */

import { z } from 'zod'
import { appConfig } from '../config.js'

export const apifyScraperInputSchema = {
  actorId: z
    .string()
    .min(1)
    .describe("Apify Actor id or name, e.g. 'apify/instagram-scraper' or 'apify~tweet-scraper'."),
  input: z
    .record(z.any())
    .optional()
    .describe('The Actor input object (the run configuration / JSON payload).'),
  maxItems: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Cap on the number of dataset items returned (default 25).'),
}

const ApifyArgs = z.object(apifyScraperInputSchema)
export type ApifyArgs = z.infer<typeof ApifyArgs>

/** Builds clearly-labelled mock results when no Apify token is configured. */
function mockResult(args: ApifyArgs, maxItems: number) {
  const items = Array.from({ length: Math.min(maxItems, 3) }, (_, i) => ({
    id: `mock_${i + 1}`,
    actor: args.actorId,
    text: `MOCK item ${i + 1} — set APIFY_TOKEN in .env to fetch real data.`,
    likes: Math.floor(Math.random() * 5000),
    url: 'https://example.com/mock',
  }))
  return {
    status: 'ok',
    mode: 'mock',
    note: 'MOCK DATA: APIFY_TOKEN is not set. Add it to .env to run the real Apify Actor.',
    actorId: args.actorId,
    requestedInput: args.input ?? {},
    count: items.length,
    items,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Business handler for the Apify social-media scraper tool.
 *
 * @param rawArgs - Caller-supplied arguments (validated here).
 * @returns MCP tool result containing scraped items as JSON text.
 */
export async function runApifyScraper(
  rawArgs: Record<string, unknown>,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const args = ApifyArgs.parse(rawArgs)
  const maxItems = args.maxItems ?? 25

  if (!appConfig.apifyToken) {
    return {
      content: [{ type: 'text', text: JSON.stringify(mockResult(args, maxItems), null, 2) }],
    }
  }

  // Apify accepts both "user/actor" and "user~actor"; normalise to the tilde
  // form used by the REST path.
  const actorPath = encodeURIComponent(args.actorId.replace('/', '~'))
  const url =
    `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items` +
    `?token=${appConfig.apifyToken}&limit=${maxItems}`

  try {
    const controller = new AbortController()
    // Scrapers can take a while; allow up to ~2 minutes.
    const timeout = setTimeout(() => controller.abort(), 120_000)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args.input ?? {}),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const body = await res.text()
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'error',
                mode: 'live',
                actorId: args.actorId,
                httpStatus: res.status,
                detail: body.slice(0, 1000),
              },
              null,
              2,
            ),
          },
        ],
      }
    }

    const items = (await res.json()) as unknown[]
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'ok',
              mode: 'live',
              actorId: args.actorId,
              count: Array.isArray(items) ? items.length : 0,
              items,
              generatedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
    }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'error',
              mode: 'live',
              actorId: args.actorId,
              detail: err instanceof Error ? err.message : 'Apify request failed',
            },
            null,
            2,
          ),
        },
      ],
    }
  }
}

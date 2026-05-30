/**
 * Web Search Extension
 *
 * Provides a `web_search` tool so the LLM can search the web.
 *
 * Search backends (auto-detected):
 *   - DuckDuckGo (default, no API key needed)
 *   - Brave Search (set BRAVE_API_KEY for higher-quality results)
 *
 * Place in ~/.pi/agent/extensions/web-search/index.ts for auto-discovery,
 * or load with: pi -e ./web-search/index.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

// ── Types ──────────────────────────────────────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ── DuckDuckGo Backend ─────────────────────────────────────────────────

async function searchDuckDuckGo(
  query: string,
  maxResults: number,
  region: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const regionParam = region !== "all" ? `-${region.toUpperCase()}` : "";
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=${regionParam}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal,
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo returned ${res.status}: ${res.statusText}`);
  }

  const html = await res.text();
  return parseDuckDuckGoHtml(html, maxResults);
}

function parseDuckDuckGoHtml(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  // Match result blocks: each has a result__a (title + href) and result__snippet
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    const rawUrl = match[1];
    const title = stripHtml(match[2]);
    const snippet = stripHtml(match[3]);

    // DuckDuckGo uses redirect URLs like https://duckduckgo.com/l/?uddg=REAL_URL
    let url = rawUrl;
    try {
      const parsed = new URL(rawUrl);
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) url = decodeURIComponent(uddg);
    } catch {
      // Not a URL, leave as-is
    }

    if (title && snippet) {
      results.push({ title: title.trim(), url, snippet: snippet.trim() });
    }
  }

  return results;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Brave Search Backend ───────────────────────────────────────────────

async function searchBrave(
  query: string,
  maxResults: number,
  region: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(maxResults, 20)),
    search_lang: "en",
  });
  if (region !== "all") params.set("country", region.toUpperCase());

  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": process.env.BRAVE_API_KEY || "",
    },
    signal,
  });

  if (!res.ok) {
    throw new Error(`Brave Search returned ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as { web?: { results: Array<{ title: string; url: string; description: string }> } };
  const raw = data?.web?.results ?? [];
  return raw.slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
}

// ── Router ─────────────────────────────────────────────────────────────

function getBackend(): "brave" | "duckduckgo" {
  if (process.env.BRAVE_API_KEY) return "brave";
  return "duckduckgo";
}

async function searchWeb(
  query: string,
  maxResults: number,
  region: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const backend = getBackend();
  if (backend === "brave") {
    return searchBrave(query, maxResults, region, signal);
  }
  return searchDuckDuckGo(query, maxResults, region, signal);
}

function formatResults(results: SearchResult[]): string {
  if (results.length === 0) return "No results found.";
  return results
    .map(
      (r, i) =>
        `[${i + 1}] **${r.title}**\nURL: ${r.url}\n${r.snippet}`,
    )
    .join("\n\n---\n\n");
}

// ── Extension ──────────────────────────────────────────────────────────

export default function webSearchExtension(pi: ExtensionAPI) {
  const backend = getBackend();

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify(
      `Web search loaded (${backend === "brave" ? "Brave Search API" : "DuckDuckGo"})`,
      "info",
    );
  });

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web for current information. Use this when you need up-to-date facts, news, documentation, or answers that may have changed after your training data cutoff.",
    promptSnippet: "Search the web for information",
    promptGuidelines: [
      "Use web_search when the user asks for current events, recent news, or information that may be time-sensitive.",
      "Use web_search when you don't know the answer or need to verify facts.",
      "Always include specific search terms in the query — avoid vague queries.",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "The search query. Be specific and include relevant keywords.",
      }),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of results to return (default: 5, max: 10).",
        }),
      ),
      region: Type.Optional(
        StringEnum(
          ["all", "us", "uk", "de", "fr", "jp", "ca", "au", "in", "br"] as const,
          {
            description:
              "Region filter for results. 'all' means worldwide (default).",
          },
        ),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const maxResults = Math.min(params.max_results ?? 5, 10);
      const region = params.region ?? "all";

      try {
        const results = await searchWeb(params.query, maxResults, region, signal);
        return {
          content: [
            {
              type: "text",
              text: formatResults(results),
            },
          ],
          details: {
            backend: getBackend(),
            query: params.query,
            resultCount: results.length,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Search failed: ${message}`,
            },
          ],
          isError: true,
          details: {
            backend: getBackend(),
            query: params.query,
          },
        };
      }
    },
  });

  pi.registerCommand("websearch", {
    description: "Search the web from the command line",
    handler: async (args, ctx) => {
      if (!args || args.trim().length === 0) {
        ctx.ui.notify("Usage: /websearch <your query>", "warn");
        return;
      }
      ctx.ui.setStatus("web-search", "Searching...");
      try {
        const results = await searchWeb(args.trim(), 5, "all");
        ctx.ui.notify(`Found ${results.length} results for: "${args.trim()}"`, "info");
        // Send results as a steer message so the LLM can use them
        pi.sendUserMessage(
          `Here are web search results for "${args.trim()}":\n\n${formatResults(results)}`,
          { deliverAs: "followUp" },
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Search failed: ${message}`, "error");
      } finally {
        ctx.ui.clearStatus("web-search");
      }
    },
  });
}

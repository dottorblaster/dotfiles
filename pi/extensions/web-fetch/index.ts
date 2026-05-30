/**
 * Web Fetch Extension
 *
 * Provides a `web_fetch` tool so the LLM can fetch and read web page content.
 *
 * Features:
 *   - Fetches URLs and extracts readable text content
 *   - Supports HTML pages, plain text, JSON, and markdown
 *   - Strips HTML boilerplate (nav, footer, ads, scripts)
 *   - Respects abort signals (Esc cancels in-flight fetches)
 *
 * Place in ~/.pi/agent/extensions/web-fetch/index.ts for auto-discovery,
 * or load with: pi -e ./web-fetch/index.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

// ── Types ──────────────────────────────────────────────────────────────

interface FetchResult {
  url: string;
  status: number;
  contentType: string;
  title: string;
  content: string;
  truncated: boolean;
  contentLength: number;
}

// ── HTML → Text Extraction ─────────────────────────────────────────────

function extractTextFromHtml(html: string): { title: string; text: string } {
  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]).trim() : "";

  // Try to extract main content area first
  let body = html;
  for (const selector of [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ]) {
    const m = selector.exec(body);
    if (m) {
      body = m[1];
      break;
    }
  }

  // Remove script, style, nav, header, footer, aside, svg, noscript, form, iframe
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<img[^>]*alt=["']([^"']+)["'][^>]*>/gi, " $1 ")
    .replace(/<img[^>]*>/gi, "");

  // Convert block elements to newlines
  body = body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|h[1-6]|table|tr|blockquote|pre|ul|ol|dl|section|details)[^>]*>/gi, "\n")
    .replace(/<\/?(td|th)[^>]*>/gi, "\t")
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, " $2 ($1) ")
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ");

  // Decode entities
  let text = body
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

  // Clean up whitespace
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

// ── Fetch Logic ────────────────────────────────────────────────────────

const MAX_CONTENT_LENGTH = 80_000; // chars
const TIMEOUT_MS = 15_000;

async function fetchUrl(
  url: string,
  textOnly: boolean,
  signal?: AbortSignal,
  maxContentLength: number = MAX_CONTENT_LENGTH,
): Promise<FetchResult> {
  // Ensure URL has a protocol
  if (!url.match(/^https?:\/\//i)) {
    url = "https://" + url;
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort());

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: textOnly
          ? "text/plain,text/html,application/xhtml+xml,application/json,text/markdown"
          : "*/*",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status} ${res.statusText} from ${url}`,
      );
    }

    const raw = await res.text();

    let title = "";
    let content: string;
    let truncated = false;

    if (contentType.includes("json")) {
      // Pretty-print JSON
      try {
        const parsed = JSON.parse(raw);
        content = JSON.stringify(parsed, null, 2);
      } catch {
        content = raw;
      }
    } else if (
      contentType.includes("text/plain") ||
      contentType.includes("markdown")
    ) {
      content = raw;
    } else if (textOnly || contentType.includes("html")) {
      // Extract readable text from HTML
      const extracted = extractTextFromHtml(raw);
      title = extracted.title;
      content = extracted.text;
    } else {
      content = raw;
    }

    // Truncate if too long
    if (content.length > maxContentLength) {
      content = content.slice(0, maxContentLength);
      truncated = true;
    }

    return {
      url,
      status: res.status,
      contentType,
      title,
      content,
      truncated,
      contentLength: content.length,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchUrlWithLimit(
  url: string,
  textOnly: boolean,
  maxContentLength: number,
  signal?: AbortSignal,
): Promise<FetchResult> {
  return fetchUrl(url, textOnly, signal, maxContentLength);
}

function formatBulkResult(results: Array<FetchResult | { url: string; error: string }>): string {
  const succeeded = results.filter(
    (r): r is FetchResult => "content" in r && !(r as any).error,
  );
  const failed = results.filter(
    (r): r is { url: string; error: string } => "error" in r,
  );

  const parts: string[] = [];

  // Summary header
  parts.push(
    `**Fetched ${succeeded.length}/${results.length} URLs successfully**`,
    "",
  );

  // Failures first so they're visible
  if (failed.length > 0) {
    parts.push("### Failed");
    for (const f of failed) {
      parts.push(`- ${f.url} — ${f.error}`);
    }
    parts.push("");
  }

  // Successful results
  for (const result of succeeded) {
    parts.push(`### [${result.title || result.url}]`);
    parts.push(`**URL:** ${result.url}`);
    parts.push(`**Length:** ${result.contentLength.toLocaleString()} characters`);
    if (result.truncated) {
      parts.push(
        `⚠️ Truncated to ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`,
      );
    }
    parts.push("", result.content, "", "---", "");
  }

  return parts.join("\n");
}

function formatFetchResult(result: FetchResult): string {
  const parts: string[] = [];

  if (result.title) {
    parts.push(`# ${result.title}`);
  }

  parts.push(`**URL:** ${result.url}`);
  parts.push(`**Content-Type:** ${result.contentType || "unknown"}`);
  parts.push(`**Length:** ${result.contentLength.toLocaleString()} characters`);

  if (result.truncated) {
    parts.push(
      `⚠️ Content truncated to ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`,
    );
  }

  parts.push("---\n", result.content);

  return parts.join("\n");
}

// ── Extension ──────────────────────────────────────────────────────────

export default function webFetchExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Web fetch tool loaded", "info");
  });

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch the content of a web page by URL. Use this to read articles, documentation, API responses, or any publicly accessible web resource. Returns cleaned, readable text from HTML pages, or raw content for JSON/plain-text URLs.",
    promptSnippet: "Fetch and read content from a URL",
    promptGuidelines: [
      "Use web_fetch when the user provides a single URL or asks you to read a web page.",
      "Use web_fetch after web_search to read the actual content of a search result.",
      "Use web_fetch_bulk when you need to fetch multiple URLs at once (e.g. comparing several sources).",
      "Always include the full URL including the protocol (https://).",
    ],
    parameters: Type.Object({
      url: Type.String({
        description:
          "The URL to fetch. Include the protocol (https:// or http://).",
      }),
      text_only: Type.Optional(
        Type.Boolean({
          description:
            "If true, extract only readable text from HTML pages, stripping navigation, ads, and boilerplate. Defaults to true.",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      try {
        const result = await fetchUrl(
          params.url,
          params.text_only !== false,
          signal,
        );

        return {
          content: [
            {
              type: "text",
              text: formatFetchResult(result),
            },
          ],
          details: {
            url: result.url,
            status: result.status,
            contentType: result.contentType,
            title: result.title,
            contentLength: result.contentLength,
            truncated: result.truncated,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Fetch failed: ${message}`,
            },
          ],
          isError: true,
          details: {
            url: params.url,
          },
        };
      }
    },
  });

  pi.registerTool({
    name: "web_fetch_bulk",
    label: "Web Fetch (Bulk)",
    description:
      "Fetch multiple URLs concurrently. Use this when you need content from several pages at once — e.g. comparing sources, reading multiple docs pages, or batch-processing links. Each URL is fetched in parallel with its own timeout; failures on one URL don't affect others.",
    promptSnippet: "Fetch multiple URLs at once",
    promptGuidelines: [
      "Use web_fetch_bulk when you need to read 2 or more URLs in a single tool call.",
      "Avoid web_fetch_bulk for a single URL — use web_fetch instead.",
    ],
    parameters: Type.Object({
      urls: Type.Array(Type.String(), {
        description:
          "List of URLs to fetch. Each should include the protocol (https:// or http://).",
      }),
      text_only: Type.Optional(
        Type.Boolean({
          description:
            "If true, extract only readable text from HTML pages. Defaults to true.",
        }),
      ),
      max_content_length: Type.Optional(
        Type.Number({
          description:
            "Max characters per URL before truncation. Defaults to 80000.",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const textOnly = params.text_only !== false;
      const perUrlLimit = params.max_content_length ?? MAX_CONTENT_LENGTH;
      const urls = params.urls.slice(0, 10); // cap at 10 to avoid abuse

      const results = await Promise.all(
        urls.map(async (url) => {
          try {
            const r = await fetchUrlWithLimit(url, textOnly, perUrlLimit, signal);
            return r;
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { url, error: message };
          }
        }),
      );

      return {
        content: [
          {
            type: "text",
            text: formatBulkResult(results),
          },
        ],
        details: {
          total: urls.length,
          succeeded: results.filter((r) => !("error" in r)).length,
          failed: results.filter((r) => "error" in r).length,
        },
      };
    },
  });

  pi.registerCommand("fetch", {
    description: "Fetch a URL and display its content",
    handler: async (args, ctx) => {
      if (!args || args.trim().length === 0) {
        ctx.ui.notify("Usage: /fetch <url>", "warn");
        return;
      }

      const url = args.trim();
      ctx.ui.setStatus("web-fetch", `Fetching ${url}...`);

      try {
        const result = await fetchUrl(url, true);
        ctx.ui.notify(
          `Fetched ${result.contentLength.toLocaleString()} chars from ${url}`,
          "info",
        );
        pi.sendUserMessage(
          `Here is the content fetched from ${url}:\n\n${formatFetchResult(result)}`,
          { deliverAs: "followUp" },
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Fetch failed: ${message}`, "error");
      } finally {
        ctx.ui.clearStatus("web-fetch");
      }
    },
  });
}

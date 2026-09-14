/**
 * Live Web Search & Content Extraction Engine
 * Fetches real-time web results and snippets via DuckDuckGo without API keys.
 */

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Searches the live web using DuckDuckGo HTML & Instant Answer APIs
 */
export async function searchLiveWeb(query: string, maxResults = 4): Promise<WebSearchResult[]> {
  const cleanQuery = query
    .replace(/^(search for|search the web for|look up|google|find info on)\s+/i, "")
    .trim();

  const results: WebSearchResult[] = [];

  // 1. DuckDuckGo Instant Answer API (fast structured abstracts)
  try {
    const instantUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(instantUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.AbstractText && data.AbstractText.length > 20) {
        results.push({
          title: data.Heading || cleanQuery,
          snippet: data.AbstractText,
          url: data.AbstractURL || "https://duckduckgo.com",
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (results.length >= maxResults) break;
          if (topic.Text && typeof topic.Text === "string" && topic.Text.length > 30) {
            results.push({
              title: topic.Text.slice(0, 50) + "...",
              snippet: topic.Text,
              url: topic.FirstURL || "https://duckduckgo.com",
            });
          }
        }
      }
    }
  } catch {
    // Ignore and proceed to HTML search
  }

  // 2. DuckDuckGo HTML Web Search (for live news, recent articles, forums, situational solutions)
  if (results.length < maxResults) {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        // Split by result containers for high resilience
        const blocks = html.split(/<div[^>]*class="[^"]*result\s+results_links[^"]*"[^>]*>/i);
        for (const block of blocks.slice(1)) {
          if (results.length >= maxResults) break;

          const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
          const titleMatch = block.match(/<h2[^>]*class="result__title"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

          if (snippetMatch && snippetMatch[1]) {
            const rawSnippet = stripHtmlTags(snippetMatch[1]);
            let rawUrl = titleMatch ? titleMatch[1] : "";
            const rawTitle = titleMatch ? stripHtmlTags(titleMatch[2]) : cleanQuery;

            const uddgMatch = rawUrl.match(/[?&]uddg=([^&]+)/);
            if (uddgMatch && uddgMatch[1]) {
              try {
                rawUrl = decodeURIComponent(uddgMatch[1]);
              } catch {}
            }

            if (rawSnippet.length > 20 && !results.some((r) => r.snippet === rawSnippet)) {
              results.push({
                title: rawTitle,
                snippet: rawSnippet,
                url: rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl || "duckduckgo.com"}`,
              });
            }
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  return results;
}

/**
 * Format search results into a clean context prompt for LLM or autonomous synthesizer
 */
export function formatWebContext(results: WebSearchResult[]): string {
  if (results.length === 0) return "No live search results available.";

  return results
    .map((r, i) => `[Source ${i + 1}]: "${r.title}"\nURL: ${r.url}\nExcerpt: ${r.snippet}`)
    .join("\n\n");
}

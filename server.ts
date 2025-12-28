import { getPageData } from "./src/browser.ts";
import { extractContent, removeBoilerplate } from "./src/extractor.ts";
import { htmlToMarkdown, generateFrontmatter } from "./src/markdown.ts";

const snippetRender = (reqs:any,snippetText: string, headers: Record<string, string> = {}) => {
  console.log(reqs)
  return new Response(snippetText, {
    headers: { ...headers, "Content-Type": "text/html" },
  });
};

const fileRender = (snippetFile: string, headers: Record<string, string> = {}) => {

  return new Response(Bun.file(snippetFile), {
    headers: { ...headers, "Content-Type": "text/html" },
  });
};

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

const indexFile = "public/index.html";

const server = Bun.serve({
  port: 3000,
  routes: {
    "/": {
      GET: () => fileRender(indexFile),
    },
    "/render": {
      GET: async (req) => {
        const url = new URL(req.url);
        const targetUrl = url.searchParams.get("q");

        if (!targetUrl) {
          return jsonResponse({ error: "Missing 'q' parameter with URL" }, 400);
        }

        try {
          // Fetch page data
          const { html, metadata, cssClasses } = await getPageData(targetUrl);

          // Extract main content using Readability
          const extracted = extractContent(html, targetUrl);

          let cleanHtml: string;
          let title = metadata.title as string || "";

          if (extracted) {
            cleanHtml = extracted.content;
            title = extracted.title || title;
            if (extracted.byline) metadata.author = extracted.byline;
            if (extracted.siteName) metadata.site_name = extracted.siteName;
            if (extracted.excerpt) metadata.excerpt = extracted.excerpt;
            if (extracted.lang) metadata.lang = extracted.lang;
          } else {
            cleanHtml = removeBoilerplate(html);
          }

          const markdown = await htmlToMarkdown(cleanHtml);
          const frontmatter = generateFrontmatter(metadata, cssClasses, targetUrl);

          const fullMarkdown = `${frontmatter}\n\n${markdown}`;

          return new Response(fullMarkdown, {
            headers: { "Content-Type": "text/markdown" },
          });
        } catch (error: any) {
          return jsonResponse({ error: error.message }, 500);
        }
      },
    },
  },

  // fallback for anything not matched in routes
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);

/**
 * Server-side JSX template for rendering the initial HTML page
 */

interface PageTemplateProps {
  url?: string;
  content?: string;
  error?: { url: string; message: string };
}

export function PageTemplate({ url, content, error }: PageTemplateProps) {
  // Generate initial state script
  let initialState = '';
  if (url && content) {
    initialState = `
      window.__INITIAL_URL__ = ${JSON.stringify(url)};
      window.__INITIAL_CONTENT__ = ${JSON.stringify(content)};
    `;
  } else if (error) {
    initialState = `
      window.__INITIAL_ERROR__ = ${JSON.stringify(error)};
    `;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Downmark - Web to Markdown Converter</title>
        <meta name="description" content="Convert any webpage to clean Markdown using Chrome headless and Readability" />
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
        <link rel="stylesheet" href="/src/styles.css" />
        <link rel="stylesheet" href="/src/content-styles.css" />
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/public/frontend.js"></script>
        {initialState && (
          <script dangerouslySetInnerHTML={{ __html: initialState }} />
        )}
      </body>
    </html>
  );
}

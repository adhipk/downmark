/**
 * CLI utilities for URL input handling
 */

export async function getUrl(): Promise<string> {
  const argUrl = process.argv[2];
  
  if (argUrl) {
    return normalizeUrl(argUrl);
  }
  
  // Interactive mode - prompt for URL
  process.stderr.write("Enter URL: ");
  
  for await (const line of console) {
    const url = line.trim();
    if (url) {
      return normalizeUrl(url);
    }
    process.stderr.write("Enter URL: ");
  }
  
  process.exit(1);
}

function normalizeUrl(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`;
  }
  return url;
}


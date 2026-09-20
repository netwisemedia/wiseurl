import { validateHttpUrl } from './attribution.ts'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function handoffHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Referrer-Policy': 'origin',
    'X-Robots-Tag': 'noindex',
    'Cache-Control': 'private, no-store',
  }
}

export function createHandoffDocument(destination: string): string {
  const url = validateHttpUrl(destination).toString()
  const safeDestination = escapeHtml(url)
  const scriptDestination = JSON.stringify(url)
    .replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="origin">
  <script>location.replace(${scriptDestination});</script>
  <meta http-equiv="refresh" content="0;url=${safeDestination}">
  <title>WiseURL</title>
</head>
<body></body>
</html>`
}

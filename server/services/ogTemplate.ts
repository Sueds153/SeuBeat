interface OgData {
  title: string;
  description: string;
  image: string;
  url: string;
}

export function renderOgPage(data: OgData): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(data.title)}</title>
  <meta name="description" content="${escapeHtml(data.description)}" />
  <meta property="og:title" content="${escapeHtml(data.title)}" />
  <meta property="og:description" content="${escapeHtml(data.description)}" />
  <meta property="og:image" content="${escapeHtml(data.image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escapeHtml(data.url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SeuBeat" />
  <meta property="og:locale" content="pt_AO" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(data.title)}" />
  <meta name="twitter:description" content="${escapeHtml(data.description)}" />
  <meta name="twitter:image" content="${escapeHtml(data.image)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(data.url)}" />
</head>
<body>
  <p>${escapeHtml(data.description)}</p>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

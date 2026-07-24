const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'public', 'assets', 'seubeat_card.svg');
const PNG_PATH = path.join(ROOT, 'public', 'assets', 'seubeat_card.png');
const FONTS_CACHE = path.join(__dirname, 'fonts-cache.json');

const FONT_URLS = {
  outfit: 'https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4deyC4E.ttf',
  jakarta: 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU7NSg.ttf',
};

async function downloadFont(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function getFontsBase64() {
  if (fs.existsSync(FONTS_CACHE)) {
    return JSON.parse(fs.readFileSync(FONTS_CACHE, 'utf8'));
  }
  console.log('[OG] Downloading fonts...');
  const [outfitBuf, jakartaBuf] = await Promise.all([
    downloadFont(FONT_URLS.outfit),
    downloadFont(FONT_URLS.jakarta),
  ]);
  const result = {
    outfit: outfitBuf.toString('base64'),
    jakarta: jakartaBuf.toString('base64'),
  };
  fs.writeFileSync(FONTS_CACHE, JSON.stringify(result));
  console.log('[OG] Fonts cached');
  return result;
}

function buildSVG(fonts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>
      @font-face {
        font-family: 'Outfit';
        font-style: normal;
        font-weight: 700;
        src: url(data:font/ttf;base64,${fonts.outfit}) format('truetype');
      }
      @font-face {
        font-family: 'Plus Jakarta Sans';
        font-style: normal;
        font-weight: 400;
        src: url(data:font/ttf;base64,${fonts.jakarta}) format('truetype');
      }
      @font-face {
        font-family: 'Plus Jakarta Sans';
        font-style: normal;
        font-weight: 600;
        src: url(data:font/ttf;base64,${fonts.jakarta}) format('truetype');
      }
    </style>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f1724" />
      <stop offset="50%" style="stop-color:#1a1a2e" />
      <stop offset="100%" style="stop-color:#111827" />
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F59E0B;stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:#E879F9;stop-opacity:0.05" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#F59E0B" />
      <stop offset="50%" style="stop-color:#F472B6" />
      <stop offset="100%" style="stop-color:#E879F9" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <ellipse cx="600" cy="200" rx="500" ry="300" fill="url(#glow)" />
  <rect x="80" y="80" width="1040" height="4" rx="2" fill="url(#accent)" />
  <rect x="80" y="100" width="1040" height="430" rx="20" fill="rgba(17,24,39,0.6)" stroke="rgba(245,158,11,0.12)" stroke-width="1" />
  <text x="920" y="180" font-size="40" fill="rgba(245,158,11,0.08)">♪</text>
  <text x="960" y="160" font-size="28" fill="rgba(232,121,249,0.06)">♫</text>
  <text x="120" y="440" font-size="52" fill="rgba(232,121,249,0.06)">♪</text>
  <text x="90" y="470" font-size="32" fill="rgba(245,158,11,0.05)">♫</text>
  <text x="120" y="220" fill="#F59E0B" font-family="Outfit,sans-serif" font-size="72" font-weight="700">SeuBeat</text>
  <text x="120" y="280" fill="#E879F9" font-family="Plus Jakarta Sans,sans-serif" font-size="30" font-weight="400">Canções e Dedicatórias Personalizadas</text>
  <text x="120" y="340" fill="rgba(255,255,255,0.45)" font-family="Plus Jakarta Sans,sans-serif" font-size="18" font-weight="400">Surpreenda quem mais ama com uma canção única criada por IA</text>
  <rect x="120" y="380" width="360" height="48" rx="24" fill="rgba(245,158,11,0.15)" stroke="rgba(245,158,11,0.3)" stroke-width="1" />
  <text x="138" y="412" fill="#F59E0B" font-family="Plus Jakarta Sans,sans-serif" font-size="18" font-weight="600">Criar música personalizada →</text>
  <rect x="80" y="546" width="1040" height="4" rx="2" fill="url(#accent)" />
  <text x="120" y="590" fill="rgba(255,255,255,0.2)" font-family="Plus Jakarta Sans,sans-serif" font-size="13" font-weight="400">seubeat.onrender.com</text>
</svg>`;
}

async function main() {
  console.log('[OG] Generating OG image...');
  const fonts = await getFontsBase64();
  const svg = buildSVG(fonts);
  fs.writeFileSync(SVG_PATH, svg);
  console.log('[OG] SVG written');

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('[OG] sharp not available, skipping PNG generation');
    return;
  }

  await sharp(SVG_PATH)
    .resize(1200, 630)
    .png()
    .toFile(PNG_PATH);
  const size = fs.statSync(PNG_PATH).size;
  console.log(`[OG] PNG generated: ${(size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error('[OG] Error:', err.message);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axeCore = require('axe-core');

async function runAxeOnFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost' });
  const { window } = dom;

  // Expose minimal globals axe expects
  global.window = window;
  global.Node = window.Node;
  global.HTMLElement = window.HTMLElement;
  global.document = window.document;

  try {
    const results = await axeCore.run(window.document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa']
      }
    });

    const outDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    const outPath = path.join(outDir, 'axe-report.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

    // Print concise summary
    console.log('Axe scan finished. Summary:');
    console.log('Violations:', results.violations.length);
    results.violations.forEach((v) => {
      console.log(`- ${v.id} (${v.impact}) — ${v.help}`);
    });
    console.log('\nDetailed report written to', outPath);
  } catch (err) {
    console.error('Error running axe:', err);
    process.exitCode = 2;
  }
}

const target = path.join(process.cwd(), 'index.html');
if (!fs.existsSync(target)) {
  console.error('index.html not found in workspace root.');
  process.exit(1);
}

runAxeOnFile(target);

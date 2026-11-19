#!/usr/bin/env node
// Screenshot the app in headless Chrome for art and layout reviews. Starts its
// own Vite dev server and uses the dev-only deep links in src/ui/devDemo.ts.
//
//   node scripts/render.mjs                       every shot below
//   node scripts/render.mjs home ek-game          just these
//   node scripts/render.mjs --size 390,844 --mobile ek-game
//   node scripts/render.mjs --url "?demo=doomlings&seed=3&moves=60" --name custom
//   --full       capture the whole page as viewport-sized tiles: name.png, name-p2.png, …
//                (galleries always do; one huge screenshot can hang headless Chrome)
//   --port 5201  run beside another render (each port gets its own Vite cache)
//   --click sel  click the first element matching `sel` after the page settles (e.g. a Rules button)
//
// Shots land in art-renders/ (git-ignored). CLAUDE.md: look at art rendered
// before calling it done — tests pass on art that looks like nothing.

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openBrowser, sleep } from './lib/chrome.mjs';

const GAMES = {
  ek: 'exploding-kittens',
  uu: 'unstable-unicorns',
  hts: 'here-to-slay',
  cs: 'casting-shadows',
  hld: 'happy-little-dinos',
  dm: 'doomlings',
};

const SHOTS = {
  home: { url: '', wait: '.game-card' },
  ...Object.fromEntries(
    Object.entries(GAMES).flatMap(([k, id]) => [
      [`${k}-gallery`, { url: `?gallery=${id}`, wait: '.dev-gallery', full: true }],
      [`${k}-lobby`, { url: `?lobby=${id}`, wait: '.lobby-panel' }],
      [`${k}-game`, { url: `?demo=${id}&players=4&seed=7&moves=40`, wait: '.cg-table' }],
      [`${k}-over`, { url: `?demo=${id}&players=4&seed=7&over`, wait: '.cg-table' }],
    ]),
  ),
};

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const [w, h] = opt('size', '1440,900').split(',').map(Number);
const mobile = args.includes('--mobile');
const out = opt('out', 'art-renders');
const port = Number(opt('port', '5191'));
const base = `http://localhost:${port}/chaotic-games/`;

let shots;
if (opt('url', null)) shots = { [opt('name', 'custom')]: { url: opt('url'), wait: opt('wait', '#root > *') } };
else if (positional.length) shots = Object.fromEntries(positional.map((n) => [n, SHOTS[n] ?? (() => { throw new Error(`unknown shot ${n}`); })()]));
else shots = SHOTS;

mkdirSync(out, { recursive: true });
// A server already answering on this port is a stale run's (killed by `timeout`
// before it could clean up); screenshots from it would show old code.
try {
  await fetch(base, { signal: AbortSignal.timeout(1500) });
  console.error(`render: something is already serving ${base} (a stale render run?). Stop it or pass another --port.`);
  process.exit(1);
} catch {
  /* free — good */
}
// --force: re-optimise deps every run. A cache left half-updated by an earlier
// run (killed mid-reoptimise) otherwise leaves the page blank. One cache per
// port, so parallel runs can't corrupt each other's.
const cacheDir = `node_modules/.vite-render-${port}`;
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--force'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, CG_VITE_CACHE: cacheDir },
});
vite.stderr.on('data', (d) => process.stderr.write(d));
let chrome = null;
// Killed from outside (Ctrl-C, `timeout`): take the dev server and the browser down with us.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    vite.kill();
    chrome?.close().catch(() => {});
    process.exit(130);
  });
}
// --force rebuilds the cache every run, so nothing is worth keeping: remove it on the way out.
process.on('exit', () => {
  vite.kill();
  try {
    rmSync(cacheDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    /* Vite may still hold a file for a moment; the next run overwrites it anyway */
  }
});
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not up yet */
    }
    if (i > 120) throw new Error('vite did not start');
    await sleep(250);
  }
  chrome = await openBrowser();
  try {
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
    // Collect uncaught errors and console.error calls, so a broken page can't pass as a screenshot.
    await chrome.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__renderErrors = [];
        addEventListener('error', (e) => window.__renderErrors.push(String(e.message)));
        addEventListener('unhandledrejection', (e) => window.__renderErrors.push(String(e.reason)));
        const ce = console.error.bind(console);
        console.error = (...a) => { window.__renderErrors.push(a.map(String).join(' ')); ce(...a); };`,
    });
    for (const [name, shot] of Object.entries(shots)) {
      await chrome.navigate(base + shot.url);
      const ok = await chrome.waitFor(shot.wait, 30000);
      // Lazy chunks bring their own web fonts; shooting before they land shows fallbacks.
      await chrome.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true, returnByValue: true });
      await sleep(Number(opt('settle', '1200')));
      const click = shot.click ?? opt('click', null);
      if (click) {
        await chrome.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(click)}); if (el) el.click(); })()`);
        await sleep(900);
      }
      const errors = (await chrome.evaluate('window.__renderErrors ?? []')) ?? [];
      const stem = join(out, `${name}${mobile ? '-mobile' : ''}`);
      const files = [];
      if (shot.full || args.includes('--full')) {
        const total = await chrome.evaluate('document.documentElement.scrollHeight');
        const tiles = Math.min(12, Math.max(1, Math.ceil(total / h)));
        for (let t = 0; t < tiles; t++) {
          await chrome.evaluate(`window.scrollTo(0, ${t * h})`);
          await sleep(250);
          const file = t === 0 ? `${stem}.png` : `${stem}-p${t + 1}.png`;
          writeFileSync(file, await chrome.screenshot());
          files.push(file);
        }
        await chrome.evaluate('window.scrollTo(0, 0)');
      } else {
        writeFileSync(`${stem}.png`, await chrome.screenshot());
        files.push(`${stem}.png`);
      }
      console.log(`${ok ? 'ok  ' : 'MISS'} ${files.join(', ')}${errors.length ? ` — ${errors.length} error(s):` : ''}`);
      for (const e of errors.slice(0, 5)) console.log(`       ${e.slice(0, 300)}`);
    }
  } finally {
    await chrome.close();
  }
} catch (e) {
  console.error('render:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  vite.kill();
  // Exit explicitly: an open handle (the browser socket) must not keep the run alive.
  process.exit(process.exitCode ?? 0);
}

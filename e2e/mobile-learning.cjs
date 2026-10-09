/** Actual UI components + synthetic fixtures, no login or production database.
 * Optional isolated tools: NODE_PATH=/path/to/qa/node_modules node e2e/mobile-learning.cjs
 * Requires esbuild + playwright; Chromium comes from CHROMIUM_PATH or /usr/bin/chromium.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.OUT_DIR || 'mobile-learning-screens');
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'averna-mobile-'));
  fs.mkdirSync(out, { recursive: true });
  let browser, server;
  try {
    const stub = `import React from 'react'; export default function Link({href,children,prefetch,scroll,...props}) { return <a href={href} {...props}>{children}</a>; } export function usePathname(){return '/progress';} export function useSearchParams(){return new URLSearchParams(location.search);} export function useRouter(){return {push:(...args)=>{window.__navigation=args},replace:()=>{}};}`;
    await build({ entryPoints: [path.join(root, 'tests/fixtures/mobile-learning.tsx')], bundle: true, jsx: 'automatic', format: 'iife', platform: 'browser', outfile: path.join(temp, 'app.js'), tsconfig: path.join(root, 'tsconfig.json'), alias: { '@': root, react: path.join(root,'node_modules/react'), 'react-dom': path.join(root,'node_modules/react-dom') }, plugins: [{ name:'qa-next', setup(b) { b.onResolve({filter:/^next\/(navigation|link)$/},()=>({path:'next-stub',namespace:'qa'})); b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:stub,loader:'tsx',resolveDir:root})); } }] });
    execFileSync(process.execPath, [path.join(root, 'node_modules/tailwindcss/lib/cli.js'), '-i', path.join(root,'app/globals.css'), '-o', path.join(temp,'app.css'), '--minify'], { cwd:root, stdio:'pipe' });
    const html = '<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="/app.css" rel="stylesheet"><script>if(new URLSearchParams(location.search).get("theme")==="light")document.documentElement.className="light";</script></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
    server = http.createServer((req,res)=>{const pathname=new URL(req.url,'http://127.0.0.1').pathname; const file=pathname==='/app.js'?'app.js':pathname==='/app.css'?'app.css':null;res.setHeader('Content-Type',file?.endsWith('.css')?'text/css':file?'application/javascript':'text/html');res.end(file?fs.readFileSync(path.join(temp,file)):html);});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const base='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
    const cases = [
      ['editor-remote-390','editor','remote',390,'dark'],
      ['editor-offline-320','editor','offline',320,'light'],
      ['editor-conflict-390','editor','conflict',390,'dark'],
      ['editor-desktop','editor','remote',1440,'light'],
      ['readiness-390','readiness','populated',390,'dark'],
      ['readiness-empty-320','readiness','empty',320,'light'],
      ['readiness-desktop','readiness','populated',1440,'dark'],
      ['nav-320','nav','empty',320,'dark'],
      ['nav-390','nav','empty',390,'light'],
      ['nav-tablet','nav','empty',768,'dark'],
      ['teacher-review-320','review','empty',320,'light'],
      ['ai-tools-390','ai','empty',390,'dark'],
    ];
    const results=[];
    for (const [name,mode,state,width,theme] of cases) {
      const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce',isMobile:width<768,hasTouch:width<768});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${base}/?mode=${mode}&state=${state}&theme=${theme}`);await page.waitForTimeout(400);
      if(mode==='editor'){
        await assert.equal(await page.getByRole('textbox',{name:'Your essay'}).inputValue(),'My local essay must be preserved. '.repeat(10));
        if(state==='remote'){
          assert.equal(await page.getByRole('button',{name:'Save to account',exact:true}).isDisabled(),true);
          await page.getByRole('button',{name:'Compare / restore'}).click();
          assert.equal(await page.getByRole('button',{name:'Load account copy',exact:true}).isDisabled(),true);
          await page.getByRole('checkbox').check();
          await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100);
          await page.screenshot({path:path.join(out,name+'-compare.png'),fullPage:true});
          await page.getByRole('button',{name:'Load account copy',exact:true}).click();
          assert.match(await page.getByRole('textbox',{name:'Your essay'}).inputValue(),/^An account essay/);
        }
        if(state==='conflict'){
          await page.getByRole('button',{name:'Save to account',exact:true}).click();
          await page.getByText('The account draft changed on another device. Reload and compare both copies.').waitFor();
          assert.equal(await page.getByRole('button',{name:'Save to account',exact:true}).isDisabled(),true);
          assert.match(await page.getByRole('textbox',{name:'Your essay'}).inputValue(),/^My local essay/);
        }
        // Real CSS dimensions, not only class names.
        const targets=await page.locator('button:visible').evaluateAll(nodes=>nodes.map(n=>({label:n.textContent.trim()||n.getAttribute('aria-label'),h:n.getBoundingClientRect().height})));
        if(width<768) assert.equal(targets.filter(t=>t.h<43.5).length,0,JSON.stringify(targets));
      }
      if(mode==='review'){await page.getByRole('textbox',{name:'Student essay'}).fill('A synthetic student essay with a clear argument and a few grammar mistakes.');await page.getByRole('button',{name:'Review essay',exact:true}).click();await page.getByText('Estimated band',{exact:true}).waitFor();}
      if(mode==='nav'){
        const teaching=page.getByRole('button',{name:'Teaching & preparation',exact:true});await teaching.click();await page.getByText('Teaching & preparation panel',{exact:true}).waitFor();
        await page.locator('nav[aria-label="Dashboard sections"]').evaluate(n=>n.parentElement.scrollLeft=9999);
        assert.equal(await page.getByRole('link',{name:'Play',exact:true}).isVisible(),true);
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,name+' horizontal overflow');assert.deepEqual(errors,[]);
      await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100);
      await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});results.push({name,width,theme,noPageOverflow:true,consoleErrors:errors});await page.close();
    }
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));console.log('PASS: '+results.length+' real-component synthetic mobile/tablet/desktop cases, explicit restore, conflict preservation, tab access and phone touch targets. Screenshots require visual review.');
  } finally {if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});

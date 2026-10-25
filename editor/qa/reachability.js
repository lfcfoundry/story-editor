/* Check-report reachability explanations. Usage: node reachability.js [firefox|chromium]. Copyright (c) 2026 LFC Foundry. MIT License. */
const browserName = process.argv[2] || 'firefox';
const browserEngine = require('./engine').pick(browserName);
const editorFile = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let failures = 0;
const check = (condition, message) => {
  console.log(`${condition ? 'PASS ' : 'FAIL '}${message}`);
  if (!condition) failures++;
};

(async () => {
  const browser = await browserEngine.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  try {
    await context.addInitScript(() => {
      localStorage.setItem(
        'story-editor-v1-settings',
        JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } })
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(editorFile);
    await page.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 20000 });
    await page.evaluate(() => {
      const project = window.__editor.project;
      const start = project.passages.find(passage => passage.id === project.start);
      project.items.push({ id: 'qa_unheld_key', name: 'QA key', kind: 'object', show: true });
      project.passages.push({
        id: 'qa_unreachable',
        name: 'Unreachable QA page',
        heading: '',
        ending: false,
        valence: '',
        todo: false,
        color: '',
        note: '',
        blocks: [{ text: 'This page has no incoming choice.', needs: [], forbid: [], orPrev: false }],
        gives: [],
        takes: [],
        adds: {},
        sends: {},
        choices: []
      }, {
        id: 'qa_reachable_dead_end',
        name: 'Reachable QA dead end',
        heading: '',
        ending: false,
        valence: '',
        todo: false,
        color: '',
        note: '',
        blocks: [{ text: 'This reachable page has no choices.', needs: [], forbid: [], orPrev: false }],
        gives: [],
        takes: [],
        adds: {},
        sends: {},
        choices: []
      });
      start.choices.push({
        label: 'Open locked page',
        to: 'qa_unreachable',
        needs: ['qa_unheld_key'],
        forbid: [],
        gives: [],
        takes: [],
        adds: {},
        check: null,
        lock: false,
        why: ''
      }, {
        label: 'Reach dead end',
        to: 'qa_reachable_dead_end',
        needs: [],
        forbid: [],
        gives: [],
        takes: [],
        adds: {},
        check: null,
        lock: false,
        why: ''
      });
      window.__editor.refresh();
    });
    await page.click('#tabs button:has-text("Check"), [role=tab]:has-text("Check")');
    const unreachableIssue = page.locator('#main .issue.bad:has-text("Unreachable QA page” can never be reached")');
    await unreachableIssue.waitFor({ state: 'visible', timeout: 10000 });
    check((await unreachableIssue.locator('button:has-text("Why?")').count()) === 1, 'confirmed unreachable finding offers Why?');
    const unreachableDeadEnd = page.locator('#main .issue.bad:has-text("Unreachable QA page” is a dead end")');
    check((await unreachableDeadEnd.locator('button:has-text("Why?")').count()) === 0, 'unrelated problem on that page has no Why? action');
    const reachableDeadEnd = page.locator('#main .issue.bad:has-text("Reachable QA dead end” is a dead end")');
    check((await reachableDeadEnd.locator('button:has-text("Why?")').count()) === 0, 'reachable passage finding has no Why? action');
    await unreachableIssue.locator('button:has-text("Why?")').click();
    const whyDialog = page.locator('dialog').last();
    const dialogHeading = await whyDialog.locator('h3').innerText();
    const dialogText = await whyDialog.innerText();
    check(dialogHeading.includes('Unreachable QA page'), 'Why? opens the explanation for the intended passage');
    check(dialogText.includes('Open locked page') && dialogText.includes('never offered') && dialogText.includes('QA key'), 'the explanation identifies the impossible incoming condition');
    check(errors.length === 0, `no page errors: ${JSON.stringify(errors)}`);
  } finally {
    await context.close();
    await browser.close();
  }
  process.exitCode = failures ? 1 : 0;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

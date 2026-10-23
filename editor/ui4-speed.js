/* ---------------------------------------------------------------------------
   3d2. Speed report ("It stuttered!")
   ---------------------------------------------------------------------------
   Smoothness can only be judged on the device and browser the editor runs on: a test machine cannot see how a screen
   paints on yours. This part lets you do the judging and send back numbers. The recording itself is the shared field-report
   module (field-report.js, started in ui1-state.js as `fieldReport`): it keeps start-up times, heavy tasks and every error (and the last
   3,600 frame times once "Record frames" in the report window is pressed; always-on frames slowed the Map's first frames in Firefox), and five quick taps in the top-left corner of the page open its two hidden buttons ("Save speed report",
   "Save error log"). Options -> Speed report (or #report in the address) opens the same report in a window to copy or save.
   Always on (costs almost nothing): how long each tab switch, each run of the checker and each map zoom took, kept as a short
   list in memory (speedLog) and added to the saved report under "Story Editor details". Never written anywhere, never sent
   anywhere, and no story text is in it.
   --------------------------------------------------------------------------- */

const SPEED_KEEP = 400; // timings kept
const SPEED_HEAVY = 8; // timings this long (ms) are also passed to the module's heavy-task list
const speedLog = []; // { at: ms since the page opened, kind, ms, note }

/** Records that something called `kind` took `ms`, with a short note (the view, the size). */
function speedNote(kind, ms, note) {
  speedLog.push({ at: Math.round(performance.now()), kind, ms: Math.round(ms * 10) / 10, note: note || '' });
  if (speedLog.length > SPEED_KEEP) speedLog.shift();
  if (ms >= SPEED_HEAVY) fieldReport.time(note ? `${kind} (${note})` : kind, ms);
}
/** Runs `fn`, records how long it took under `kind`, and returns what it returned. `note` may be text or a function giving text. */
function speedTime(kind, fn, note) {
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    speedNote(kind, performance.now() - t0, typeof note === 'function' ? note() : note);
  }
}
/** Records how long it took from `t0` until the screen was next drawn (measured after the next frame). */
function speedPaint(kind, t0, note) {
  requestAnimationFrame(() => {
    setTimeout(() => speedNote(kind, performance.now() - t0, note), 0);
  });
}

/* ----- the report ----- */

const speedPct = (list, p) => {
  const a = list.slice().sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0;
};
/** The editor's own lines for the saved report: the build, the story's size, how the page opened and the timings it kept. */
function speedExtras() {
  const L = ['', '## Story Editor details', ''];
  const nav = performance.getEntriesByType('navigation')[0];
  L.push(`- Version: ${BUILT}`);
  L.push(
    `- Window: ${innerWidth}x${innerHeight}; reduced motion ${matchMedia('(prefers-reduced-motion: reduce)').matches ? 'on' : 'off'}; theme ${document.documentElement.dataset.theme || 'light'}`
  );
  const choices = project.passages.reduce((n, p) => n + p.choices.length, 0);
  L.push(`- Story: ${project.passages.length} pages, ${choices} choices, ${project.items.length} items; tab ${view}`);
  const got = nav ? Math.round(nav.responseEnd) : 0; // the file has arrived (from disk or the network)
  L.push(
    `- Opened in ${READY_AT ? Math.round(READY_AT) + ' ms' : 'more than ' + Math.round(performance.now()) + ' ms (not drawn yet)'}: ` +
      `the file arrived at ${got} ms, the editor's code started at ${Math.round(BOOT_AT)} ms (${Math.max(0, Math.round(BOOT_AT) - got)} ms unpacking and reading the page), ` +
      `the first screen was drawn at ${READY_AT ? Math.round(READY_AT) : '?'} ms (${READY_AT ? Math.round(READY_AT - BOOT_AT) : '?'} ms setting up). All counted from the moment the page was asked for.`
  );
  const kinds = [...new Set(speedLog.map(e => e.kind))];
  if (kinds.length) {
    L.push('', '### Timings (milliseconds, lower is better)', '', '| What | Count | Median | 95th percentile | Worst |', '|---|---:|---:|---:|---:|');
    kinds.forEach(k => {
      const ms = speedLog.filter(e => e.kind === k).map(e => e.ms);
      L.push(`| ${k} | ${ms.length} | ${speedPct(ms, 0.5)} | ${speedPct(ms, 0.95)} | ${Math.max(...ms)} |`);
    });
    L.push('', '### Latest events', '');
    speedLog.slice(-20).forEach(e => L.push(`- ${(e.at / 1000).toFixed(1)} s  ${e.kind}  ${e.ms} ms${e.note ? `  (${e.note})` : ''}`));
  }
  return L.join('\n');
}
/** What the module saves for "Save speed report" (its report plus the editor's lines) and for "Save error log" (as it is). */
function speedTextFor(kind) {
  return kind === 'speed' ? fieldReport.speedText() + '\n' + speedExtras() : fieldReport.errorsText();
}
/** The module calls this when a button is pressed in its hidden panel (or in the window below): the system Save window where there is one, else a download. */
async function speedSave(text, file, kind) {
  const full = kind === 'speed' ? text + '\n' + speedExtras() : text;
  try {
    const ok = await saveFile(file, full, 'text/markdown', 'Report', 'reports');
    if (ok) toast(kind === 'speed' ? 'Speed report saved' : 'Error log saved');
  } catch (e) {
    logError('save report', e);
    toast('The report could not be saved. Use Copy report instead.');
  }
}
/** The whole report as plain text, for the window and for Copy report. */
function speedReportText() {
  return speedTextFor('speed') + '\n\n' + fieldReport.errorsText();
}
/** Options -> Speed report: how to use it, the report so far, and the buttons. */
function showSpeedReport() {
  dialog((d, close) => {
    d.appendChild(h('h3', { text: 'Speed report' }));
    d.appendChild(
      h('div', {
        class: 'hint',
        text:
          'For when something feels slow or choppy. Use the editor the way that stutters (zoom the map, switch tabs), then open this report: it holds start-up, heavy tasks and errors since the page opened, and the frames since you pressed Record frames. ' +
          'Copy the report and paste it into the chat, or save it as a file. On a phone, five quick taps in the top-left corner open the same two saves. It holds timings and your device’s details, never your story’s words, and nothing is sent anywhere.'
      })
    );
    const ta = h('textarea', { class: 'in mono', readonly: true, rows: 14, 'aria-label': 'Speed report', value: speedReportText() });
    d.appendChild(ta);
    d.appendChild(
      h('div', { class: 'row end' }, [
        h('button', { class: 'btn primary', type: 'button', text: 'Copy report', onclick: () => copyText(ta.value, ta) }),
        h('button', {
          class: 'btn',
          type: 'button',
          text: 'Save speed report',
          title: 'Save the speed report (frames, start-up, heavy tasks, the editor’s timings and device details, never your story’s words) as a small file to send or keep',
          onclick: () => fieldReport.saveSpeed()
        }),
        h('button', {
          class: 'btn',
          type: 'button',
          text: 'Save error log',
          title: 'Save the errors the page noted as a small file to send or keep',
          onclick: () => fieldReport.saveErrors()
        }),
        h('button', {
          class: 'btn',
          type: 'button',
          text: 'Record frames',
          title: 'Start counting frames (smoothness) from now; open this report again afterwards. Earlier errors are cleared by this.',
          onclick: () => {
            fieldReport.stop();
            fieldReport = startFieldReport(true);
            close();
            toast('Recording frames. Use the editor, then open Speed report again.');
          }
        }),
        h('button', { class: 'btn', type: 'button', text: 'Close', onclick: close })
      ])
    );
  });
}

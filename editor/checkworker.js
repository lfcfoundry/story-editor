/* ============================================================================
   CHECK-WORKER: after an edit, a big story is checked in a background worker, so the page stays free to draw. Like the Map's worker (see
   mapWorkerSource in maplayout.js), the worker's code is not a second copy: it is the text of the same functions and constants as the
   checker uses here. What it sends back is the part of the answer that can travel (problems, warnings, endings, counts); the live
   explainers (samples, why, canArrive, explain) stay on the page and are made on request, as before.
   check-worker-equiv.mjs proves the text is complete and gives the same answer as analyze().
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
const CHECK_WORKER_FUNCS = [analyze, analyzeRun, klGraphWasm, klGraphInit, condSummary, klGroupValues, joinAnd, parseStatTest, klWalkWasm, klWalkRun, klWalkInit, vidOf, parseSend, givenOf, virtualRefs];
const CHECK_WORKER_DATA = { PRUNE_AFTER, KL_GRAPH_B64, EDGE_CAP, KL_WALK_B64, KL_WALK64_B64, STAT_SPAN_COMFY };
const CHECK_WORKER_ARROWS = { kindOf };
function checkWorkerSource() {
  const fns = CHECK_WORKER_FUNCS.map(f => f.toString()).join('\n');
  const arrows = Object.keys(CHECK_WORKER_ARROWS)
    .map(k => `const ${k}=${CHECK_WORKER_ARROWS[k].toString()};`)
    .join('\n');
  const data = Object.keys(CHECK_WORKER_DATA)
    .map(k => `const ${k}=${JSON.stringify(CHECK_WORKER_DATA[k])};`)
    .join('\n');
  return `'use strict';\nlet klGraphMod;const klWalkMods=[undefined,undefined];\n${data}\n${arrows}\n${fns}\nonmessage=e=>{const m=e.data;try{const t=performance.now();const A=analyze(JSON.parse(m.text));postMessage({seq:m.seq,r:{problems:A.problems,warnings:A.warnings,notes:A.notes,endings:A.endings,states:A.states,grouped:A.grouped,pruned:A.pruned,truncated:A.truncated},ms:performance.now()-t})}catch(x){postMessage({seq:m.seq,error:String(x&&x.message||x)})}};`;
}

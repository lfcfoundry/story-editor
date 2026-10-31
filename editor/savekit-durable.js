/* ============================================================================
   SAVEKIT-DURABLE: the crash-safe copy from save-kit 1.4.0 (JS-modules, modules/save-kit/save-kit.js as merged, the "durable" part), copied
   unchanged so the editor and the games share one tested code path. SaveKit.durableCopy(name) -> { write(text, seq), newer(seq), flushed() }:
   each text is also put in IndexedDB with durability 'strict' (on disk before the browser says done), newest only; newer(seq) answers with
   the copy that was there when the page opened, if its seq is higher and its text is whole. Used by ui1-state.js (safeCopy).
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
const SaveKitDurable = (function () {
  'use strict';
  function isNum(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }
  // ---- durable mirror (IndexedDB copy of create()'s saves) ----
  // Each save is also put in IndexedDB with durability 'strict' (written through to disk before the browser says done), newest only:
  // while one write runs, later saves wait and only the newest is written. The record already there when the page opened is read once
  // (boot) before any write, so a save made before recover() runs can never cover up the newer copy recover() is looking for.
  function durableMirror(name, given) {
    var idb = given !== undefined ? given : typeof indexedDB !== 'undefined' ? indexedDB : null, dbp = null, busy = false, pend = null, waiters = [], boot;
    function db() {
      if (!dbp) dbp = new Promise(function (ok) {
        if (!idb) { ok(null); return; }
        try {
          var rq = idb.open(name, 1);
          rq.onupgradeneeded = function () { rq.result.createObjectStore('slots'); };
          rq.onsuccess = function () { var d = rq.result; d.onversionchange = d.onclose = function () { try { d.close(); } catch (e) {} dbp = null; }; ok(d); };
          rq.onerror = rq.onblocked = function () { dbp = null; ok(null); };
        } catch (e) { dbp = null; ok(null); }
      });
      return dbp;
    }
    function read() {
      return db().then(function (d) {
        return new Promise(function (ok) {
          if (!d) { ok(null); return; }
          try { var rq = d.transaction('slots', 'readonly').objectStore('slots').get('main'); rq.onsuccess = function () { ok(rq.result || null); }; rq.onerror = function () { ok(null); }; } catch (e) { ok(null); }
        });
      });
    }
    function done(r) { var w = waiters; waiters = []; for (var i = 0; i < w.length; i++) w[i](r); }
    function run() {
      if (busy || !pend) return;
      busy = true;
      var job = pend; pend = null;
      boot.then(db).then(function (d) {
        return new Promise(function (ok) {
          if (!d) { ok(false); return; }
          try {
            var t = d.transaction('slots', 'readwrite', { durability: 'strict' });
            t.objectStore('slots').put(job, 'main');
            t.oncomplete = function () { ok(true); }; t.onerror = t.onabort = function () { ok(false); };
          } catch (e) { ok(false); }
        });
      }).then(function (r) { busy = false; if (pend) run(); else done(r); });
    }
    boot = read();
    return {
      boot: boot,
      write: function (t, at) { pend = { t: t, n: t.length, at: at }; run(); },
      flushed: function () { return !busy && !pend ? Promise.resolve(true) : new Promise(function (ok) { waiters.push(ok); }); }
    };
  }
  // durableCopy(name, { indexedDB }) -> { write(text, seq), newer(seq), flushed() }: the same strict IndexedDB copy for any text (an app with its
  // own save format and checks). write() never throws and keeps only the newest waiting text. newer(seq) -> Promise<{ text, seq } or null>:
  // the copy that was there when this page opened, when its seq is above the given one (the seq of what the app loaded) and its text is whole.
  function durableCopy(name, o) {
    var m = durableMirror(String(name || 'save-kit-durable'), o && 'indexedDB' in o ? o.indexedDB : undefined);
    return {
      write: function (text, seq) { if (typeof text === 'string' && isNum(seq)) m.write(text, seq); },
      newer: function (seq) {
        return m.boot.then(function (r) { return r && typeof r.t === 'string' && r.t.length === r.n && isNum(r.at) && r.at > (isNum(seq) ? seq : -Infinity) ? { text: r.t, seq: r.at } : null; }, function () { return null; });
      },
      flushed: m.flushed
    };
  }
  return { durableCopy: durableCopy };
})();

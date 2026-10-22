#!/usr/bin/env python3
# Copyright (c) 2026 LFC Foundry. MIT License.
# Puts wasm/checkwalk.wasm, wasm/checkwalk64.wasm, wasm/checkgraph.wasm and wasm/mapcross.wasm into ../checkwalk.js (between the WASM:BEGIN/WASM:END, WASM64, GRAPH and CROSS markers) as base64. Run after build.sh.
import base64, pathlib, re
here = pathlib.Path(__file__).resolve().parent
js = here.parent / "checkwalk.js"
text = js.read_text(encoding="utf8")
for wasm, tag in (("checkwalk.wasm", "WASM"), ("checkwalk64.wasm", "WASM64"), ("checkgraph.wasm", "GRAPH"), ("mapcross.wasm", "CROSS")):
    raw = (here / wasm).read_bytes()
    b64 = base64.b64encode(raw).decode()
    text, n = re.subn(r"/\*%s:BEGIN\*/ '.*?' /\*%s:END\*/" % (tag, tag), lambda m: "/*%s:BEGIN*/ '" % tag + b64 + "' /*%s:END*/" % tag, text, flags=re.S)
    assert n == 1, tag
    print("embedded %s: %d bytes (%d base64 characters)" % (wasm, len(raw), len(b64)))
js.write_text(text, encoding="utf8")

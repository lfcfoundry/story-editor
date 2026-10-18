#!/usr/bin/env python3
# Copyright (c) 2026 LFC Foundry. MIT License.
# Puts wasm/checkwalk.wasm into ../checkwalk.js (between the WASM:BEGIN and WASM:END markers) as base64. Run after build.sh.
import base64, pathlib, re
here = pathlib.Path(__file__).resolve().parent
js = here.parent / "checkwalk.js"
b64 = base64.b64encode((here / "checkwalk.wasm").read_bytes()).decode()
text = js.read_text(encoding="utf8")
text2, n = re.subn(r"/\*WASM:BEGIN\*/ '.*?' /\*WASM:END\*/", lambda m: "/*WASM:BEGIN*/ '" + b64 + "' /*WASM:END*/", text, flags=re.S)
assert n == 1
js.write_text(text2, encoding="utf8")
print("embedded %d bytes (%d base64 characters) into checkwalk.js" % (len(b64) * 3 // 4, len(b64)))

#!/bin/sh
# Copyright (c) 2026 LFC Foundry. MIT License.
# Builds checkwalk.wasm (the exploring loop, 32-bit flags), checkwalk64.wasm (the same with 64-bit flags) and checkgraph.wasm (the move-graph passes) and prints their sizes. Needs clang with the wasm32 target and wasm-ld.
# Then run embed.py to put both into ../checkwalk.js. Each module imports its memory from JavaScript (so the tables can be laid out there).
# Each stays under 4,096 bytes, which Chromium compiles synchronously on the page thread.
set -e
cd "$(dirname "$0")"
clang --target=wasm32 -Os -mbulk-memory -nostdlib -ffreestanding -fno-builtin -Wl,--no-entry -Wl,--export=walk -Wl,--export=__heap_base -Wl,--import-memory -Wl,--strip-all \
  -o checkwalk.wasm checkwalk.c
clang --target=wasm32 -DW64 -Os -mbulk-memory -nostdlib -ffreestanding -fno-builtin -Wl,--no-entry -Wl,--export=walk -Wl,--export=__heap_base -Wl,--import-memory -Wl,--strip-all \
  -o checkwalk64.wasm checkwalk.c
clang --target=wasm32 -Os -mbulk-memory -nostdlib -ffreestanding -fno-builtin -Wl,--no-entry -Wl,--export=init -Wl,--export=canReach -Wl,--export=firstCuts -Wl,--export=__heap_base -Wl,--import-memory -Wl,--strip-all \
  -o checkgraph.wasm checkgraph.c
wc -c checkwalk.wasm checkwalk64.wasm checkgraph.wasm

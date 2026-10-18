#!/bin/sh
# Copyright (c) 2026 LFC Foundry. MIT License.
# Builds checkwalk.wasm from checkwalk.c and prints its size. Needs clang with the wasm32 target and wasm-ld. Then run embed.py to put it into ../checkwalk.js.
# The module imports its memory from JavaScript (so the tables can be laid out there) and exports one function, walk.
set -e
cd "$(dirname "$0")"
clang --target=wasm32 -Os -mbulk-memory -nostdlib -ffreestanding -fno-builtin -Wl,--no-entry -Wl,--export=walk -Wl,--export=__heap_base -Wl,--import-memory -Wl,--strip-all \
  -o checkwalk.wasm checkwalk.c
wc -c checkwalk.wasm

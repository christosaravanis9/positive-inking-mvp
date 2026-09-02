#!/bin/bash
# Double-click launcher: opens Terminal.app automatically and runs the full
# stack via `npm run start`. Keep this window open while working -- closing
# it stops the stack (same as Ctrl+C in a normal terminal). To stop from a
# different window instead, run `npm run stop`.
cd "$(dirname "$0")" || exit 1
npm run start

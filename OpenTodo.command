#!/bin/zsh

TODO_DIR="/Users/galigali/Documents/Codex/2026-05-14/new-chat"
TODO_URL="http://127.0.0.1:4173/"

if ! curl -fsS --max-time 1 "$TODO_URL" >/dev/null 2>&1; then
  cd "$TODO_DIR" || exit 1
  screen -S todo-workbench -X quit >/dev/null 2>&1 || true
  screen -dmS todo-workbench /bin/zsh "$TODO_DIR/run-todo-server.sh"
  sleep 1
fi

open -n -b com.google.Chrome --args --app="$TODO_URL" 2>/dev/null && exit 0
open -na "Google Chrome" --args --app="$TODO_URL" 2>/dev/null && exit 0
open -a "Safari" "$TODO_URL" 2>/dev/null && exit 0
open "$TODO_URL"

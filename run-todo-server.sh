#!/bin/zsh
set -eu

TODO_DIR="/Users/galigali/Documents/Codex/2026-05-14/new-chat"
LOG_FILE="$TODO_DIR/.todo-server-wrapper.log"

{
  echo "Starting Todo server at $(date)"
  echo "User: $(id)"
  echo "Python: $(/usr/bin/python3 --version 2>&1)"
} >> "$LOG_FILE" 2>&1

exec /usr/bin/python3 "$TODO_DIR/todo_server.py"

#!/bin/bash
# Appends each prompt and Claude's final reply to "Session Log.md" at the repo root.
# Wired up in .claude/settings.json: UserPromptSubmit logs the prompt, Stop logs the reply.
# Usage: log-session.sh user|assistant   (hook JSON arrives on stdin)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/Session Log.md"
STATE="$ROOT/.claude/.last-logged"
INPUT="$(cat)"
NOW="$(date '+%Y-%m-%d %H:%M')"

case "$1" in
  user)
    PROMPT="$(printf '%s' "$INPUT" | jq -r '.prompt // empty')"
    [ -z "$PROMPT" ] && exit 0
    {
      printf '\n---\n\n**🧑 %s — user**\n\n' "$NOW"
      printf '%s\n' "$PROMPT" | sed 's/^/> /'
      printf '\n'
    } >> "$LOG"
    ;;
  assistant)
    TRANSCRIPT="$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')"
    [ -f "$TRANSCRIPT" ] || exit 0
    # Text blocks of the last assistant message that has any text
    read -r UUID < <(jq -r 'select(.type=="assistant" and ([.message.content[]? | select(.type=="text")] | length > 0)) | .uuid' "$TRANSCRIPT" | tail -1)
    [ -z "$UUID" ] && exit 0
    [ "$UUID" = "$(cat "$STATE" 2>/dev/null)" ] && exit 0
    TEXT="$(jq -r --arg u "$UUID" 'select(.uuid==$u) | [.message.content[] | select(.type=="text") | .text] | join("\n\n")' "$TRANSCRIPT")"
    {
      printf '\n**🤖 %s — assistant**\n\n%s\n' "$NOW" "$TEXT"
    } >> "$LOG"
    printf '%s' "$UUID" > "$STATE"
    ;;
esac
exit 0

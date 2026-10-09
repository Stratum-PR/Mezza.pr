#!/usr/bin/env bash
# PostToolUse hook for Edit|Write: runs ESLint on the edited file only.
# Lint errors go back to Claude (exit 2, on stderr). Anything else (no file path, not JS/TS,
# file outside a repo or ignored by ESLint, ESLint missing or crashing) exits 0 so it never
# blocks work. The edit itself has already happened; this only reports.
set -u

input=$(cat)
file=$(printf '%s' "$input" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try {
      const j = JSON.parse(s);
      process.stdout.write(String(j?.tool_input?.file_path ?? ""));
    } catch {}
  });
' 2>/dev/null) || exit 0

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

# Lint from the repo (or worktree) that holds the file, so its eslint.config.mjs applies.
root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
eslint="$root/node_modules/.bin/eslint"
[ -x "$eslint" ] || exit 0

cd "$root" || exit 0
out=$("$eslint" --no-warn-ignored "$file" 2>&1)
status=$?
if [ "$status" -eq 1 ]; then
  printf 'ESLint found errors in %s:\n%s\n' "$file" "$out" >&2
  exit 2
fi
exit 0

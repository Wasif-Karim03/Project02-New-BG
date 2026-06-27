#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-structure.sh — repo structure & hygiene guard.
#
#   ./check-structure.sh [path]      (defaults to current dir)
#
# Detects the stack (Next.js / Python-FastAPI / React Native) and checks that
# the repo looks professionally organized: required hygiene files present, no
# secrets or dependencies or OS junk committed, sane asset/data handling.
#
# HARD failures (exit 1): things a reviewer would flag immediately.
# Warnings (exit 0): softer structural suggestions you can choose to ignore.
#
# Portable: POSIX-friendly bash (works on macOS's bash 3.2). No node/python
# needed, so it runs in a Python or mobile repo just as well as a Next one.
# ---------------------------------------------------------------------------
set -eu

TARGET="${1:-.}"
cd "$TARGET"

fails=()
warns=()
add_fail() { fails[${#fails[@]}]="$1"; }
add_warn() { warns[${#warns[@]}]="$1"; }

# --- git-aware helpers (stricter when in a git repo) ------------------------
HAS_GIT=0
if [ -d .git ] && command -v git >/dev/null 2>&1; then HAS_GIT=1; fi

is_tracked() {
  # is path tracked by git? only meaningful when HAS_GIT=1
  git ls-files --error-unmatch "$1" >/dev/null 2>&1
}

# --- detect stack -----------------------------------------------------------
STACK="unknown"
if [ -f package.json ]; then
  if grep -q '"next"' package.json 2>/dev/null; then STACK="next"
  elif grep -Eq '"(react-native|expo)"' package.json 2>/dev/null; then STACK="react-native"
  else STACK="node"; fi
elif [ -f pyproject.toml ] || [ -f requirements.txt ] || [ -f setup.py ]; then
  STACK="python"
fi

# === UNIVERSAL CHECKS =======================================================

# Required hygiene files
[ -f README.md ] || [ -f README.rst ] || [ -f readme.md ] \
  || add_fail "No README — every repo needs one (what it is, stack, how to run)."
[ -f .gitignore ] \
  || add_fail "No .gitignore — dependencies/secrets/junk will get committed."

# Secrets must never be committed (only example/sample env files)
for envf in .env .env.local .env.production .env.development; do
  if [ -f "$envf" ]; then
    if [ "$HAS_GIT" = "1" ]; then
      if is_tracked "$envf"; then add_fail "$envf is committed — secrets must stay out of git. Commit .env.example instead."; fi
    else
      add_warn "$envf exists — make sure it's gitignored (couldn't verify without git)."
    fi
  fi
done
if [ ! -f .env.example ] && [ ! -f .env.sample ]; then
  add_warn "No .env.example — document required env vars with safe placeholder values."
fi

# Dependencies / build output / OS junk must not be committed
if [ "$HAS_GIT" = "1" ]; then
  for junk in node_modules .venv venv __pycache__ .next dist build .DS_Store Thumbs.db; do
    if git ls-files | grep -q "\(^\|/\)$junk\(/\|$\)"; then
      add_fail "$junk is committed — add it to .gitignore and untrack it."
    fi
  done
  # obvious secret/key files
  if git ls-files | grep -Eq '(^|/)(id_rsa|.*\.pem|.*\.p12|.*\.keystore|serviceAccount.*\.json)$'; then
    add_fail "A key/credential file appears to be committed — remove it from git history."
  fi
fi

# Large binaries that should use Git LFS or external storage
if [ "$HAS_GIT" = "1" ]; then
  big="$(git ls-files | while read -r f; do
           [ -f "$f" ] || continue
           sz=$(wc -c < "$f" 2>/dev/null || echo 0)
           if [ "$sz" -gt 5242880 ]; then echo "$f"; fi
         done)"
  if [ -n "$big" ]; then
    add_warn "Large file(s) >5MB tracked in git — consider Git LFS or external storage:"$'\n'"      $(echo "$big" | head -5 | tr '\n' ' ')"
  fi
fi

# Uploaded / generated data should not be a pile in git
for d in uploads upload storage tmp temp; do
  if [ -d "$d" ] && [ "$HAS_GIT" = "1" ] && git ls-files "$d" | grep -q . ; then
    add_warn "/$d is tracked — runtime uploads/data usually belong in .gitignore (keep a .gitkeep)."
  fi
done

# === STACK-SPECIFIC CHECKS ==================================================
case "$STACK" in
  next|node)
    [ -d app ] || [ -d src/app ] || [ -d pages ] || [ -d src ] \
      || add_warn "No app/ src/ or pages/ — front-end code looks unstructured."
    if [ -d app ] || [ -d src/app ]; then
      # crude "everything dumped in app root" smell: many .tsx directly in app/
      loose=$(ls app/*.tsx 2>/dev/null | wc -l | tr -d ' ')
      [ "${loose:-0}" -gt 8 ] && add_warn "Many components live directly in app/ — extract shared UI into components/ and logic into lib/."
    fi
    ;;
  python)
    if [ ! -d app ] && [ ! -d src ] && ! ls ./*/__init__.py >/dev/null 2>&1; then
      add_warn "No clear package dir (app/ or src/<pkg>/) — Python code looks unstructured."
    fi
    [ -d tests ] || [ -d test ] || add_warn "No tests/ directory — backends should ship tests."
    [ -f pyproject.toml ] || add_warn "No pyproject.toml — prefer it (with uv/poetry) over a bare requirements.txt."
    ;;
  react-native)
    [ -f app.json ] || [ -f app.config.js ] || [ -f app.config.ts ] \
      || add_warn "No app.json / app.config — expected for an Expo/React Native app."
    [ -d app ] || [ -d src ] || add_warn "No app/ (expo-router) or src/ — mobile code looks unstructured."
    ;;
  *)
    add_warn "Couldn't detect the stack — universal checks only."
    ;;
esac

# === REPORT =================================================================
echo "structure check — detected stack: $STACK"

if [ ${#warns[@]} -gt 0 ]; then
  echo ""
  echo "warnings (${#warns[@]}):"
  i=0; while [ $i -lt ${#warns[@]} ]; do echo "  • ${warns[$i]}"; i=$((i+1)); done
fi

if [ ${#fails[@]} -gt 0 ]; then
  echo ""
  echo "FAILED (${#fails[@]}):"
  i=0; while [ $i -lt ${#fails[@]} ]; do echo "  ✗ ${fails[$i]}"; i=$((i+1)); done
  echo ""
  echo "Fix the failures above, or tune the checks in scripts/check-structure.sh."
  exit 1
fi

echo ""
echo "✓ structure check passed."
exit 0

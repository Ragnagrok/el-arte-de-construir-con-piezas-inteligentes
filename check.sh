#!/usr/bin/env bash
# Checks that the article's examples typecheck and run, that the laws hold,
# that every file in rejected/ fails with the error on its "// expects:" line,
# and that the laws catch a predicate combinator that forgets its parentheses.
set -euo pipefail
# CI turns colors on; the checks below grep plain text.
export NO_COLOR=1 FORCE_COLOR=0
cd "$(dirname "$0")"

[ -d node_modules ] || pnpm install --frozen-lockfile --silent

failures=0

pnpm exec tsc --noEmit -p tsconfig.json
echo "ok   src/ and test/ typecheck"

pnpm exec vitest run --reporter=dot >/dev/null
echo "ok   the examples run and the laws hold (vitest)"

# Typecheck one file on its own; the output goes to stdout.
typecheck() {
  printf '{ "extends": "./tsconfig.json", "include": [], "files": ["%s"] }\n' "$1" > .check-tsconfig.json
  pnpm exec tsc --noEmit -p .check-tsconfig.json 2>&1
}
trap 'rm -f .check-tsconfig.json' EXIT

if output=$(typecheck examples/SameShape.ts); then
  echo "ok   examples/SameShape.ts compiles: phantom types don't tell apart two tables with the same shape"
else
  echo "FAIL examples/SameShape.ts should compile:"; echo "$output"; failures=1
fi

for f in rejected/*.ts rejected/*.tsx; do
  expected=$(sed -n 's|^// expects: ||p' "$f")
  if output=$(typecheck "$f"); then
    echo "FAIL $f typechecked, and it shouldn't"; failures=1
  elif grep -qF -- "$expected" <<<"$output"; then
    echo "ok   $f doesn't typecheck: $expected"
  else
    echo "FAIL $f doesn't typecheck, but not for the expected reason:"; echo "$output"; failures=1
  fi
done

# The mutant runs on a copy, so the working tree is never touched.
work=$(mktemp -d)
trap 'rm -f .check-tsconfig.json; rm -rf "$work"' EXIT
cp -r src test package.json tsconfig.json "$work"
ln -s "$PWD/node_modules" "$work/node_modules"
patch -s -p1 -d "$work" < mutants/no-parentheses.diff
law="not selects exactly the rows the predicate doesn't"
if output=$(cd "$work" && pnpm exec vitest run test/laws.test.ts 2>&1); then
  echo "FAIL the laws didn't catch mutants/no-parentheses.diff"; failures=1
elif grep -qF -- "× $law" <<<"$output"; then
  echo "ok   mutants/no-parentheses.diff breaks the law: $law"
else
  echo "FAIL mutants/no-parentheses.diff failed, but not on the expected law:"; echo "$output"; failures=1
fi

exit $failures

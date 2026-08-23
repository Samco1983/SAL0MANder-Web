# SCOREBOARD

Every line is a point or a gap. **No agent may write a checkmark** — green comes
from the exit code of the `CHECK` beside it, and the check is written before the
work starts.

```
npm run score
```

`[x]` passed · `[ ]` failed · `[?]` the check could not run on this host

**Writing a CHECK:** it must touch something our agents do not control — a
deployed URL, a receipt file, a GitHub API result. `npm test` is weak: a broker
test asserted its own argv contained a flag and stayed green for the entire life
of an adapter that had never once reached a model. A check that reads only our
own output is a mirror, not a referee.

**Same failure twice → change the approach, do not retry.** On 2026-08-22 the
overnight worker failed identically eight times in a row, hourly, and nothing
escalated. That is the failure this board is built to make impossible to miss.

---

## Delivery — the only lines that score

[ ] Rumiko: May, June, July bank statements have a receipt  ::  CHECK: test "$(find ~/Desktop/RUMIKO_COUNTY_SUBMISSION/04_RECEIPTS -name '*.png' 2>/dev/null | wc -l | tr -d ' ')" -ge 2

[ ] Rumiko: SOC 873 submitted to Fresno IHSS  ::  CHECK: test -n "$(find ~/Desktop/RUMIKO_COUNTY_SUBMISSION/04_RECEIPTS -iname '*ihss*' 2>/dev/null)"

## The council can act without Samuel

[?] Overnight worker reaches a model  ::  CHECK: NET: gh run list --workflow=overnight-claude-web-worker.yml --status success --limit 1 --json conclusion --jq '.[0].conclusion' | grep -q success

[?] One click creates one GitHub queue item  ::  CHECK: NET: curl -sf -X POST "$SAL0_OPS_URL" -H 'Content-Type: application/json' -H "Origin: https://samco1983.github.io" -d '{"action":"nudge","reason":"scoreboard check"}' | jq -e '.issueUrl'

[x] Broker dispatches a Claude worker unattended  ::  CHECK: test -s ~/.sal0mander/mission-control/runs/auth-proof-060921/attempt-1/stdout.txt && grep -q 'AUTH OK' ~/.sal0mander/mission-control/runs/auth-proof-060921/attempt-1/stdout.txt

[x] Gemini dispatches unattended via agy  ::  CHECK: PATH="$HOME/.local/bin:$PATH" agy -p "reply with exactly: GEMINI DISPATCH OK" 2>/dev/null | grep -q "GEMINI DISPATCH OK"

[x] Broker dispatches a Codex worker unattended  ::  CHECK: grep -q 'CODEX OK' ~/.sal0mander/mission-control/runs/codex-first-contact/attempt-1/stdout.txt

## The product

[?] Unity WebGL loader is fetchable from the live site  ::  CHECK: NET: test $(curl -sf "https://samco1983.github.io/SAL0MANder-Web/unity-build/Build/sal0-unity-webgl.loader.js" | wc -c) -gt 10000

[ ] The LIVE site serves its own assets (not a stale index.html)  ::  CHECK: NET: curl -sf "https://samco1983.github.io/SAL0MANder-Web/" | grep -qE '(src|href)="/SAL0MANder-Web/assets/'

[x] A student can finish the lesson on a phone, no Unity  ::  CHECK: node scripts/sal0-web-proof.mjs

## Unity

[x] A Unity WebGL build exists on disk  ::  CHECK: test "$(find "$HOME/Documents/New project/SAL0MANder-hosted-worker/Build/WebGL/Build" -name 'WebGL.wasm*' -size +1M 2>/dev/null | wc -l | tr -d ' ')" -ge 1

[x] The WebGL build includes the current source commit  ::  CHECK: U="$HOME/Documents/New project/SAL0MANder-hosted-worker"; test "$(git -C "$U" log -1 --format=%ct)" -le "$(stat -f %m "$U/Build/WebGL/Build/WebGL.wasm.br")"

[ ] The Unity source tree is clean  ::  CHECK: test -z "$(git -C "$HOME/Documents/New project/SAL0MANder-hosted-worker" status --porcelain 2>/dev/null)"

## Make

[?] A Make scenario exists and is reachable  ::  CHECK: NET: test -s ~/.sal0mander/secrets/make_api_token && curl -sf -H "Authorization: Token $(cat ~/.sal0mander/secrets/make_api_token)" "https://us2.make.com/api/v2/scenarios" | jq -e '.scenarios | length > 0'

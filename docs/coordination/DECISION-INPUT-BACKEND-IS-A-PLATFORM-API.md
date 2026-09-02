# If the game ships to other platforms, the backend is not a web backend

**2026-09-02 · web lane · input to a decision that has not been made**

The owner's framing: **the web gets a backend; the game itself ships to
different platforms.** That is the right split, and this repository is already
shaped for it. One consequence is easy to miss, and it is cheaper to see now
than after a provider is chosen.

## What already supports this

- `src/api/transport.ts` — a one-method `Transport` interface is the only seam
  between features and any backend. Swapping the mock for something real is one
  new implementation, not a refactor.
- `src/contracts/v1/` — every type is `z.infer` of a schema, versioned, and
  frozen once Unity ships against it.
- `createHttpTransport` already handles retries, timeouts, idempotency keys and
  contract-mismatch detection.

None of that assumed a multi-platform game, and all of it survives one.

## The thing that does not survive

**The Unity↔Web bridge is WebGL-only.** `src/unity/bridge.ts` sends with
`instance.SendMessage(...)` and receives a `window` CustomEvent. Neither exists
in an iOS, Android, or desktop Unity build. There is no `window` and no JS
instance to call.

So the data path today:

```
backend ──> React app (Transport) ──> bridge ──> Unity
```

On any non-web platform there is no React app and no bridge:

```
backend ──> Unity (C# HTTP)
```

**The backend therefore has to be a platform API that Unity can call directly,
not a web-app API that only the site talks to.** That is a constraint on the
choice, not a task to schedule.

## What it rules in and out

**Auth cannot be browser-session-based.** `HttpTransportConfig.credentials`
is a `RequestCredentials` — a browser concept. Cookie/session auth behind
same-origin works beautifully for the site and is unavailable to a C# client.
Bearer tokens work for both. A provider whose only comfortable path is
cookie-session is a provider that works for the website and not the app.

This lands directly on the open auth question: teachers sign up, students never
do. Whatever issues a teacher's token has to issue one a C# client can hold and
refresh.

**Same-origin cannot be assumed.** The privacy page and the district summary
both currently say the browser contacts exactly one domain — true today because
there is no backend. A backend on another host makes those statements wrong on
the day it ships, and they are load-bearing for the filter problem. Either the
API is served from `sal0mander.com`, or three pages get updated in the same
change. Worth deciding deliberately rather than discovering.

**The contract needs one source, not two.** `src/contracts/v1/` is Zod, which
gives TypeScript types. A C# client needs the same shapes, and hand-writing them
twice is drift with a delay fuse — the failure arrives as a student seeing the
wrong puzzle, months later. Generating both from one schema (JSON Schema or
OpenAPI emitted from the Zod definitions) costs a build step now and removes a
whole category of bug.

**Share links get more valuable, and more fragile.** A QR on a worksheet opening
`sal0mander.com/play/act_x` works on the web today. With native apps the same
URL should open the app if installed and the site if not — Universal Links on
iOS, App Links on Android. Both are configured against **the exact URL shape**,
which is why `routes.ts` already treats that shape as versioned and stable. It
now has a second reason to never change.

## What does not change

Guest Play stays ungated on every platform. No account, no email, no password
between a share link and playable content. Nothing above touches that, and
nothing should.

## Not a recommendation

No backend, auth provider, or host is proposed here, and none should be chosen
on the strength of this document. These are the constraints the multi-platform
decision imposes on that choice, written down while the choice is still open.

Lane note: the bridge, the transport and the contracts are web-lane files. What
Unity does on native is Codex's. The overlap is the contract, which is why it is
worth agreeing on before either side builds against it.

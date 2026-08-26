# `src/contracts/` — shared SAL0MANder data contract

**Status: DRAFT. Not yet agreed with Unity/Codex.**

This folder is the *boundary*, not the final agreement. It exists so that when
the real Unity ↔ Web contract is negotiated, there is exactly one place it lands
and exactly one place both sides read from.

## Rules

1. **Versioned folders, never in-place edits.** `v1/` is frozen once Unity ships
   against it. A breaking change means adding `v2/` and running both until Unity
   migrates. Never mutate a shipped version's shape.
2. **Schema is the source of truth.** Every type is derived from a Zod schema
   (`z.infer`), never hand-written alongside it. Parsing at the boundary means a
   backend change can't silently corrupt the UI.
3. **Contracts are transport-agnostic.** No `fetch`, no URLs, no React. The same
   schemas must be usable by a future Node/edge service and, if we ever generate
   C# from them, by Unity.
4. **Durable IDs.** IDs are opaque strings that are stable forever. A teacher's
   printed QR code from 2026 must still resolve in 2031. Never renumber, never
   reuse, never encode meaning into an ID that could change.
5. **Additive by default.** New optional fields are safe. Removing a field,
   renaming a field, or narrowing an enum is breaking.
6. **No gameplay state here.** Puzzle piece positions, rotations, snap state,
   and per-frame interaction stay inside Unity. This contract carries *what to
   play* and *what happened*, not *how the pieces moved*.

## What lives here

| Module       | Owns                                                        |
| ------------ | ----------------------------------------------------------- |
| `ids.ts`     | Durable ID types + branding                                 |
| `common.ts`  | Envelope, pagination, timestamps, contract version          |
| `activity.ts`| Activity descriptor + published/share metadata              |
| `session.ts` | Guest and authenticated play sessions, result summaries     |
| `profile.ts` | Player profile, XP/level/credits/badges (shape only)        |
| `media.ts`   | Media descriptors and upload intents                        |
| `errors.ts`  | Canonical API error shape                                   |

Authoring is versioned separately under `authoring/`. A working teacher draft
can be incomplete; its publishable schema enforces the question-to-piece rule.
This keeps editor evolution out of the frozen student runtime contract.

## Open questions for Codex / product

- Does Unity consume this contract as JSON over HTTP, or should we generate C#
  DTOs from the schemas?
- Who mints activity IDs — Unity (offline-capable, client-generated UUID) or the
  backend (authoritative)? Offline-first argues for client-minted.
- What is the minimum result payload a Guest Play session must report, given no
  account exists to attach it to?

# The Mirror Protocol

**Standing rules for the Google Doc.** Written 2026-08-18, from the owner's
rulings. Authority: `docs/DECISIONS.md` **D-022** and **D-023**.

Written in plain language on purpose. It is meant to be pasted to any agent —
Claude, Codex, Gemini, Unity AI — and understood without reading anything else.

---

## The whole thing in one line

**The Doc shows. GitHub decides.**

Everything below is just making that safe.

---

## What the Doc is for

It is the one place everyone can see the same current state without logging into
anything. You, and every agent, however much or little access it has.

That is its job. Shared awareness. Not control, not the record.

GitHub is the filing cabinet — versioned, permanent, you can always see who
changed what and when. The Doc is the whiteboard by the door. Nobody files
anything on a whiteboard, but it is the first thing everyone sees on the way in.

---

## The eight rules

1. **Make writes it. Nobody else.** No agent ever edits the Doc.

2. **It is built from GitHub.** Nothing appears in the Doc that is not already
   committed. The Doc is generated, never authored.

3. **Anyone can read it, no login.** That is the point. Do not lock it down so
   tight it stops being the failsafe.

4. **Every line is stamped** with the commit it came from and the UTC time it
   was written. A reader can always tell how old a line is.

5. **Read it freely. Do not act on it.** When an agent actually does something,
   the instruction traces to a GitHub artifact — so there is a record of what it
   was told.

6. **Anything typed into the Doc gets erased** on the next update. If something
   needs to stick, it goes into GitHub.

7. **If GitHub is unreachable: read, do not act.** Report "cannot verify" and
   stop.

8. **Nothing secret, ever.** No passwords, tokens, keys, or webhook addresses.
   Assume anyone could see it.

Rules 1, 2 and 6 are one idea wearing three hats: the Doc shows, GitHub decides.

---

## The part everyone asks about

*If an agent cannot act on the Doc, what is the point of reading it?*

**Reading it is not wasted. It changes a hunt into a single lookup.**

An agent starting cold, with no Doc, has to go collect facts scattered across
two repos, several folders, and an issue thread, and work out what they mean.
The Doc had that done once already, by Make. One read instead of ten.

Then it needs to act. It does **not** start over. The Doc already told it which
thing to open, so it does one targeted check instead of a broad search.

This is what rule 4 is for. The Doc line says *"from commit `abc1234`, 10
minutes ago."* The agent asks GitHub one question: **is `abc1234` still the
latest?**

- **Yes** — nothing moved, the Doc was accurate, act.
- **No** — something changed, read the new thing first, then act.

One quick check, not a re-read of everything. You only pay the full cost when
something actually changed, which is exactly when you should.

So: **the Doc tells you where to look. GitHub tells you it is still true.**

---

## Who this helps most

The Doc's value goes **up** the less access an agent has.

| Who | What the Doc is worth |
| --- | --- |
| The owner | The whole picture, on a phone, without opening GitHub |
| Gemini | Most of what it can know — it opens a Doc natively; GitHub needs a token |
| Any agent without a token | The difference between knowing and not knowing |
| Claude, Codex | A convenience. Both already have their repo files open |

Worth building for the first three alone.

---

## What this does not do

It does not make agents run. **Routing and queueing are proven; waking an agent
is not** (open item **W-9**). The Doc reports what the system has committed. It
never reports what an agent is doing right now, because nothing can currently
ask one.

A quiet lane is not a stopped lane. That mistake has already been made once in
this project, and the dashboard says so in its own footer.

---

## If you are an agent reading this

Read the Doc to get oriented. Follow its links to GitHub. Confirm the commit it
named is still current. Then act, and commit what you did, so the next update of
the Doc tells the truth about you.

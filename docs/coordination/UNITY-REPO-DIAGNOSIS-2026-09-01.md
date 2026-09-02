# Why the Unity repo feels like a clusterfuck

**2026-09-01 · web lane · read-only diagnosis · nothing in the Unity repo was
modified**

Requested by the owner. `SAL0MANDER-Puzzle-Prototype` was inspected, not
touched. Every claim below is a command anyone can re-run.

---

## First, a correction

Earlier tonight I said Unity's work was "split across two branches" and that
"no build has ever contained both halves." **That is no longer true, and
repeating it would send someone hunting for a merge that does not need to
happen.**

```
git merge-base --is-ancestor codex/reconcile-student-runtime-20e774b \
                             codex/p1-unity-ux-recovery   ->  true
```

The two branches are a straight line, not a fork:

```
main ──(9 commits)── codex/reconcile-student-runtime-20e774b   [PR #22]
                          └──(2 commits)── codex/p1-unity-ux-recovery   [no PR]
```

`p1-unity-ux-recovery` **strictly contains** everything in the reconcile
branch. Neither branch is behind `main`. There is nothing to reconcile between
them and no lost half. That is the good news, and it makes the actual problems
much smaller than they look.

---

## P0 — Eleven commits of recovery work exist on one laptop

```
git ls-remote --heads origin codex/p1-unity-ux-recovery   ->  (empty)
```

`codex/p1-unity-ux-recovery` has **never been pushed**. It is `main` plus 11
commits and it is the only place the current gameplay fixes exist — including
the drag fix, which is the defect the owner has been chasing for days:

```csharp
// PuzzlePiece.cs — a snapped piece is now final state
-        isLocked = false;
+        isLocked = true;
-        if (col != null) col.enabled = true;
+        if (col != null) col.enabled = false;
```

A disk failure, an errant `git checkout -f`, or a reset loses all of it. This
is one command and it is the most valuable thing anyone can do tonight:

```bash
git push -u origin codex/p1-unity-ux-recovery
```

Pushing a branch deploys nothing and merges nothing. It is pure insurance.

---

## P1 — The open PR is for the older, smaller branch

**PR #22** is open against `codex/reconcile-student-runtime-20e774b`, which is
the 9-commit subset. The 2 commits that actually contain tonight's gameplay
recovery — `c5ff47e "fix: recover Unity gameplay and responsive authoring UX"`
and `9dd8ebe "feat: add focused Teacher Studio activity workspace"`, both
committed after 20:45 — are **not in PR #22**.

So a build produced from PR #22, or a merge of PR #22, ships without the drag
fix. Anyone reviewing #22 and concluding "the gameplay fix is in" would be
wrong, and nothing in the PR says otherwise.

Either retarget #22 at the recovery branch or open a second PR for it. What
must not happen is merging #22 and believing the gameplay work went with it.

---

## P2 — Stale duplicates of the same work sit uncommitted on the wrong branch

The working tree is checked out on `reconcile` and shows 8 modified gameplay
files. Seven of them are the same files the two newest commits touch. Compared
against the recovery branch:

| File | Working tree vs `p1-unity-ux-recovery` |
| --- | --- |
| `PuzzleManager.cs` | identical |
| `PuzzlePiece.cs` | identical |
| `QuestionEditorUI.cs` | identical |
| `Sal0manderUIStyle.cs` | identical |
| `StudentPlayUI.cs` | identical |
| `PuzzleOptionsUI.cs` | **older** (4+ / 22−) |
| `TeacherStudioUI.cs` | **older** (56+ / 153−) |

Nothing here is unique work at risk — it is an earlier snapshot of what is
already committed. But it is actively dangerous in a different way: **a Unity
build made right now builds the working tree, not a branch.** That produces an
artifact matching no commit, with two files at an older state than the fix
everyone believes is in. That is precisely how a build "mysteriously" lacks a
fix that is definitely in the code.

Once the recovery branch is pushed, check it out and let the working tree match
it, so what builds is what is committed.

---

## P3 — The structural cause: the scene cannot be merged

This is the one worth fixing properly, because it is what forces every
symptom above.

`Assets/Scenes/SampleScene.unity` is **21 MB of YAML — 40,414 lines of
mergeable text**. Unity's Force Text serialization is on, which is correct.

But `.gitattributes` says:

```
*.unity binary
*.prefab binary
```

The `binary` attribute means `-diff -merge`. Git is being told to treat a
perfectly mergeable text file as an opaque blob, so:

- **Two branches that both touch the scene cannot be merged.** Git reports
  "Cannot merge binary files" and takes one side wholesale. The other side's
  scene work is gone, silently.
- No diff is ever shown, so a scene change is unreviewable — 21 MB moved, and
  nobody can see what.

That single line is why work has to be serialized onto one long linear branch,
why branches get abandoned rather than merged, and why "which branch has the
real scene" is a question at all. The repo is 135 MB, and scene revisions
dominate it.

**The fix is not to delete the line.** A plain text merge of Unity YAML can
produce a corrupt scene. Unity ships a three-way merge tool for exactly this —
UnityYAMLMerge, in the Editor's `Tools/` directory:

```gitattributes
*.unity   merge=unityyamlmerge eol=lf
*.prefab  merge=unityyamlmerge eol=lf
*.asset   merge=unityyamlmerge eol=lf
```

```bash
git config merge.unityyamlmerge.name "Unity SmartMerge"
git config merge.unityyamlmerge.driver \
  '"/Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/Tools/UnityYAMLMerge" \
   merge -p "$BASE" "$REMOTE" "$LOCAL" "$MERGED"'
```

Codex's call — it is Unity's repo and its lane. But until scenes can merge,
every parallel branch is a coin flip over whose scene survives, and the safest
available workflow is the one being used now: one branch at a time, which is
slow and is what makes this feel like a clusterfuck.

---

## The order

1. `git push -u origin codex/p1-unity-ux-recovery` — insurance, nothing else
2. Point a PR at the recovery branch, or retarget #22
3. Check out the recovery branch so a build matches a commit
4. Build WebGL from **that** branch, per `RUNBOOK-SHIP-A-UNITY-BUILD.md`
5. Separately, and not tonight: SmartMerge, so this stops recurring

Steps 1 through 4 are mechanical. Step 5 is the one that stops this document
being written again next week.

## Lane note

Read-only. Nothing in `SAL0MANDER-Puzzle-Prototype` was created, modified, or
deleted, and no branch was pushed from the web lane. Every recommendation above
is for Codex to execute or reject.

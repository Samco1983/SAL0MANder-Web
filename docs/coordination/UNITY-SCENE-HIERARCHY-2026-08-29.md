# Unity scene hierarchy — SampleScene.unity (2026-08-29)

Reconstructed from `Assets/Scenes/SampleScene.unity` in the Unity repo
(`/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype`, 40,363 lines of YAML) by
resolving `m_Father` / `m_Children` transform links and mapping MonoBehaviour
GUIDs back to `.cs` files. Read-only observation of Codex's repo. Nothing was
written there.

This fills in section 5 of the C# inspection doc that was pasted into the web
session truncated at the heading.

## Headline for the web side

**The scene is not the surface map.** 268 GameObjects, 8 roots, and every
route-level controller the web wrapper cares about is absent from the scene —
because it is composed at runtime, not authored. See "Verification" below.

## Roots (8)

```
- Canvas                <Canvas, CanvasScaler, GraphicRaycaster, PuzzleOptionsUI>
- Main Camera           <Camera, AudioListener>
- ActivityManager       <ActivityManager>
- QuizManager           <QuizManager>
- EventSystem           <EventSystem, StandaloneInputModule>
- GlowLineTrace         <LineRenderer>
- PuzzleManager         <PuzzleManager, AudioSource>
- PlayArea
```

Only five project scripts are scene-authored: `PuzzleOptionsUI`,
`PuzzleManager`, `QuizManager`, `ActivityManager`, `PuzzlePiece` (+ nine
`DockSlotUI` instances nested in the dock).

## Canvas → SafeAreaContainer (15 children)

`[off]` = `m_IsActive: 0` in the saved scene.

```
- Canvas <PuzzleOptionsUI>
  - SafeAreaContainer
    - ProgressText                [off]
    - HUD_BottomBar
    - BottomBarContainer          [off]
      - CorrectAnswerButton / UndoButton / ResetButton
    - BottomBarToggleButton       [off]
    - HeaderBanner
      - TitleText / HeaderHudRow / NavTabRow / NavCollapseHandle
    - DesktopHudBar               [off]
      - HudText
    - QuizDrawer                  [off]
      - QuizDrawerHandle / QuizScrollView
    - HorizontalDockDrawer
      - TrayDrawerHandle / HorizontalDockScrollView (9x PieceDockSlot_N <DockSlotUI>)
    - SettingsModal               [off]
      - SettingsDialogCard
    - CompactActionsBar
      - Release_Button / Undo_Button / Reset_Button
    - AuthoringWorkspace          [off]
      - AuthoringTopBar / AuthoringSplitArea
    - ActivitiesWorkspace         [off]
      - Viewport
    - ActivityReportWorkspace     [off]
      - Viewport
    - CompletionModal             [off]
      - DialogCard
    - UnhideUiFloatingContainer   [off]
      - SHOW OVERLAYS_Button
```

The four `*Workspace` / modal nodes are the authored shells that
`QuestionEditorUI`, `TeacherStudioUI`, and `ReportsUI` attach to at runtime.

## PlayArea

```
- PlayArea
  - SpawnDock
    - DockVisual                  [off]
  - ActivePieceHolder             (drag-time reparent target, raises sort order)
  - PuzzleBoard
    - BoardSilhouette
    - SnapTargets
      - SnapTarget_1 … SnapTarget_9
    - StaticBoardBorder
      - OuterShadow / InnerShadow / BaseBorder / TopLeftHighlight / BottomRightShadow
  - PuzzlePiece_1 … PuzzlePiece_9   [all off]  <SpriteRenderer, PolygonCollider2D, PuzzlePiece>
```

Nine is the authored maximum. The 4/6/12/16 piece counts named in the
inspection doc are cut procedurally by `PuzzleManager` — the scene only carries
the 9-piece rig.

## Verification of the pasted inspection doc

All 22 scripts named in section 4 exist at the stated paths. Line counts match
exactly except three off-by-one (`CozyHaptics` 29 not 30, `DockSlotUI` 243 not
244, `Sal0manderUIStyle` 289 not 290) — trailing-newline counting, not drift.
Total project + editor C# is 15,011 lines including the 31-line `.jslib`.

Nine scripts have **zero** scene instances:

| Script | How it actually gets created |
| --- | --- |
| `SAL0MANderBridge` | self-bootstraps, `[RuntimeInitializeOnLoadMethod(BeforeSceneLoad)]` → `EnsureInstance()` → `DontDestroyOnLoad` |
| `SessionContext` | `[RuntimeInitializeOnLoadMethod(SubsystemRegistration)]` |
| `AppNavigationController` | `AddComponent` from `PuzzleOptionsUI` |
| `StudentPlayUI`, `TeacherStudioUI`, `QuestionEditorUI`, `ReportsUI`, `DeveloperOverlayUI` | `AddComponent` from `PuzzleOptionsUI` |
| `RotationGizmo` | `AddComponent` from `PuzzleManager` / `DockSlotUI` |
| `DockSlotDragHandler` | `AddComponent` from `PuzzleOptionsUI` |

`Sal0manderUIStyle`, `UIModalUtility`, `Sal0manderMathRenderer`, `CozyHaptics`
are static helpers and correctly have no scene presence.

**No defect.** An "empty scene" reading here would be a false alarm: the bridge
the web wrapper posts to is created before the scene loads and survives scene
changes, so it is live in a real WebGL build regardless of what the scene
contains.

## What this means for web work

1. Do not derive the web-side surface map from the scene. `PuzzleOptionsUI`
   (4,546 lines) is the real view tree; the scene is a thin authored shell.
2. The bridge contract is reachable from the first frame — `BeforeSceneLoad`
   ordering means a host `postMessage` sent immediately after
   `UnityInstance` creation has a receiver.
3. Inbound `ReceiveWebMessage` has **no** route guard — it validates JSON,
   checks `contractVersion` against `ContractVersion`, de-dupes on `eventId`,
   then dispatches `boot` / `session-started` (`set-paused` is accepted and
   deliberately ignored: "Unity remains gameplay authority"). A version
   mismatch replies `contract-mismatch` rather than failing silently, so the
   web wrapper can send launch config as early as it likes.
4. The route guard that does exist is in `Update()`, gating only the outbound
   `session-finished` emission: it waits for `CurrentRoute == StudentPlay`,
   `isGameStarted`, and `IsPuzzleComplete()`, and fires once
   (`completionEmitted`). So completion telemetry never arrives from the
   authoring or reports routes.

import type { GuestActivityBundle, PlayBundle } from '@contracts/v1'

/**
 * Wire `PlayBundle` → the app's internal `GuestActivityBundle`.
 *
 * Codex's D-004 asks for exactly this: public DTOs are adapters, and each
 * client maps them rather than adopting the wire shape as its model. Keeping
 * the seam means the UI does not move when the contract does — and the contract
 * is explicitly not frozen.
 *
 * The gameplay body is passed through **untouched and uninterpreted**. The web
 * platform stores, versions, and hands it to Unity; it does not read puzzle
 * rules, so it cannot fork them (D-004 here, and the same intent as Codex's
 * D-003 keeping the gameplay loop in Unity).
 */
export function toGuestActivityBundle(play: PlayBundle): GuestActivityBundle {
  return {
    summary: {
      id: play.activityId,
      title: play.title,
      description: play.description,
      // Our internal model still carries a single mode. `allowedPlayModes` is
      // the richer truth; until the UI needs to offer a choice, the default is
      // the honest projection of it.
      mode: play.defaultPlayMode,
      thumbnail: null,
      ...(play.authorDisplayName ? { authorDisplayName: play.authorDisplayName } : {}),
    },
    version: {
      id: play.activityVersionId,
      activityId: play.activityId,
      versionNumber: play.versionNumber,
      payload: {
        schemaVersion: 1,
        // Opaque on purpose. Everything Unity needs to run the activity, in
        // one blob the web layer never inspects.
        body: {
          allowedPlayModes: play.allowedPlayModes,
          defaultPlayMode: play.defaultPlayMode,
          puzzle: play.puzzle,
          quiz: play.quiz,
        },
      },
      media: [
        {
          id: play.puzzleAsset.assetId,
          kind: 'puzzle-image',
          url: play.puzzleAsset.downloadUrl,
          contentType: play.puzzleAsset.contentType,
          byteSize: play.puzzleAsset.byteSize,
          width: play.puzzleAsset.width,
          height: play.puzzleAsset.height,
          // `assetId + checksum` is the durable cache identity; the URL is
          // transport and may rotate (D-007).
          checksum: `${play.puzzleAsset.checksum.algorithm}:${play.puzzleAsset.checksum.value}`,
          createdAt: new Date(0).toISOString(),
        },
      ],
      createdAt: new Date(0).toISOString(),
    },
  }
}

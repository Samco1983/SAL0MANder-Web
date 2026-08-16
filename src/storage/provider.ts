import type { MediaDescriptor, MediaKind } from '@contracts/v1'

/**
 * Media storage boundary.
 *
 * Images are the heaviest thing SAL0MANder moves. The intended production shape
 * is: client asks the API for a signed upload URL → client PUTs bytes directly
 * to object storage → CDN serves them. Bytes never pass through the application
 * tier, which is what keeps the API stateless and cheap at 100k+ users.
 *
 * No provider is chosen yet. This interface is what a provider must satisfy;
 * `memory` is the local stand-in so the rest of the app can be built now.
 */

export type UploadProgress = { loaded: number; total: number }

export type UploadInput = {
  file: Blob
  kind: MediaKind
  fileName?: string
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

export interface MediaStorage {
  readonly name: string
  /** Upload bytes and return the descriptor the contract expects. */
  upload(input: UploadInput): Promise<MediaDescriptor>
  /** Resolve a stored media id to a servable URL (CDN in production). */
  resolveUrl(descriptor: MediaDescriptor): string
  /** Best-effort delete. Providers may make this a soft delete. */
  remove(mediaId: string): Promise<void>
}

/** Guard rails that apply regardless of provider. */
export const MEDIA_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'],
} as const

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaValidationError'
  }
}

export function assertUploadable(file: Blob): void {
  if (file.size > MEDIA_LIMITS.maxBytes) {
    throw new MediaValidationError(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MEDIA_LIMITS.maxBytes / 1024 / 1024} MB.`,
    )
  }
  if (!(MEDIA_LIMITS.allowedTypes as readonly string[]).includes(file.type)) {
    throw new MediaValidationError(`Unsupported file type: ${file.type || 'unknown'}.`)
  }
}

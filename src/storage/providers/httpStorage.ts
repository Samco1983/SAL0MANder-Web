import { MediaDescriptorSchema, UploadIntentSchema, type MediaDescriptor } from '@contracts/v1'
import type { Transport } from '@api/transport'
import { assertUploadable, type MediaStorage, type UploadInput } from '../provider'

/**
 * Signed-URL storage: the intended production shape.
 *
 * 1. Ask the API for an upload intent (short-lived signed URL).
 * 2. PUT the bytes straight to object storage — never through our API.
 * 3. Finalize, and the API returns a CDN-backed descriptor.
 *
 * NOT WIRED UP YET: no storage provider has been chosen or approved. This file
 * documents and type-checks the flow so adopting a provider is a config change
 * plus a backend implementation, not an app refactor.
 */
export function createHttpStorage(transport: Transport, cdnBaseUrl: string): MediaStorage {
  return {
    name: 'http',

    async upload({ file, kind, signal }: UploadInput): Promise<MediaDescriptor> {
      assertUploadable(file)

      const intent = await transport.request(
        {
          method: 'POST',
          path: '/media/upload-intent',
          body: { kind, contentType: file.type, byteSize: file.size },
          ...(signal ? { signal } : {}),
        },
        UploadIntentSchema,
      )

      const put = await fetch(intent.uploadUrl, {
        method: intent.method,
        headers: { 'Content-Type': file.type, ...intent.headers },
        body: file,
        ...(signal ? { signal } : {}),
      })
      if (!put.ok) {
        throw new Error(`Upload failed with status ${put.status}`)
      }

      return transport.request(
        {
          method: 'POST',
          path: `/media/${encodeURIComponent(intent.mediaId)}/finalize`,
          idempotencyKey: intent.mediaId,
          ...(signal ? { signal } : {}),
        },
        MediaDescriptorSchema,
      )
    },

    resolveUrl(descriptor) {
      if (!cdnBaseUrl || /^https?:\/\//.test(descriptor.url)) return descriptor.url
      return `${cdnBaseUrl.replace(/\/+$/, '')}/${descriptor.url.replace(/^\/+/, '')}`
    },

    async remove(mediaId) {
      await transport.request(
        { method: 'DELETE', path: `/media/${encodeURIComponent(mediaId)}` },
        MediaDescriptorSchema.optional(),
      )
    },
  }
}

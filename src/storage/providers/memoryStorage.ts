import { newId, type MediaDescriptor } from '@contracts/v1'
import { assertUploadable, type MediaStorage, type UploadInput } from '../provider'

/**
 * Local-only storage backed by object URLs. Nothing leaves the browser and
 * nothing survives a reload — this exists purely so upload-shaped UI can be
 * built and tested before a storage provider is chosen.
 */
export function createMemoryStorage(): MediaStorage {
  const objectUrls = new Map<string, string>()

  return {
    name: 'memory',

    async upload({ file, kind, onProgress }: UploadInput): Promise<MediaDescriptor> {
      assertUploadable(file)
      onProgress?.({ loaded: file.size, total: file.size })

      const id = newId()
      const url = URL.createObjectURL(file)
      objectUrls.set(id, url)

      return {
        id: id as MediaDescriptor['id'],
        kind,
        url,
        contentType: file.type,
        byteSize: file.size,
        createdAt: new Date().toISOString(),
      }
    },

    resolveUrl(descriptor) {
      return descriptor.url
    },

    async remove(mediaId) {
      const url = objectUrls.get(mediaId)
      if (url) {
        URL.revokeObjectURL(url)
        objectUrls.delete(mediaId)
      }
    },
  }
}

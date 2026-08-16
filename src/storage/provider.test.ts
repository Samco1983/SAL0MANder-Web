import { describe, expect, it } from 'vitest'
import { MEDIA_LIMITS, MediaValidationError, assertUploadable } from './provider'

/**
 * The upload guard is the only thing between a teacher and a 40 MB camera
 * photo, so it is worth pinning precisely — including the boundary, which is
 * where an off-by-one would let the limit be exceeded by exactly one byte.
 */

function blob(bytes: number, type: string): Blob {
  return { size: bytes, type } as Blob
}

const MB = 1024 * 1024

describe('assertUploadable size limit', () => {
  it('accepts a file at exactly the limit', () => {
    expect(() => assertUploadable(blob(MEDIA_LIMITS.maxBytes, 'image/png'))).not.toThrow()
  })

  it('rejects a file one byte over the limit', () => {
    expect(() => assertUploadable(blob(MEDIA_LIMITS.maxBytes + 1, 'image/png'))).toThrow(
      MediaValidationError,
    )
  })

  it('names the actual size and the limit, so the teacher can act on it', () => {
    try {
      assertUploadable(blob(40 * MB, 'image/png'))
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(MediaValidationError)
      expect((error as Error).message).toContain('40.0 MB')
      expect((error as Error).message).toContain('15 MB')
    }
  })

  it('accepts an empty file rather than treating 0 as falsy', () => {
    expect(() => assertUploadable(blob(0, 'image/png'))).not.toThrow()
  })
})

describe('assertUploadable type allowlist', () => {
  it('accepts every declared image type', () => {
    for (const type of MEDIA_LIMITS.allowedTypes) {
      expect(() => assertUploadable(blob(1024, type))).not.toThrow()
    }
  })

  it('rejects a non-image upload', () => {
    expect(() => assertUploadable(blob(1024, 'application/pdf'))).toThrow(MediaValidationError)
  })

  it('rejects a file whose type the browser could not determine', () => {
    // Some browsers report '' for unrecognized files; that must not pass.
    expect(() => assertUploadable(blob(1024, ''))).toThrow(/unknown/i)
  })

  it('checks size before type, so an oversized PDF reports the size problem', () => {
    expect(() => assertUploadable(blob(40 * MB, 'application/pdf'))).toThrow(/MB/)
  })
})

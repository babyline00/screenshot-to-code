import { test, expect, describe } from 'bun:test'
import {
  validateImage,
  saveImage,
  extensionFor,
  type ImageLike,
} from '../image-handler'

describe('validateImage', () => {
  test('accepts png by MIME type', () => {
    expect(validateImage({ type: 'image/png', name: 'foo' })).toBe(true)
  })
  test('accepts jpeg by MIME type', () => {
    expect(validateImage({ type: 'image/jpeg', name: 'foo' })).toBe(true)
  })
  test('accepts webp by MIME type', () => {
    expect(validateImage({ type: 'image/webp', name: 'foo' })).toBe(true)
  })
  test('rejects gif', () => {
    expect(validateImage({ type: 'image/gif', name: 'foo.gif' })).toBe(false)
  })
  test('rejects pdf', () => {
    expect(validateImage({ type: 'application/pdf', name: 'foo.pdf' })).toBe(false)
  })
  test('rejects empty / null', () => {
    expect(validateImage({} as ImageLike)).toBe(false)
    // @ts-expect-error — deliberately passing null
    expect(validateImage(null)).toBe(false)
  })
  test('falls back to extension when type is empty', () => {
    expect(validateImage({ type: '', name: 'foo.png' })).toBe(true)
    expect(validateImage({ type: '', name: 'foo.webp' })).toBe(true)
    expect(validateImage({ type: '', name: 'foo.bmp' })).toBe(false)
  })
  test('accepts .jpg and .jpeg extension fallback', () => {
    expect(validateImage({ type: '', name: 'foo.jpg' })).toBe(true)
    expect(validateImage({ type: '', name: 'foo.jpeg' })).toBe(true)
  })
})

describe('extensionFor', () => {
  test('maps png', () => {
    expect(extensionFor({ type: 'image/png', name: 'foo' })).toBe('png')
  })
  test('maps jpeg to jpg', () => {
    expect(extensionFor({ type: 'image/jpeg', name: 'foo' })).toBe('jpg')
  })
  test('maps webp', () => {
    expect(extensionFor({ type: 'image/webp', name: 'foo' })).toBe('webp')
  })
  test('falls back to extension from name', () => {
    expect(extensionFor({ type: '', name: 'foo.webp' })).toBe('webp')
    expect(extensionFor({ type: '', name: 'foo.JPEG' })).toBe('jpg')
  })
  test('falls back to png when nothing is recognized', () => {
    expect(extensionFor({ type: '', name: 'foo' })).toBe('png')
  })
})

describe('saveImage', () => {
  test('writes to uploads/<uuid>.<ext> and returns the path', async () => {
    const written: { path: string; data: Uint8Array }[] = []
    const mkdirCalls: string[] = []
    const fakeFile = {
      type: 'image/png',
      name: 'screenshot.png',
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    }
    const result = await saveImage(fakeFile as unknown as File, {
      publicDir: '/tmp/public',
      uuid: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      mkdir: async (p) => {
        mkdirCalls.push(p)
      },
      writer: async (path, data) => {
        written.push({ path, data })
      },
    })
    expect(result.uuid).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(result.path).toBe('uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png')
    expect(result.absPath).toBe(
      '/tmp/public/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png',
    )
    expect(result.bytes).toBe(4)
    expect(written.length).toBe(1)
    expect(written[0].path).toBe(result.absPath)
    expect(Array.from(written[0].data)).toEqual([1, 2, 3, 4])
    // The directory should have been mkdir'd.
    expect(mkdirCalls).toContain('/tmp/public/uploads')
  })

  test('throws on unsupported image type', async () => {
    const fakeFile = {
      type: 'image/gif',
      name: 'foo.gif',
    }
    let err: Error | null = null
    try {
      await saveImage(fakeFile as unknown as File, {
        publicDir: '/tmp/public',
        uuid: () => 'never',
      })
    } catch (e) {
      err = e as Error
    }
    expect(err).not.toBeNull()
    expect(err!.message).toContain('Unsupported image type')
  })

  test('uses the webp extension when the MIME is webp', async () => {
    const fakeFile = {
      type: 'image/webp',
      name: 'shot.webp',
      arrayBuffer: async () => new Uint8Array([0]).buffer,
    }
    const result = await saveImage(fakeFile as unknown as File, {
      publicDir: '/tmp/public',
      uuid: () => 'webp-uuid',
      mkdir: async () => {},
      writer: async () => {},
    })
    expect(result.path.endsWith('.webp')).toBe(true)
    expect(result.path).toBe('uploads/webp-uuid.webp')
  })

  test('uses the jpg extension when the MIME is jpeg', async () => {
    const fakeFile = {
      type: 'image/jpeg',
      name: 'shot.jpg',
      arrayBuffer: async () => new Uint8Array([0]).buffer,
    }
    const result = await saveImage(fakeFile as unknown as File, {
      publicDir: '/tmp/public',
      uuid: () => 'jpg-uuid',
      mkdir: async () => {},
      writer: async () => {},
    })
    expect(result.path).toBe('uploads/jpg-uuid.jpg')
  })

  test('skips reading bytes when arrayBuffer is missing (test stub)', async () => {
    const fakeFile = {
      type: 'image/png',
      name: 'shot.png',
    }
    const result = await saveImage(fakeFile as unknown as File, {
      publicDir: '/tmp/public',
      uuid: () => 'no-bytes',
      mkdir: async () => {},
      writer: async () => {},
    })
    expect(result.bytes).toBe(0)
    expect(result.path).toBe('uploads/no-bytes.png')
  })
})

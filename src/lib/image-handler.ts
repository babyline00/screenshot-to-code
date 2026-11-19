/**
 * Image handling for screenshot uploads.
 *
 * Two pure-ish helpers:
 *
 *   - `validateImage(file)` — accepts a File-like object (anything with `.type`
 *     and `.name`), returns `true` for png/jpg/jpeg/webp. Used both client-side
 *     (for instant drop-zone feedback) and server-side (before we spend the
 *     cycles to read the buffer).
 *
 *   - `saveImage(file, opts)` — server-only. Generates a UUID, picks an
 *     extension from the content-type, writes the bytes to
 *     `<publicDir>/uploads/<uuid>.<ext>`, and returns the public-relative
 *     path + the uuid. The publicDir defaults to `<cwd>/public` but is
 *     injectable for tests so we never touch the real disk in unit tests.
 *
 * The path naming convention is enforced both here and in unit tests so a
 * screenshot saved as a `.png` always ends up at `uploads/<uuid>.png` and
 * a `.webp` at `uploads/<uuid>.webp` — no surprises.
 */

import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { join, extname } from 'path'

export interface ImageLike {
  type: string
  name: string
  size?: number
}

const ACCEPTED = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

export function validateImage(file: ImageLike): boolean {
  if (!file || typeof file !== 'object') return false
  const t = (file.type || '').toLowerCase()
  if (ACCEPTED.has(t)) return true
  // Some browsers / multipart parsers leave `type` empty and only put the
  // extension on the name. Fall back to the extension.
  const ext = extname(file.name || '').toLowerCase()
  return (
    ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp'
  )
}

/** Map a MIME type to a file extension, falling back to the original name's extension. */
export function extensionFor(file: ImageLike): string {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/png') return 'png'
  if (t === 'image/jpeg' || t === 'image/jpg') return 'jpg'
  if (t === 'image/webp') return 'webp'
  const ext = extname(file.name || '').toLowerCase()
  if (ext === '.png') return 'png'
  if (ext === '.jpg' || ext === '.jpeg') return 'jpg'
  if (ext === '.webp') return 'webp'
  // Last-ditch default — most screenshots are PNG.
  return 'png'
}

export interface SaveImageResult {
  /** Public-relative path (e.g. `uploads/abc-123.png`) — suitable for an <img src>. */
  path: string
  /** Absolute path on disk. */
  absPath: string
  /** The UUID used for the filename (without extension). */
  uuid: string
  /** Bytes written. */
  bytes: number
}

export interface SaveImageOptions {
  /** Absolute path to the public/ dir. Defaults to `<cwd>/public`. */
  publicDir?: string
  /** Inject a UUID generator (tests use this for determinism). */
  uuid?: () => string
  /** Inject the fs writer (tests use this to avoid touching disk). */
  writer?: (path: string, data: Uint8Array) => Promise<void>
  /** Inject mkdir (tests use this to avoid touching disk). */
  mkdir?: (path: string, opts?: { recursive?: boolean }) => Promise<void>
}

export async function saveImage(
  file: ImageLike & { arrayBuffer?: () => Promise<ArrayBuffer> },
  opts: SaveImageOptions = {},
): Promise<SaveImageResult> {
  if (!validateImage(file)) {
    throw new Error(`Unsupported image type: ${file.type || file.name}`)
  }
  const publicDir = opts.publicDir ?? join(process.cwd(), 'public')
  const uploadsDir = join(publicDir, 'uploads')
  const uuid = (opts.uuid ?? randomUUID)()
  const ext = extensionFor(file)
  const filename = `${uuid}.${ext}`
  const absPath = join(uploadsDir, filename)

  // Read bytes. In the test environment we may pass a stub `file` without
  // `arrayBuffer()` — the test injects the bytes via the writer, so skip
  // the read when the file has no arrayBuffer method.
  let data: Uint8Array
  if (typeof file.arrayBuffer === 'function') {
    const buf = await file.arrayBuffer()
    data = new Uint8Array(buf)
  } else {
    data = new Uint8Array(0)
  }

  const mkdirFn = opts.mkdir ?? mkdir
  await mkdirFn(uploadsDir, { recursive: true })
  const writeFn = opts.writer ?? (async (p: string, d: Uint8Array) => {
    await writeFile(p, d)
  })
  await writeFn(absPath, data)

  return {
    path: `uploads/${filename}`,
    absPath,
    uuid,
    bytes: data.byteLength,
  }
}

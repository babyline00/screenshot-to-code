import { test, expect, describe } from 'bun:test'
import {
  buildDataUrl,
  getVisionProvider,
  __setVisionProviderForTest,
  type VisionProvider,
} from '../ai'
import { buildVisionSystemPrompt } from '../vision-prompt'
import { cleanLlmResponse } from '../code-cleaner'

describe('MockProvider (default when PKC_DISABLE_LLM=1)', () => {
  test('returns a deterministic vision response', async () => {
    // Force the mock provider for this test.
    process.env.PKC_DISABLE_LLM = '1'
    __setVisionProviderForTest(null)
    const provider = getVisionProvider()
    const out = await provider.complete({
      systemPrompt: 'sys',
      image: { dataUrl: 'data:image/png;base64,', mimeType: 'image/png' },
    })
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(50)
    // The mock returns a React + Tailwind component — assert on a Tailwind
    // class name that's present in the mock output, since "tailwind" as a
    // literal word doesn't appear in the JSX.
    expect(out).toContain('const GeneratedComponent = () =>')
    expect(out).toContain('bg-gray-50')
    expect(out).toContain('export default GeneratedComponent;')
    process.env.PKC_DISABLE_LLM = '0'
    __setVisionProviderForTest(null)
  })

  test('mock response is the same on every call', async () => {
    process.env.PKC_DISABLE_LLM = '1'
    __setVisionProviderForTest(null)
    const p1 = getVisionProvider()
    const a = await p1.complete({
      systemPrompt: 'sys',
      image: { dataUrl: '', mimeType: 'image/png' },
    })
    const b = await p1.complete({
      systemPrompt: 'sys',
      image: { dataUrl: '', mimeType: 'image/png' },
    })
    expect(a).toBe(b)
    process.env.PKC_DISABLE_LLM = '0'
    __setVisionProviderForTest(null)
  })
})

describe('VisionProvider interface (custom mock)', () => {
  class FixedMock implements VisionProvider {
    async complete(args: {
      systemPrompt: string
      image: { dataUrl: string; mimeType: string }
    }): Promise<string> {
      void args
      return [
        'const FixedMock = () => {',
        '  return <div className="p-6">Fixed mock output</div>;',
        '};',
        'export default FixedMock;',
      ].join('\n')
    }
  }

  test('the conversion flow: prompt + mock -> clean -> returns code', async () => {
    __setVisionProviderForTest(new FixedMock())
    const provider = getVisionProvider()
    const sys = buildVisionSystemPrompt('FixedMock')
    const raw = await provider.complete({
      systemPrompt: sys,
      image: { dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png' },
    })
    const cleaned = cleanLlmResponse(raw)
    expect(cleaned.startsWith('const FixedMock')).toBe(true)
    expect(cleaned.trim().endsWith('export default FixedMock;')).toBe(true)
    expect(cleaned).toContain('Fixed mock output')
    __setVisionProviderForTest(null)
  })

  test('cached provider is reused across getVisionProvider() calls', () => {
    __setVisionProviderForTest(new FixedMock())
    const a = getVisionProvider()
    const b = getVisionProvider()
    expect(a).toBe(b)
    __setVisionProviderForTest(null)
  })
})

describe('buildDataUrl', () => {
  test('returns a data URL with the correct mime prefix', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    const url = buildDataUrl(bytes, 'image/jpeg')
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  test('encodes bytes accurately (round-trip via atob)', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 255])
    const url = buildDataUrl(bytes, 'image/png')
    const b64 = url.slice('data:image/png;base64,'.length)
    // Decode and verify.
    let decoded: string
    if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(b64, 'base64').toString('binary')
    } else {
      decoded = atob(b64)
    }
    const out = Array.from(decoded).map((c) => c.charCodeAt(0))
    expect(out).toEqual([1, 2, 3, 250, 255])
  })

  test('works for png and webp mime types', () => {
    const bytes = new Uint8Array([0, 1, 2])
    expect(buildDataUrl(bytes, 'image/png').startsWith('data:image/png;base64,')).toBe(true)
    expect(buildDataUrl(bytes, 'image/webp').startsWith('data:image/webp;base64,')).toBe(true)
  })

  test('handles an empty byte array', () => {
    const bytes = new Uint8Array(0)
    const url = buildDataUrl(bytes, 'image/png')
    expect(url).toBe('data:image/png;base64,')
  })

  test('handles a large-ish byte array (>8KB) without choking', () => {
    const bytes = new Uint8Array(20000)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256
    const url = buildDataUrl(bytes, 'image/png')
    expect(url.length).toBeGreaterThan(25000)
  })
})

describe('getVisionProvider', () => {
  test('returns the cached provider when set', () => {
    class Dummy implements VisionProvider {
      async complete(): Promise<string> {
        return ''
      }
    }
    const d = new Dummy()
    __setVisionProviderForTest(d)
    expect(getVisionProvider()).toBe(d)
    __setVisionProviderForTest(null)
  })

  test('falls back to MockProvider when PKC_DISABLE_LLM=1', () => {
    process.env.PKC_DISABLE_LLM = '1'
    __setVisionProviderForTest(null)
    const p = getVisionProvider()
    expect(p).toBeDefined()
    process.env.PKC_DISABLE_LLM = '0'
    __setVisionProviderForTest(null)
  })
})

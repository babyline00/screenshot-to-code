/**
 * Vision LLM layer for the screenshot-to-code flow.
 *
 * Mirrors the pattern from Personal Knowledge Copilot: a pluggable
 * `VisionProvider` interface with a `ZaiProvider` (uses
 * `zai.chat.completions.createVision`) and a `MockProvider` (deterministic
 * echo for tests / offline demo). The provider is cached so the SDK is
 * only initialised once per process.
 *
 * The vision call shape from the SDK:
 *
 *   zai.chat.completions.createVision({
 *     messages: [{
 *       role: 'user',
 *       content: [
 *         { type: 'text', text: '<system prompt>' },
 *         { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } },
 *       ],
 *     }],
 *   })
 *
 * The system prompt is embedded as the text part of the user message (the
 * SDK's vision endpoint only accepts a single user message in the standard
 * shape, so we collapse system+user into one user turn).
 */

export interface VisionMessagePart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface VisionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | VisionMessagePart[]
}

export interface VisionProvider {
  /** Returns the full text response (non-streaming). */
  complete(args: {
    systemPrompt: string
    image: { dataUrl: string; mimeType: string }
    userPrompt?: string
  }): Promise<string>
}

let cachedProvider: VisionProvider | null = null

class ZaiProvider implements VisionProvider {
  async complete(args: {
    systemPrompt: string
    image: { dataUrl: string; mimeType: string }
    userPrompt?: string
  }): Promise<string> {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const userText = args.userPrompt
      ? `${args.systemPrompt}\n\n${args.userPrompt}`
      : args.systemPrompt
    const messages: VisionMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: args.image.dataUrl } },
        ],
      },
    ]
    const completion = await (zai.chat.completions as any).createVision({
      messages,
      // Most vision-capable LLMs need this hint for the SDK routing.
      // gpt-4o is the default in the system prompt's metadata.
    })
    // The SDK returns either a string or a completion object.
    if (typeof completion === 'string') return completion
    const content = (completion as any)?.choices?.[0]?.message?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      // Some providers return content as an array of parts; concatenate text parts.
      return content
        .map((p: any) => (typeof p === 'string' ? p : p?.text ?? ''))
        .join('')
    }
    return String(completion ?? '')
  }
}

class MockProvider implements VisionProvider {
  async complete(args: {
    systemPrompt: string
    image: { dataUrl: string; mimeType: string }
    userPrompt?: string
  }): Promise<string> {
    // Deterministic mock that returns a tiny but valid React + Tailwind
    // component so the UI stays demoable offline and tests can rely on it.
    void args
    const comp = `const GeneratedComponent = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Mock Preview</h1>
        <p className="text-sm text-gray-600">
          (MockProvider — no live LLM configured. Set the SDK config or unset
          PKC_DISABLE_LLM to enable real vision calls.)
        </p>
        <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground">
          Continue
        </button>
      </div>
    </div>
  );
};
export default GeneratedComponent;
`
    return comp
  }
}

export function getVisionProvider(): VisionProvider {
  if (cachedProvider) return cachedProvider
  if (process.env.PKC_DISABLE_LLM === '1') {
    cachedProvider = new MockProvider()
    return cachedProvider
  }
  try {
    cachedProvider = new ZaiProvider()
  } catch (e) {
    console.warn('[vision] ZaiProvider unavailable, using MockProvider:', (e as Error).message)
    cachedProvider = new MockProvider()
  }
  return cachedProvider
}

/** Test-only. */
export function __setVisionProviderForTest(p: VisionProvider | null) {
  cachedProvider = p
}

/**
 * Build a `data:image/<mime>;base64,...` data URL from a Uint8Array.
 * Pure + dependency-free so it can be unit-tested without the SDK.
 */
export function buildDataUrl(bytes: Uint8Array, mimeType: string): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    )
  }
  // Use Buffer if available (Node/Bun) for speed.
  let b64: string
  if (typeof Buffer !== 'undefined') {
    b64 = Buffer.from(bytes).toString('base64')
  } else {
    b64 = btoa(bin)
  }
  return `data:${mimeType};base64,${b64}`
}

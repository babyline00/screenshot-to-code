import { NextRequest, NextResponse } from 'next/server'
import { buildPreviewHtml } from '@/lib/preview-builder'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const code = typeof body?.code === 'string' ? body.code : ''
    if (!code.trim()) {
      return NextResponse.json(
        { error: "Body must include a non-empty 'code' string." },
        { status: 400 },
      )
    }
    const html = buildPreviewHtml(code)
    return NextResponse.json({ html })
  } catch (e) {
    console.error('[preview] error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'Internal error' },
      { status: 500 },
    )
  }
}

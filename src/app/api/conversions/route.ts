import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await db.conversion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        screenshotPath: r.screenshotPath,
        prompt: r.prompt,
        generatedCode: r.generatedCode,
        editedCode: r.editedCode,
        componentName: r.componentName,
        model: r.model,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    )
  } catch (e) {
    console.error('[conversions/list] error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'Internal error' },
      { status: 500 },
    )
  }
}

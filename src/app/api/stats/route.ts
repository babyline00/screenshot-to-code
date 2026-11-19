import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const conversions = await db.conversion.count()
    const withEdits = await db.conversion.count({
      where: { editedCode: { not: null } },
    })
    let lastCreatedAt: string | null = null
    const last = await db.conversion.findFirst({ orderBy: { createdAt: 'desc' } })
    if (last) lastCreatedAt = last.createdAt.toISOString()
    return NextResponse.json({
      conversions,
      withEdits,
      lastCreatedAt,
    })
  } catch (e) {
    console.error('[stats] error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'Internal error' },
      { status: 500 },
    )
  }
}

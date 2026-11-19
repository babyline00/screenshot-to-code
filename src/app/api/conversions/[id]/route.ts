import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const row = await db.conversion.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({
      id: row.id,
      screenshotPath: row.screenshotPath,
      prompt: row.prompt,
      generatedCode: row.generatedCode,
      editedCode: row.editedCode,
      componentName: row.componentName,
      model: row.model,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error('[conversions/get] error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'Internal error' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const data: { editedCode?: string; componentName?: string } = {}
    if (typeof body.editedCode === 'string') data.editedCode = body.editedCode
    if (typeof body.componentName === 'string') data.componentName = body.componentName
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'Body must include editedCode and/or componentName.' },
        { status: 400 },
      )
    }
    const row = await db.conversion.update({ where: { id }, data })
    return NextResponse.json({
      id: row.id,
      screenshotPath: row.screenshotPath,
      prompt: row.prompt,
      generatedCode: row.generatedCode,
      editedCode: row.editedCode,
      componentName: row.componentName,
      model: row.model,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error('[conversions/patch] error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'Internal error' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    // Read the row first so we can also unlink the screenshot file.
    const row = await db.conversion.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await db.conversion.delete({ where: { id } })
    // Best-effort: delete the screenshot file from disk.
    try {
      const { unlink } = await import('fs/promises')
      const { join } = await import('path')
      const abs = join(process.cwd(), 'public', row.screenshotPath)
      await unlink(abs)
    } catch (e) {
      // File may already be gone — log and move on.
      console.warn('[conversions/delete] could not unlink screenshot file:', e)
    }
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error('[conversions/delete] error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'Internal error' },
      { status: 500 },
    )
  }
}

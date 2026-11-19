import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { saveImage, validateImage } from '@/lib/image-handler'
import { buildVisionSystemPrompt } from '@/lib/vision-prompt'
import { cleanLlmResponse } from '@/lib/code-cleaner'
import { getVisionProvider, buildDataUrl } from '@/lib/ai'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('screenshot')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing 'screenshot' file in multipart body." },
        { status: 400 },
      )
    }
    if (!validateImage({ type: file.type, name: file.name })) {
      return NextResponse.json(
        { error: `Unsupported image type: ${file.type || file.name}. Allowed: png, jpg, webp.` },
        { status: 415 },
      )
    }

    // Persist the image to public/uploads/<uuid>.<ext>.
    const saved = await saveImage(file)

    // Read the bytes (we need them for the data URL).
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    // Derive the MIME type from the extension so the data URL is correct
    // even when the browser left file.type empty.
    const ext = saved.path.split('.').pop()!.toLowerCase()
    const mimeType =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
        ? 'image/webp'
        : 'image/jpeg'
    const dataUrl = buildDataUrl(bytes, mimeType)

    // Build the system prompt + call the vision LLM.
    const componentName = 'GeneratedComponent'
    const systemPrompt = buildVisionSystemPrompt(componentName)
    const model = process.env.LLM_MODEL || 'gpt-4o'

    const provider = getVisionProvider()
    let raw: string
    try {
      raw = await provider.complete({
        systemPrompt,
        image: { dataUrl, mimeType },
      })
    } catch (e) {
      console.error('[convert] vision call failed:', e)
      return NextResponse.json(
        { error: `Vision LLM call failed: ${(e as Error).message}` },
        { status: 502 },
      )
    }

    const generatedCode = cleanLlmResponse(raw)
    if (!generatedCode.trim()) {
      return NextResponse.json(
        { error: 'Vision LLM returned no usable code. Try a clearer screenshot or re-upload.' },
        { status: 502 },
      )
    }

    // Persist as a Conversion row.
    const conv = await db.conversion.create({
      data: {
        screenshotPath: saved.path,
        prompt: systemPrompt,
        generatedCode,
        componentName,
        model,
      },
    })

    return NextResponse.json({
      id: conv.id,
      screenshotPath: conv.screenshotPath,
      generatedCode: conv.generatedCode,
      componentName: conv.componentName,
      model: conv.model,
      prompt: conv.prompt,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error('[convert] error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'Internal error' },
      { status: 500 },
    )
  }
}

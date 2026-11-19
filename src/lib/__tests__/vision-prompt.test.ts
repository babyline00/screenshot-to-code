import { test, expect, describe } from 'bun:test'
import { buildVisionSystemPrompt } from '../vision-prompt'

describe('buildVisionSystemPrompt', () => {
  test('returns a non-empty string', () => {
    const p = buildVisionSystemPrompt()
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(200)
  })

  test('instructs the model to produce a React + Tailwind component', () => {
    const p = buildVisionSystemPrompt()
    expect(p.toLowerCase()).toContain('react')
    expect(p.toLowerCase()).toContain('tailwind')
    expect(p.toLowerCase()).toContain('component')
  })

  test('mentions shadcn/ui patterns by name', () => {
    const p = buildVisionSystemPrompt()
    expect(p.toLowerCase()).toContain('shadcn')
    // At least a few of the shadcn primitives should appear by name.
    const patterns = ['Card', 'Button', 'Input', 'Avatar', 'Badge', 'Tabs']
    const present = patterns.filter((x) => p.includes(x))
    expect(present.length).toBeGreaterThanOrEqual(4)
  })

  test('instructs the model to return ONLY the JSX code (no fences, no prose)', () => {
    const p = buildVisionSystemPrompt()
    expect(p.toLowerCase()).toContain('only')
    expect(p.toLowerCase()).toContain('jsx')
    expect(p.toLowerCase()).toContain('markdown')
    expect(p.toLowerCase()).toContain('fence')
    expect(p.toLowerCase()).toContain('prose')
  })

  test('instructs the model to use placeholder text for unreadable text', () => {
    const p = buildVisionSystemPrompt()
    expect(p.toLowerCase()).toContain('placeholder')
    expect(p.toLowerCase()).toContain('unreadable')
  })

  test('uses the requested component name in the prompt', () => {
    const name = 'LoginPage'
    const p = buildVisionSystemPrompt(name)
    expect(p).toContain(`const ${name} = () =>`)
    expect(p).toContain(`export default ${name};`)
  })

  test('falls back to GeneratedComponent when no name is passed', () => {
    const p = buildVisionSystemPrompt()
    expect(p).toContain('GeneratedComponent')
  })

  test('explicitly forbids inline styles and CSS files', () => {
    const p = buildVisionSystemPrompt()
    expect(p.toLowerCase()).toContain('inline')
    expect(p.toLowerCase()).toContain('style')
  })

  test('explicitly forbids imports', () => {
    const p = buildVisionSystemPrompt()
    expect(p.toLowerCase()).toContain('import')
  })

  test('first character of the prompt is "You"', () => {
    const p = buildVisionSystemPrompt()
    expect(p.startsWith('You are')).toBe(true)
  })
})

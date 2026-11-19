import { test, expect, describe } from 'bun:test'
import { cleanLlmResponse } from '../code-cleaner'

describe('cleanLlmResponse', () => {
  test('returns empty string for null/undefined', () => {
    // @ts-expect-error — testing robustness
    expect(cleanLlmResponse(null)).toBe('')
    // @ts-expect-error — testing robustness
    expect(cleanLlmResponse(undefined)).toBe('')
  })

  test('strips markdown fences (jsx)', () => {
    const raw = '```jsx\nconst Foo = () => <div />;\nexport default Foo;\n```'
    const out = cleanLlmResponse(raw)
    expect(out).not.toContain('```')
    expect(out).toContain('const Foo = () => <div />;')
    expect(out).toContain('export default Foo;')
  })

  test('strips markdown fences (tsx)', () => {
    const raw = '```tsx\nconst Bar = () => <span />;\nexport default Bar;\n```'
    const out = cleanLlmResponse(raw)
    expect(out).not.toContain('```')
    expect(out).toContain('const Bar = () => <span />;')
  })

  test('strips markdown fences with no language tag', () => {
    const raw = '```\nconst Baz = () => <p />;\nexport default Baz;\n```'
    const out = cleanLlmResponse(raw)
    expect(out).not.toContain('```')
    expect(out).toContain('const Baz = () => <p />;')
  })

  test('strips leading prose lines', () => {
    const raw = [
      'Here is the React component you requested:',
      '',
      'const Component = () => {',
      '  return <div>Hello</div>;',
      '};',
      'export default Component;',
    ].join('\n')
    const out = cleanLlmResponse(raw)
    expect(out).not.toContain('Here is')
    expect(out.startsWith('const Component')).toBe(true)
    expect(out).toContain('export default Component;')
  })

  test('strips trailing prose after the last semicolon', () => {
    const raw = [
      'const Component = () => {',
      '  return <div>Hi</div>;',
      '};',
      'export default Component;',
      '',
      'Let me know if you want me to adjust anything!',
    ].join('\n')
    const out = cleanLlmResponse(raw)
    expect(out).not.toContain('Let me know')
    expect(out.trim().endsWith('export default Component;')).toBe(true)
  })

  test('passes through plain code untouched (modulo trailing newline)', () => {
    const raw = [
      'const Component = () => {',
      '  return <div>Hi</div>;',
      '};',
      'export default Component;',
    ].join('\n')
    const out = cleanLlmResponse(raw)
    expect(out.startsWith('const Component')).toBe(true)
    expect(out.trim().endsWith('export default Component;')).toBe(true)
  })

  test('strips leading import lines that the LLM adds despite the prompt', () => {
    // Cleaner doesn't strip imports — it only strips prose. The LLM is
    // instructed not to emit imports, but if it does, the live preview
    // builder handles stripping. We assert the cleaner leaves them in
    // (since import lines look like code), which is the documented behavior.
    const raw = [
      'import React from "react";',
      'const X = () => <div />;',
      'export default X;',
    ].join('\n')
    const out = cleanLlmResponse(raw)
    expect(out).toContain('import React from "react";')
    expect(out).toContain('export default X;')
  })

  test('returns only the first fenced block when there are two', () => {
    const raw = [
      '```jsx',
      'const A = () => <div />;',
      'export default A;',
      '```',
      '',
      'And here is how to use it:',
      '```jsx',
      'import A from "./A";',
      '<A />',
      '```',
    ].join('\n')
    const out = cleanLlmResponse(raw)
    expect(out).toContain('const A = () => <div />;')
    expect(out).toContain('export default A;')
    // The second block (usage example) is stripped.
    expect(out).not.toContain('import A from "./A";')
    expect(out).not.toContain('And here is how to use it')
  })
})

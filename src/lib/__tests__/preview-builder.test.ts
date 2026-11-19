import { test, expect, describe } from 'bun:test'
import { buildPreviewHtml, adaptUserCode } from '../preview-builder'

describe('buildPreviewHtml', () => {
  test('returns a complete HTML doc string', () => {
    const html = buildPreviewHtml('const X = () => <div />;')
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html.trim().endsWith('</html>')).toBe(true)
  })

  test('contains the Tailwind CDN script', () => {
    const html = buildPreviewHtml('const X = () => <div />;')
    expect(html).toContain('https://cdn.tailwindcss.com')
    expect(html).toContain('<script src="https://cdn.tailwindcss.com"></script>')
  })

  test('contains the React CDN script', () => {
    const html = buildPreviewHtml('const X = () => <div />;')
    expect(html).toContain('react.development.js')
  })

  test('contains the ReactDOM CDN script', () => {
    const html = buildPreviewHtml('const X = () => <div />;')
    expect(html).toContain('react-dom.development.js')
  })

  test('contains Babel standalone for JSX transpilation', () => {
    const html = buildPreviewHtml('const X = () => <div />;')
    expect(html).toContain('@babel/standalone/babel.min.js')
    // The user code block must be marked as text/babel so Babel transpiles it.
    expect(html).toContain('type="text/babel"')
  })

  test('contains ReactDOM.render(...) call', () => {
    const html = buildPreviewHtml('const X = () => <div />;')
    expect(html).toContain('ReactDOM.render(')
  })

  test('includes the user code verbatim in the document', () => {
    const code = [
      'const GeneratedComponent = () => {',
      '  return <div className="p-4">Hello world</div>;',
      '};',
      'export default GeneratedComponent;',
    ].join('\n')
    const html = buildPreviewHtml(code)
    // The component declaration survives the adaptUserCode pass.
    expect(html).toContain('const GeneratedComponent = () => {')
    expect(html).toContain('Hello world')
    // The `export default Foo;` form is rewritten to `const __Default = Foo;`
    // so the iframe (which has no module system) can mount it.
    expect(html).toContain('const __Default = GeneratedComponent;')
  })

  test('handles empty code without throwing', () => {
    const html = buildPreviewHtml('')
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
  })

  test('respects custom CDN URLs', () => {
    const html = buildPreviewHtml('const X = () => <div />;', {
      tailwindCdn: 'https://example.test/tw.js',
      reactCdn: 'https://example.test/r.js',
      reactDomCdn: 'https://example.test/rd.js',
      babelCdn: 'https://example.test/b.js',
    })
    expect(html).toContain('https://example.test/tw.js')
    expect(html).toContain('https://example.test/r.js')
    expect(html).toContain('https://example.test/rd.js')
    expect(html).toContain('https://example.test/b.js')
  })

  test('has a #root div for the React mount', () => {
    const html = buildPreviewHtml('const X = () => <div />;')
    expect(html).toContain('id="root"')
  })
})

describe('adaptUserCode', () => {
  test('strips import statements', () => {
    const code = `import React from "react";\nimport { foo } from "./foo";\nconst X = () => <div />;\nexport default X;`
    const adapted = adaptUserCode(code)
    expect(adapted).not.toContain('import React')
    expect(adapted).not.toContain('import { foo }')
    expect(adapted).toContain('const X = () => <div />;')
  })

  test('rewrites `export default Foo;` to `const __Default = Foo;`', () => {
    const code = `const Foo = () => <div />;\nexport default Foo;`
    const adapted = adaptUserCode(code)
    expect(adapted).toContain('const __Default = Foo;')
    expect(adapted).not.toContain('export default Foo;')
  })

  test('rewrites `export default () =>` arrow to `const __Default = () =>`', () => {
    const code = `export default () => <div className="hello" />;`
    const adapted = adaptUserCode(code)
    expect(adapted).toContain('const __Default = () =>')
  })

  test('rewrites `export default function Foo() {}` and appends __Default binding', () => {
    const code = `export default function Foo() { return <div />; }`
    const adapted = adaptUserCode(code)
    expect(adapted).toContain('function Foo()')
    expect(adapted).toContain('const __Default = Foo;')
  })

  test('does NOT add a duplicate __Default binding when one already exists', () => {
    const code = `const Foo = () => <div />;\nexport default Foo;`
    const adapted = adaptUserCode(code)
    const bindings = (adapted.match(/__Default\s*=/g) || []).length
    expect(bindings).toBe(1)
  })
})

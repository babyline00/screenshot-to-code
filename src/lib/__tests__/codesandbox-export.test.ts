import { test, expect, describe } from 'bun:test'
import {
  buildCodeSandboxUrl,
  buildSandboxFiles,
  decodeCodeSandboxUrl,
  base64Utf8Encode,
  base64Utf8Decode,
} from '../codesandbox-export'

const SAMPLE_CODE = `const GeneratedComponent = () => {
  return (
    <div className="p-4">
      <button className="bg-blue-500 text-white px-4 py-2 rounded">Click me</button>
    </div>
  );
};
export default GeneratedComponent;
`

describe('base64Utf8Encode / base64Utf8Decode', () => {
  test('round-trips an ASCII string', () => {
    const s = 'hello world'
    const b64 = base64Utf8Encode(s)
    expect(base64Utf8Decode(b64)).toBe(s)
  })

  test('round-trips a UTF-8 string with multibyte chars', () => {
    const s = '¡Hola! 你好 — café'
    const b64 = base64Utf8Encode(s)
    expect(base64Utf8Decode(b64)).toBe(s)
  })
})

describe('buildSandboxFiles', () => {
  test('returns the expected file shape', () => {
    const files = buildSandboxFiles(SAMPLE_CODE, 'GeneratedComponent')
    expect(files['src/App.js']).toBeDefined()
    expect(files['src/App.js'].content).toContain('GeneratedComponent')
    expect(files['src/index.js']).toBeDefined()
    expect(files['package.json']).toBeDefined()
    expect(files['tailwind.config.js']).toBeDefined()
    expect(files['postcss.config.js']).toBeDefined()
    expect(files['src/tailwind.css']).toBeDefined()
  })

  test('appends an `export default` if the user code is missing one', () => {
    const noExport = `const Foo = () => <div />;`
    const files = buildSandboxFiles(noExport, 'Foo')
    expect(files['src/App.js'].content).toContain('export default Foo;')
  })
})

describe('buildCodeSandboxUrl', () => {
  test('returns a valid https URL with the define endpoint', () => {
    const url = buildCodeSandboxUrl(SAMPLE_CODE, 'GeneratedComponent')
    expect(url.startsWith('https://codesandbox.io/api/v1/sandboxes/define?parameters=')).toBe(true)
  })

  test('the parameters are base64-encoded JSON', () => {
    const url = buildCodeSandboxUrl(SAMPLE_CODE, 'GeneratedComponent')
    const decoded = decodeCodeSandboxUrl(url)
    expect(decoded.files).toBeDefined()
    expect(decoded.files['src/App.js'].content).toContain('GeneratedComponent')
    expect(decoded.files['package.json'].content).toContain('react')
    expect(decoded.files['src/tailwind.css'].content).toContain('@tailwind')
  })

  test('the URL is parseable and the parameters round-trip', () => {
    const url = buildCodeSandboxUrl('const X = () => <span />;', 'X')
    expect(() => decodeCodeSandboxUrl(url)).not.toThrow()
    const decoded = decodeCodeSandboxUrl(url)
    expect(decoded.files['src/App.js'].content).toContain('const X = () => <span />;')
  })

  test('uses the default component name when none is passed', () => {
    const url = buildCodeSandboxUrl(SAMPLE_CODE)
    const decoded = decodeCodeSandboxUrl(url)
    // The code as-is doesn't need an appended default because it has one,
    // but the URL should still encode the code.
    expect(decoded.files['src/App.js'].content).toContain('GeneratedComponent')
  })

  test('the package.json declares react + react-dom + react-scripts', () => {
    const url = buildCodeSandboxUrl(SAMPLE_CODE, 'GeneratedComponent')
    const decoded = decodeCodeSandboxUrl(url)
    const pkg = JSON.parse(decoded.files['package.json'].content)
    expect(pkg.dependencies.react).toBeDefined()
    expect(pkg.dependencies['react-dom']).toBeDefined()
    expect(pkg.dependencies['react-scripts']).toBeDefined()
  })

  test('the tailwind config is present and uses the correct content glob', () => {
    const url = buildCodeSandboxUrl(SAMPLE_CODE, 'GeneratedComponent')
    const decoded = decodeCodeSandboxUrl(url)
    expect(decoded.files['tailwind.config.js'].content).toContain('./src/**/*.{js,jsx,ts,tsx}')
  })

  test('decoding throws on a URL without parameters', () => {
    expect(() => decodeCodeSandboxUrl('https://example.com/no-params')).toThrow()
  })
})

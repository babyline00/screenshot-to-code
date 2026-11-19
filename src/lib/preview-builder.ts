/**
 * Build the HTML document string that the live-preview iframe renders via
 * `srcDoc`.
 *
 * The doc:
 *   - Loads React 18 + ReactDOM 18 from a CDN as UMD globals.
 *   - Loads Babel standalone so we can transpile JSX in-browser.
 *   - Loads Tailwind via the CDN play-script (good enough for a live preview;
 *     production Tailwind would be a build step).
 *   - Mounts the user's component into a #root div.
 *
 * The user's code is expected to be a single React + Tailwind component with
 * an `export default`. We strip the `export default` (Babel standalone can't
 * handle ES module exports in a script tag) and re-assign it to a local
 * variable that we then pass to `ReactDOM.render`.
 *
 * IMPORTANT: this string is what gets passed verbatim as `srcDoc` to an
 * <iframe>. We must NOT escape the JSX — the iframe parses it as HTML.
 */

const REACT_CDN = 'https://unpkg.com/react@18/umd/react.development.js'
const REACT_DOM_CDN = 'https://unpkg.com/react-dom@18/umd/react-dom.development.js'
const BABEL_CDN = 'https://unpkg.com/@babel/standalone/babel.min.js'
const TAILWIND_CDN = 'https://cdn.tailwindcss.com'

export interface BuildPreviewHtmlOptions {
  /** Override the React CDN URL (tests can use a fixture). */
  reactCdn?: string
  reactDomCdn?: string
  babelCdn?: string
  tailwindCdn?: string
  /** Override the body padding / background. Defaults to a neutral bg. */
  bodyStyle?: string
}

/**
 * Adapt the user's code for in-browser execution by Babel standalone.
 *
 * Babel standalone doesn't support `export default` / `import` (no module
 * system in a plain script tag). We rewrite:
 *   - `export default Foo;` -> `const __Default = Foo;`
 *   - `export default function Foo() {...}` -> `function Foo() {...}; const __Default = Foo;`
 *   - `export default () => {...}` -> `const __Default = () => {...};`
 *   - Strips any `import` lines entirely (the prompt asks for none, but
 *     the LLM sometimes adds them anyway).
 *
 * Then the wrapper script does `ReactDOM.render(<__Default />, root)`.
 */
export function adaptUserCode(code: string): string {
  let out = String(code || '')

  // Strip import statements — the prompt forbids them but the LLM sometimes
  // adds `import React from 'react'`. React is a global in the iframe.
  out = out.replace(/^\s*import\s+[^;]*;?\s*$/gm, '')

  // 1. `export default function Foo(...) {...}` -> `function Foo(...) {...}`
  //    (we'll bind __Default to Foo at the end if no other export-default form
  //    was found). Must run BEFORE the identifier-form rewriter below,
  //    otherwise "function" would be treated as the identifier.
  let sawFunctionDefault = false
  out = out.replace(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g, (_m, name) => {
    sawFunctionDefault = true
    return `function ${name}(`
  })

  // 2. `export default Foo;` (identifier) -> `const __Default = Foo;`
  let sawIdentifierDefault = false
  out = out.replace(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/g, (_m, name) => {
    sawIdentifierDefault = true
    return `const __Default = ${name};`
  })

  // 3. `export default (...) =>` or `export default () => {...}` ->
  //    `const __Default = (...) =>`
  let sawArrowDefault = false
  out = out.replace(/export\s+default\s+/g, (_m) => {
    sawArrowDefault = true
    return 'const __Default = '
  })

  // 4. If we rewrote a `function Foo() {...}` of its `export default` and no
  //    other __Default binding happened, append `const __Default = Foo;`.
  if (sawFunctionDefault && !sawIdentifierDefault && !sawArrowDefault) {
    const fnMatches = [...out.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)]
    if (fnMatches.length > 0) {
      const lastName = fnMatches[fnMatches.length - 1][1]
      out += `\nconst __Default = ${lastName};`
    }
  }

  return out
}

export function buildPreviewHtml(
  code: string,
  opts: BuildPreviewHtmlOptions = {},
): string {
  const reactCdn = opts.reactCdn ?? REACT_CDN
  const reactDomCdn = opts.reactDomCdn ?? REACT_DOM_CDN
  const babelCdn = opts.babelCdn ?? BABEL_CDN
  const tailwindCdn = opts.tailwindCdn ?? TAILWIND_CDN
  const bodyStyle =
    opts.bodyStyle ?? 'margin:0;padding:16px;background:#ffffff;font-family:ui-sans-serif,system-ui,sans-serif;'

  const adapted = adaptUserCode(code)

  // We deliberately use text/babel for the user's code so Babel standalone
  // transpiles JSX at runtime. The trailing inline script mounts the
  // __Default component via the (deprecated-but-still-working) ReactDOM.render
  // API so the resulting HTML contains a literal `ReactDOM.render(...)` call
  // — that's what makes the preview deterministic and matches the documented
  // behavior of the unit tests.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview</title>
  <script src="${tailwindCdn}"></script>
  <script src="${reactCdn}"></script>
  <script src="${reactDomCdn}"></script>
  <script src="${babelCdn}"></script>
  <style>
    html, body { height: 100%; }
    body { ${bodyStyle} }
    /* Hide preview error overlay by default; we render errors inline. */
    .__err { background:#fee;border:1px solid #f88;color:#900;padding:8px;border-radius:6px;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    try {
      ${adapted}
      ReactDOM.render(<__Default />, document.getElementById('root'));
    } catch (e) {
      const root = document.getElementById('root');
      root.innerHTML = '<pre class="__err">' + (e && e.stack ? e.stack : String(e)) + '</pre>';
    }
  </script>
</body>
</html>`
}

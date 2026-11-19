/**
 * Clean a raw LLM response into pure JSX code.
 *
 * Vision LLMs are notorious for:
 *   1. Wrapping the code in markdown fences (```jsx ... ``` or ```tsx ... ```),
 *   even when the prompt explicitly says "no fences".
 *   2. Adding a line of prose before the code ("Here is the component:" or
 *   "Sure! Here you go:").
 *   3. Adding a closing remark after the code.
 *
 * `cleanLlmResponse(text)` strips all of that and returns only the JSX code.
 * It's pure and side-effect-free so we can unit-test every case.
 *
 * Strategy:
 *   - If the text contains a fenced code block, extract the contents of the
 *     FIRST fenced block (LLMs sometimes add a second block with a usage
 *     example — we only want the component).
 *   - Otherwise, strip any leading prose lines until we hit a line that looks
 *     like the start of the component (`const`, `function`, `import`,
 *     `export`, or `//`).
 *   - Strip any trailing prose after the last semicolon / closing brace.
 *   - Trim trailing whitespace.
 */

const FENCE_RE = /```(?:[a-zA-Z0-9_-]*)\s*\n?([\s\S]*?)```/

/** Detect the first line that looks like the start of the component. */
function isCodeStartLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return (
    trimmed.startsWith('const ') ||
    trimmed.startsWith('function ') ||
    trimmed.startsWith('import ') ||
    trimmed.startsWith('export ') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('type ') ||
    trimmed.startsWith('interface ')
  )
}

export function cleanLlmResponse(text: string): string {
  if (text == null) return ''
  const raw = String(text)

  // 1. Fenced code block — extract the first one.
  const fenceMatch = raw.match(FENCE_RE)
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim() + '\n'
  }

  // 2. No fence. Strip leading prose lines until we hit something that
  // looks like the start of a component.
  const lines = raw.split('\n')
  let startIdx = 0
  while (startIdx < lines.length && !isCodeStartLine(lines[startIdx])) {
    startIdx++
  }
  let code = lines.slice(startIdx).join('\n').trim()

  // 3. Strip trailing prose. We assume the code ends with either `;` or `}`.
  // Find the LAST occurrence of one of those at the end of a line.
  const codeLines = code.split('\n')
  let endIdx = codeLines.length
  while (endIdx > 0) {
    const line = codeLines[endIdx - 1].trimEnd()
    if (line === '') {
      endIdx--
      continue
    }
    if (/[;{}]\s*$/.test(line) || line.endsWith(';') || line.endsWith('}')) {
      break
    }
    // Once we hit a non-empty line that does NOT end with ; or }, we're in
    // trailing prose — keep walking back.
    endIdx--
  }
  code = codeLines.slice(0, endIdx).join('\n').trim()

  return code ? code + '\n' : ''
}

/**
 * System-prompt builder for the screenshot-to-code vision LLM call.
 *
 * The prompt instructs the model to:
 *   - Generate a single React + Tailwind component that reproduces the screenshot.
 *   - Use only Tailwind utility classes (no inline `style` attributes, no CSS files).
 *   - Reach for shadcn/ui-style patterns (Card, Button, Input, Avatar, Badge, etc.)
 *     when the screenshot clearly shows those primitives — so the output is
 *     idiomatic and drop-in compatible with a real shadcn project.
 *   - Use placeholder text where text in the screenshot is unreadable.
 *   - Return ONLY the JSX code, no markdown fences, no prose.
 *
 * Kept as a pure function so it's trivially unit-testable without touching the LLM.
 */

const SHADCN_PATTERNS = [
  'Card (with CardHeader, CardTitle, CardDescription, CardContent, CardFooter)',
  'Button (variants: default, outline, ghost, destructive; sizes: default, sm, lg, icon)',
  'Input (text fields, search fields, with label)',
  'Textarea (multi-line text areas)',
  'Badge (status chips, tags, labels)',
  'Avatar (with AvatarImage and AvatarFallback)',
  'Separator (horizontal / vertical dividers)',
  'Tabs (with TabsList, TabsTrigger, TabsContent)',
  'Dialog / Sheet (modals and slide-overs)',
  'DropdownMenu (menu triggers, items, separators)',
  'ScrollArea (scrollable regions)',
  'Switch / Checkbox / RadioGroup (form toggles)',
  'Skeleton (loading placeholders)',
  'Progress (determinate progress bars)',
]

export function buildVisionSystemPrompt(componentName = 'GeneratedComponent'): string {
  return [
    'You are an expert frontend developer.',
    'Given this UI screenshot, generate a single React + Tailwind component that reproduces it.',
    '',
    'Hard requirements:',
    '1. Output a SINGLE React functional component, declared with the arrow-function syntax: `const ' +
      componentName +
      ' = () => { return ( ... ) }` followed by `export default ' +
      componentName +
      ';`',
    '2. Use ONLY Tailwind utility classes for styling. Do NOT use inline `style` attributes, do NOT use CSS files, do NOT use styled-components. Tailwind utility classes only.',
    '3. Use placeholder text (e.g. "Lorem ipsum", "Placeholder text", realistic but obviously-placeholder copy) where text in the screenshot is unreadable or blurry. Match the approximate length of the visible text so the layout stays the same.',
    '4. Use semantic HTML where reasonable (form, label, button, nav, header, main, footer).',
    '5. Do NOT import anything. The component must run as-is in a runtime that already has React loaded globally (React, ReactDOM available via CDN).',
    '6. Reproduce the LAYOUT as faithfully as possible: spacing, alignment, grid/flex structure, padding, border-radius, shadows, colors. If the screenshot is a login card centered on a colored background, render the colored background too.',
    '7. For SVG icons, inline simple SVGs with `className="size-4"` or similar — do NOT depend on lucide-react or any icon library being available.',
    '',
    'Component-library awareness (shadcn/ui patterns):',
    'When the screenshot clearly shows one of these patterns, structure the JSX accordingly. The runtime does NOT have shadcn installed, so you must inline the styles that shadcn would normally provide — but organize the JSX into the same component sub-shapes so the code is idiomatic and easy to port to a real shadcn project:',
    ...SHADCN_PATTERNS.map((p, i) => `   ${i + 1}. ${p}`),
    '',
    'Output format:',
    '- Return ONLY the JSX code. No prose, no explanation, no markdown fences (do NOT wrap the code in triple backticks).',
    '- The very first character of your response MUST be the start of the component declaration: `const ' + componentName + ' = () => {`',
    '- The very last character of your response MUST be the closing of the export: `export default ' + componentName + ';`',
    '',
    'Begin.',
  ].join('\n')
}

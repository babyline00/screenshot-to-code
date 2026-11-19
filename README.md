# Screenshot to Code Converter

Upload a screenshot of any UI. Get a working **React + Tailwind** component reproducing it, with editable code and a live preview. Backed by a vision LLM (`z-ai-web-dev-sdk` `zai.chat.completions.createVision`), persisted to SQLite, and rendered live in an `iframe srcDoc` that runs React + Tailwind + Babel standalone from CDN. Project #69 of the 110-project portfolio plan.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Screenshot to Code         [Copy] [Save] [Export] [Re-generate] [Hist]   │
├────────────┬───────────────────────────────────────┬─────────────────────┤
│            │                                       │                     │
│  Original  │   const GeneratedComponent = () => {   │   Live Preview      │
│  Screenshot│     return (                          │   ┌─────────────┐   │
│            │       <div className="p-4">            │   │             │   │
│  ┌──────┐  │         <Card>...                      │   │  React +   │   │
│  │      │  │       </Card>                          │   │  Tailwind   │   │
│  │ img  │  │     </div>                             │   │  rendered   │   │
│  │      │  │   );                                  │   │  live via   │   │
│  └──────┘  │   };                                  │   │  iframe     │   │
│            │   export default GeneratedComponent;   │   │  srcDoc     │   │
│            │                                       │   │             │   │
│            │   (textarea — editable)               │   └─────────────┘   │
└────────────┴───────────────────────────────────────┴─────────────────────┘
        ┌─ Drop a screenshot here or click to upload ─┐  (initial state)
        └─────────────────────────────────────────────┘
```

---

## Features

- **Drag-and-drop screenshot upload** — drop a `.png` / `.jpg` / `.webp` anywhere in the drop zone, or click to pick. Server validates the MIME type and writes the bytes to `public/uploads/<uuid>.<ext>`; the DB stores only the relative path so the repo stays light.
- **Vision LLM call** — uses `zai.chat.completions.createVision` with a system prompt that instructs the model to produce a single React + Tailwind component, return ONLY the JSX (no markdown fences), and use placeholder text where text in the screenshot is unreadable. Defaults to `gpt-4o`; override via `LLM_MODEL`.
- **Editable code** — generated JSX renders in a textarea. Edit freely. A `edited` badge appears in the toolbar once the code diverges from the LLM's output.
- **Live preview via `iframe srcDoc`** — every keystroke is debounced 500ms, posted to `/api/preview`, which wraps the code in an HTML doc that loads React 18 + ReactDOM + Babel standalone + Tailwind CDN and renders the component into a `#root` div. The iframe is `sandbox="allow-scripts allow-same-origin"` so the previewed code can't touch the parent page.
- **Component-library aware** — the system prompt enumerates the shadcn/ui primitives (Card, Button, Input, Avatar, Badge, Tabs, Dialog, Sheet, DropdownMenu, ScrollArea, Switch, Skeleton, Progress) and tells the LLM to structure the JSX accordingly when the screenshot shows those patterns. The runtime doesn't have shadcn installed, so the LLM inlines the equivalent Tailwind — but the code is shaped so porting to a real shadcn project is a copy-paste.
- **Export to CodeSandbox** — a pure client-side function (`buildCodeSandboxUrl`) base64-encodes a JSON payload of `App.js` + `index.js` + `package.json` + `tailwind.config.js` + `postcss.config.js` into a CodeSandbox `define` URL. One click opens the sandbox in a new tab.
- **History** — every conversion is persisted to SQLite. The collapsible sidebar shows thumbnails and timestamps; clicking loads the conversion back into the workspace (including the user's edits, not just the original LLM output). Delete removes both the DB row and the screenshot file from disk.
- **Stats endpoint** — `GET /api/stats` returns the total count, count-with-edits, and the timestamp of the most recent conversion.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Route Handlers, multipart `formData()`, edge-friendly |
| Language | TypeScript 5 (strict) | End-to-end type safety |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) | Copy-paste primitives, theme tokens, no JS-in-CSS |
| Database | SQLite + Prisma 6 | Local-first, zero-infra, one model (`Conversion`) |
| LLM | `z-ai-web-dev-sdk` `zai.chat.completions.createVision` | Pluggable `VisionProvider` interface — swap for any vision-capable endpoint by implementing one method |
| Live preview | `iframe srcDoc` + React 18 UMD + Babel standalone + Tailwind CDN | Sandboxed, no build step, real React + real Tailwind |
| Export | CodeSandbox `define` URL (pure base64) | No API key, no round-trip, opens in a new tab |
| Tests | `bun test` | Built-in, ~50ms for the full suite |
| Lint | ESLint (eslint-config-next) | Next.js + TypeScript rules |

---

## Architecture

```
                ┌──────────────────────────────────────────────┐
                │       Next.js 16 (App Router)                │
                │                                              │
  screenshot ──►  POST /api/convert                            │
   (drop)        │   ├─ validateImage(file)                     │
                │   ├─ saveImage(file)  ─► public/uploads/<uuid>.png
                │   ├─ buildDataUrl(bytes)                      │
                │   ├─ buildVisionSystemPrompt()                 │
                │   ├─ getVisionProvider().complete(...)         │
                │   │       └─► zai.chat.completions.createVision
                │   ├─ cleanLlmResponse(raw)  ── strips fences/prose
                │   └─ db.conversion.create({...})               │
                │              │                                 │
                │              ▼                                 │
                │       SQLite (Prisma)                          │
                │       Conversion(id, screenshotPath,           │
                │                   generatedCode, editedCode,   │
                │                   componentName, model, ...)   │
                │              ▲                                 │
                │              │                                 │
   edit code ──►  POST /api/preview  ──► buildPreviewHtml(code)   │
                │       └─► React UMD + Tailwind CDN + Babel     │
                │           ─► iframe srcDoc (sandboxed)        │
                │                                              │
   save edit ──►  PATCH /api/conversions/[id]  (editedCode)     │
                │                                              │
   history   ──►  GET  /api/conversions           (list, recent) │
                │  GET  /api/conversions/[id]     (single)      │
                │  DEL  /api/conversions/[id]     (+unlink img) │
                │  GET  /api/stats                (counts)      │
                │                                              │
   export    ──►  buildCodeSandboxUrl(code, name) (pure, client) │
                │  └─► base64(JSON{files}) ─► codesandbox URL   │
                └──────────────────────────────────────────────┘
```

### Vision pipeline

1. **Validate** — `validateImage(file)` accepts png/jpeg/webp (by MIME, with a name-extension fallback).
2. **Persist** — `saveImage(file)` generates a UUIDv4, writes bytes to `public/uploads/<uuid>.<ext>`, and returns `{ path, absPath, uuid, bytes }`. The public-relative path is what the DB stores.
3. **Encode** — `buildDataUrl(bytes, mimeType)` produces a `data:image/<mime>;base64,...` string with no `Buffer` dependency (works in any runtime).
4. **Prompt** — `buildVisionSystemPrompt(componentName)` returns the deterministic system prompt. The prompt:
   - Demands a single React functional component, arrow-function syntax, ending with `export default <name>;`.
   - Forbids inline `style` attributes, CSS files, and imports (React + ReactDOM are globals in the preview iframe).
   - Lists shadcn/ui primitives by name so the LLM inlines their Tailwind when the screenshot shows them.
   - Tells the model to use placeholder text for unreadable text.
   - Tells the model to return ONLY the JSX — no fences, no prose.
5. **Call** — `VisionProvider.complete({ systemPrompt, image: { dataUrl, mimeType } })` calls `zai.chat.completions.createVision`. The prompt is folded into the user message text part alongside the image_url part (the SDK's vision endpoint takes a single user turn).
6. **Clean** — `cleanLlmResponse(raw)` strips markdown fences (` ```jsx ... ``` `) and any leading/trailing prose, returning only the JSX code. Robust enough to handle the LLM ignoring the "no fences" instruction.
7. **Persist** — `db.conversion.create({ screenshotPath, prompt, generatedCode, componentName, model })`. Return the row to the client.

### Live-preview pipeline (per keystroke, debounced 500ms)

1. Client posts `{ code }` to `POST /api/preview`.
2. `buildPreviewHtml(code)`:
   - Calls `adaptUserCode(code)` which:
     - Strips any `import` statements (React + ReactDOM are globals via the CDN scripts).
     - Rewrites `export default Foo;` → `const __Default = Foo;`.
     - Rewrites `export default () => ...` → `const __Default = () => ...`.
     - Rewrites `export default function Foo() { ... }` → `function Foo() { ... }` and appends `const __Default = Foo;`.
   - Wraps the adapted code in a `<!DOCTYPE html>` doc that loads Tailwind CDN, React 18 UMD, ReactDOM 18 UMD, and Babel standalone.
   - Mounts `ReactDOM.render(<__Default />, root)` inside a `text/babel` script block so Babel transpiles the JSX at runtime.
   - Catches runtime errors and renders them inline as a `.err` block in the iframe.
3. Client sets the HTML string as the iframe's `srcDoc` attribute. The iframe is `sandbox="allow-scripts allow-same-origin"` so the previewed component can't touch the parent app.

### Storage schema

```
Conversion
  id             String   @id @default(cuid())
  screenshotPath String   // "uploads/<uuid>.png"
  prompt         String   // the system prompt sent to the LLM (for audit/re-run)
  generatedCode  String   // cleaned LLM output
  editedCode     String?  // null until first edit
  componentName  String   @default("GeneratedComponent")
  model          String   @default("gpt-4o")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
```

One row per conversion. The screenshot is on disk; only the relative path is in the DB. Deleting a row also unlinks the screenshot file (best-effort).

---

## Getting started

### Prerequisites

- Node.js 20+ or [Bun](https://bun.sh) 1.3+
- The `z-ai-web-dev-sdk` config (auto-loaded in the sandbox env; on your own machine, set the SDK env vars per the SDK docs).

### Install + run

```bash
# 1. install deps
bun install

# 2. set up the env
cp .env.example .env
# .env contains:
#   DATABASE_URL=file:/home/z/my-project/apps/69-screenshot-to-code/db/custom.db
#   LLM_MODEL=gpt-4o
#   PKC_DISABLE_LLM=0

# 3. push the schema
bun run db:push

# 4. start dev server
bun run dev

# 5. open http://localhost:3000 — drop a screenshot
```

### Optional: disable the real LLM

```bash
# .env
PKC_DISABLE_LLM=1
```

When set, the app uses `MockProvider` which returns a tiny but valid React + Tailwind component on every call. Useful for offline demo or CI.

### Optional: pick a different vision model

```bash
# .env
LLM_MODEL=gpt-4o-mini   # cheaper; slightly worse on small text
```

The `model` is stored on each `Conversion` row so you can see which model produced which output.

### Plug in any vision backend

The vision layer is a single `VisionProvider` interface with one method:

```ts
interface VisionProvider {
  complete(args: {
    systemPrompt: string
    image: { dataUrl: string; mimeType: string }
    userPrompt?: string
  }): Promise<string>
}
```

`src/lib/ai.ts` ships two implementations: `ZaiProvider` (uses `z-ai-web-dev-sdk`) and `MockProvider` (deterministic stub for tests / offline demo). Add an `OpenAIVisionProvider` or `AnthropicVisionProvider` and swap `getVisionProvider()` to switch backends.

---

## Tests

```bash
bun test
```

74 tests across 6 files (vision prompt, image handler, code cleaner, preview builder, codesandbox export, vision AI / data URL). All pure-function modules, ~50ms total runtime.

```
✓ src/lib/__tests__/vision-prompt.test.ts       (10 tests)
✓ src/lib/__tests__/image-handler.test.ts       (17 tests)
✓ src/lib/__tests__/code-cleaner.test.ts         (9 tests)
✓ src/lib/__tests__/preview-builder.test.ts    (15 tests)
✓ src/lib/__tests__/codesandbox-export.test.ts  (11 tests)
✓ src/lib/__tests__/ai.test.ts                  (12 tests)

74 pass, 0 fail
```

---

## Project structure

```
.
├── prisma/
│   └── schema.prisma                  # Conversion model
├── public/
│   └── uploads/                       # screenshot files (gitignored)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── convert/route.ts       # POST  multipart → vision LLM → DB
│   │   │   ├── conversions/route.ts   # GET   list
│   │   │   ├── conversions/[id]/route.ts  # GET/PATCH/DELETE single
│   │   │   ├── preview/route.ts       # POST  { code } → HTML doc
│   │   │   └── stats/route.ts         # GET   { conversions, withEdits, lastCreatedAt }
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── page.tsx                   # drop zone + code editor + preview + sidebar
│   ├── components/ui/                 # shadcn/ui (New York)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── textarea.tsx
│   │   ├── scroll-area.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── separator.tsx
│   │   ├── skeleton.tsx
│   │   ├── badge.tsx
│   │   └── sonner.tsx
│   └── lib/
│       ├── ai.ts                      # VisionProvider + ZaiProvider + MockProvider + buildDataUrl
│       ├── code-cleaner.ts            # cleanLlmResponse() — strips fences + prose
│       ├── codesandbox-export.ts      # buildCodeSandboxUrl() — base64 JSON sandbox
│       ├── db.ts                      # Prisma client singleton
│       ├── image-handler.ts           # validateImage() + saveImage()
│       ├── preview-builder.ts         # buildPreviewHtml() + adaptUserCode()
│       ├── utils.ts                    # cn() helper
│       ├── vision-prompt.ts           # buildVisionSystemPrompt()
│       └── __tests__/
│           ├── ai.test.ts
│           ├── code-cleaner.test.ts
│           ├── codesandbox-export.test.ts
│           ├── image-handler.test.ts
│           ├── preview-builder.test.ts
│           └── vision-prompt.test.ts
├── components.json                    # shadcn/ui config
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

---

## Case study

### Problem

Designers send screenshots. Engineers hand-write them into JSX + Tailwind, eyeballing spacing, color, and component structure. The translation is slow and lossy — and the screenshot itself rarely says "this is a shadcn Card with a CardHeader and a CardAction" so the engineer re-invents the structure from scratch every time.

### Approach

A vision-capable LLM (`zai.chat.completions.createVision`) reads the screenshot directly and emits a single React + Tailwind component that reproduces it. The system prompt explicitly enumerates the shadcn/ui primitives so the LLM organizes the JSX into idiomatic sub-shapes (Card with CardHeader / CardContent / CardFooter, Button with variant classes, etc.) when the screenshot clearly shows those patterns — even though the runtime doesn't have shadcn installed, the LLM inlines the equivalent Tailwind classes. The result is a component that drops into a real shadcn project almost unchanged.

### Key engineering decisions

1. **Live preview via `iframe srcDoc` (not Sandpack).** Sandpack would give us proper transpilation, HMR, and a real file tree — but it adds ~600KB to the bundle, requires a worker, and has its own opinion about how to mount the component. For MVP, a sandboxed `iframe` with React UMD + Babel standalone + Tailwind CDN scripts loaded via `srcDoc` is enough to see the component render and re-render on every edit. The debounce is 500ms so we don't post to `/api/preview` on every keystroke.

2. **`adaptUserCode()` strips imports and rewrites `export default`.** Babel standalone (loaded via CDN, no module system) can't handle `import` or `export default` in a plain `<script type="text/babel">` block. We rewrite `export default Foo;` → `const __Default = Foo;` and `export default () => ...` → `const __Default = () => ...` so the wrapper script can `ReactDOM.render(<__Default />, root)`. The user's `import React from "react"` (which the prompt forbids but the LLM sometimes adds anyway) is silently stripped because React is a global in the iframe.

3. **`cleanLlmResponse()` is post-hoc, not prompt-only.** Even though the prompt explicitly says "Return ONLY the JSX code, no markdown fences, no prose", vision LLMs are notorious for wrapping the code in ` ```jsx ... ``` ` or prefixing it with "Here is the component:". The cleaner strips fences (with an optional language tag) and any leading prose lines until we hit a line that looks like code (`const`, `function`, `import`, `export`, `//`, `/*`). It also strips trailing prose after the last `;` or `}`. Tested with fenced, prose-wrapped, and pass-through plain code.

4. **The screenshot is on disk, the path is in the DB.** Storing screenshots as BLOBs in SQLite bloats the DB file (and Prisma + SQLite gets unhappy past a few hundred MB). The DB only stores `uploads/<uuid>.<ext>`, and the Next.js static server under `public/` serves them at `/<uuid>.<ext>`. Deleting a conversion also `unlink()`s the file — best-effort, logged on failure.

5. **CodeSandbox export is pure, no API call.** The `define` URL is `?parameters=<base64(JSON{files})>`. The JSON contains `App.js`, `index.js`, `package.json`, `tailwind.config.js`, `postcss.config.js`, `tailwind.css`, and `public/index.html`. CodeSandbox reads the parameters, materializes the files, and boots the sandbox in a new tab. No API key, no rate limits, no round-trip — and it round-trips because `decodeCodeSandboxUrl(url)` decodes the base64 back into the files object (which is itself tested).

6. **The system prompt is the only thing that mentions shadcn.** The runtime has zero shadcn code — it's all inlined Tailwind via the LLM. This means the live preview renders correctly without installing shadcn, but the code the user copies out is shaped like shadcn code (Card with sub-components, Button with variant classes), so pasting it into a real shadcn project requires only deleting the inlined Tailwind and importing the real primitives. A real "shadcn-aware" mode (where the LLM emits `import { Card } from "@/components/ui/card"` and the preview imports shadcn via CDN) is a stretch goal.

### What I'd do differently

- **Real Sandpack integration.** The `iframe srcDoc` approach has no error overlay, no syntax highlighting in the editor, no HMR, and no proper file tree. Sandpack would give us all four. The cost is ~600KB and a worker; for a screenshot-to-code tool where users iterate on the generated code, that trade is worth it.
- **Figma import.** A "import from Figma URL" mode (using the Figma REST API to fetch the node tree, then a vision LLM call on a rendered PNG of the node) would skip the screenshot step entirely for designers who already have the design in Figma.
- **Multi-screen apps.** Right now one screenshot = one component. A multi-screenshot upload that produces a multi-route Next.js app (with shared layout, links, and a router) would be the natural next step.
- **Component-library matching.** Detect the design system in the screenshot (Material, Carbon, shadcn, Mantine) and emit the matching import lines. The preview iframe would then load that design system via CDN so the result looks pixel-identical. Currently we only match shadcn patterns in the prompt; we don't actually load shadcn in the preview.
- **Streaming code generation.** `zai.chat.completions.createVision` is non-streaming; we wait for the full response. With a streaming vision endpoint (or a separate text-only streaming call after the vision pass identifies the structure), we could render the code into the editor character-by-character as the LLM types it, which feels much more responsive.
- **Re-generate with edits as feedback.** "Re-generate from screenshot" currently re-runs the vision call cold. A "Re-generate but keep my edits as hints" mode that appends the user's current edited code to the prompt as "here is what I have so far, improve it" would let the LLM iterate with the user instead of from scratch.
- **Real-time collaboration.** The history sidebar is per-browser. A WebSocket-based "share this conversion" link (with cursors + edits broadcasting) would make this a multiplayer tool — and the existing schema already supports it (one row, many editors).

---

## Resume bullet

> Built a screenshot-to-code tool that calls a vision LLM (`zai.chat.completions.createVision`) on uploaded UI screenshots and produces a single React + Tailwind component reproducing them, with an editable code pane and a live `iframe srcDoc` preview (React UMD + Babel standalone + Tailwind CDN, debounced 500ms) — plus a one-click CodeSandbox export and a SQLite-backed history sidebar.

---

## License

MIT. Build it, fork it, ship it.

---

## Pushing to GitHub (one-time setup)

This repo is intentionally per-repo so it can be deployed independently. From your local clone:

```bash
# inside the screenshot-to-code directory
git init -b main
git add .
git commit -m "feat: Screenshot to Code Converter — Phase 7 Project #69

Vision-LLM-powered screenshot-to-React+Tailwind converter with:
- Drag-drop .png/.jpg/.webp upload, persisted to public/uploads/<uuid>.<ext>
- zai.chat.completions.createVision call with shadcn-aware system prompt
- cleanLlmResponse() strips markdown fences + prose
- Live preview via iframe srcDoc + React UMD + Babel standalone + Tailwind CDN (debounced 500ms)
- Editable code pane with edited badge, Copy / Save / Re-generate / Export toolbar
- CodeSandbox define-URL export (pure base64 JSON, no API call)
- SQLite-backed history sidebar (CRUD + screenshot unlink on delete)
- 74 unit tests across vision-prompt, image-handler, code-cleaner,
  preview-builder, codesandbox-export, ai (data URL + mock provider)"

# create the repo on GitHub first (web UI or `gh repo create`)
gh repo create screenshot-to-code --public --source=. --remote=origin --push

# or, if you prefer the manual flow:
git remote add origin git@github.com:YOUR_USERNAME/screenshot-to-code.git
git push -u origin main
```

If you want a single monorepo containing all 110 projects instead, structure it as `/apps/69-screenshot-to-code` in a pnpm workspace and adjust the `name` field in `package.json` accordingly.

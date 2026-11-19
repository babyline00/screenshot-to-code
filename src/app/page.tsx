"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Upload,
  Loader2,
  Copy,
  Save,
  RefreshCw,
  ExternalLink,
  PanelRightOpen,
  PanelRightClose,
  Trash2,
  Code2,
  Eye,
  Sparkles,
  History,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { buildCodeSandboxUrl } from "@/lib/codesandbox-export";

interface Conversion {
  id: string;
  screenshotPath: string;
  prompt: string;
  generatedCode: string;
  editedCode: string | null;
  componentName: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

interface ConvertResponse {
  id: string;
  screenshotPath: string;
  generatedCode: string;
  componentName: string;
  model: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

const ACCEPTED_TYPES = ".png,.jpg,.jpeg,.webp";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Page() {
  const [current, setCurrent] = React.useState<Conversion | null>(null);
  const [editedCode, setEditedCode] = React.useState<string>("");
  const [previewSrcDoc, setPreviewSrcDoc] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [history, setHistory] = React.useState<Conversion[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load history on mount.
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/conversions");
        if (res.ok) {
          const data = (await res.json()) as Conversion[];
          setHistory(data);
        }
      } catch (e) {
        console.warn("[history] load failed", e);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, []);

  // Debounced preview rebuild on code edit.
  React.useEffect(() => {
    if (!editedCode) {
      setPreviewSrcDoc("");
      return;
    }
    setPreviewError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: editedCode }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Preview build failed (${res.status})`);
        }
        const data = (await res.json()) as { html: string };
        setPreviewSrcDoc(data.html);
      } catch (e) {
        setPreviewError((e as Error).message);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [editedCode]);

  // -- File handling --------------------------------------------------------

  async function handleFile(file: File, mode: "convert" | "regenerate" = "convert") {
    if (mode === "convert") setLoading(true);
    else setRegenerating(true);
    try {
      const fd = new FormData();
      fd.append("screenshot", file);
      const res = await fetch("/api/convert", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Conversion failed (${res.status})`);
      }
      const data = (await res.json()) as ConvertResponse;
      const conv: Conversion = {
        id: data.id,
        screenshotPath: data.screenshotPath,
        prompt: data.prompt,
        generatedCode: data.generatedCode,
        editedCode: null,
        componentName: data.componentName,
        model: data.model,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
      setCurrent(conv);
      setEditedCode(data.generatedCode);
      // Refresh history
      const historyRes = await fetch("/api/conversions");
      if (historyRes.ok) setHistory((await historyRes.json()) as Conversion[]);
      toast.success(mode === "convert" ? "Code generated!" : "Re-generated from screenshot");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  // -- Toolbar actions ------------------------------------------------------

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(editedCode);
      toast.success("Code copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function onSave() {
    if (!current) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/conversions/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${res.status})`);
      }
      const updated = (await res.json()) as Conversion;
      setCurrent(updated);
      setHistory((h) =>
        h.map((c) => (c.id === updated.id ? { ...c, editedCode: updated.editedCode, updatedAt: updated.updatedAt } : c)),
      );
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function onExport() {
    if (!current) return;
    const url = buildCodeSandboxUrl(editedCode, current.componentName);
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Opened CodeSandbox in a new tab");
  }

  async function onRegenerate() {
    if (!current) return;
    // Re-fetch the screenshot from the stored path.
    try {
      const res = await fetch(`/${current.screenshotPath}`);
      if (!res.ok) throw new Error("Could not load original screenshot");
      const blob = await res.blob();
      const file = new File([blob], "screenshot.png", { type: blob.type || "image/png" });
      await handleFile(file, "regenerate");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onSelectHistory(id: string) {
    try {
      const res = await fetch(`/api/conversions/${id}`);
      if (!res.ok) throw new Error(`Could not load conversion (${res.status})`);
      const conv = (await res.json()) as Conversion;
      setCurrent(conv);
      setEditedCode(conv.editedCode ?? conv.generatedCode);
      toast.success(`Loaded "${conv.componentName}"`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onDeleteHistory(id: string) {
    if (!confirm("Delete this conversion? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/conversions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setHistory((h) => h.filter((c) => c.id !== id));
      if (current?.id === id) {
        setCurrent(null);
        setEditedCode("");
        setPreviewSrcDoc("");
      }
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-tight truncate">
                Screenshot to Code Converter
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block truncate">
                Upload a UI screenshot. Get a React + Tailwind component back.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden md:inline-flex">
              {history.length} saved
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label={sidebarOpen ? "Hide history" : "Show history"}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              {sidebarOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex min-h-0">
        {/* Main content */}
        <section className="flex-1 min-w-0 flex flex-col">
          {/* Drop zone — only visible when there's no current conversion */}
          {!current && !loading && (
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
              <label
                htmlFor="file-input"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={cn(
                  "w-full max-w-2xl aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all p-8 text-center",
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/30",
                )}
              >
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="size-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Drop a screenshot here</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  or <span className="text-primary font-medium underline-offset-4">click to upload</span> — PNG, JPG, WEBP supported
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="gap-1">
                    <ImageIcon className="size-3" /> UI screenshots
                  </Badge>
                  <Badge variant="outline">React + Tailwind</Badge>
                  <Badge variant="outline">shadcn/ui patterns</Badge>
                </div>
                <input
                  id="file-input"
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="sr-only"
                  onChange={onFileInputChange}
                />
              </label>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && !current && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-2xl space-y-4">
                <Skeleton className="aspect-video w-full rounded-2xl" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Analyzing screenshot and generating code...</span>
                </div>
              </div>
            </div>
          )}

          {/* Workspace — three-pane layout */}
          {current && (
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
              {/* Left: screenshot */}
              <div className="lg:col-span-3 min-h-0 flex flex-col">
                <Card className="flex-1 min-h-0 overflow-hidden">
                  <CardHeader className="border-b">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ImageIcon className="size-4" />
                      Screenshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 overflow-auto scroll-thin p-3">
                    <div className="relative w-full rounded-md overflow-hidden border bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/${current.screenshotPath}`}
                        alt="Original screenshot"
                        className="w-full h-auto block"
                      />
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Model</span>
                        <Badge variant="secondary">{current.model}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Component</span>
                        <code className="text-xs">{current.componentName}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Created</span>
                        <span>{formatDate(current.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Center: code editor + toolbar */}
              <div className="lg:col-span-5 min-h-0 flex flex-col">
                <Card className="flex-1 min-h-0 flex flex-col">
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Code2 className="size-4" />
                        JSX Code
                        {editedCode !== current.generatedCode && (
                          <Badge variant="outline" className="text-[10px]">
                            edited
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onCopy}
                          disabled={!editedCode}
                          aria-label="Copy code"
                        >
                          <Copy className="size-3.5" />
                          <span className="hidden sm:inline">Copy</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onSave}
                          disabled={saving || !editedCode}
                          aria-label="Save edited code"
                        >
                          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                          <span className="hidden sm:inline">Save</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onExport}
                          disabled={!editedCode}
                          aria-label="Export to CodeSandbox"
                        >
                          <ExternalLink className="size-3.5" />
                          <span className="hidden sm:inline">Export</span>
                        </Button>
                        <Separator orientation="vertical" className="h-5 mx-1" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={onRegenerate}
                          disabled={regenerating}
                          aria-label="Re-generate from screenshot"
                        >
                          {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                          <span className="hidden sm:inline">Re-generate</span>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 p-0">
                    <Textarea
                      value={editedCode}
                      onChange={(e) => setEditedCode(e.target.value)}
                      spellCheck={false}
                      aria-label="Editable JSX code"
                      className="resize-none rounded-none border-0 font-mono text-xs leading-relaxed h-full min-h-full bg-transparent focus-visible:ring-0"
                      style={{ minHeight: "100%" }}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right: live preview */}
              <div className="lg:col-span-4 min-h-0 flex flex-col">
                <Card className="flex-1 min-h-0 flex flex-col">
                  <CardHeader className="border-b">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="size-4" />
                      Live Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 p-3">
                    {previewError ? (
                      <div className="h-full flex items-center justify-center text-sm text-destructive p-4 text-center">
                        {previewError}
                      </div>
                    ) : (
                      <iframe
                        title="Live preview"
                        srcDoc={previewSrcDoc}
                        sandbox="allow-scripts allow-same-origin"
                        className="w-full h-full rounded-md border bg-white"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar — history */}
        {sidebarOpen && (
          <aside className="w-72 shrink-0 border-l bg-card/30 flex-col hidden lg:flex">
            <div className="h-14 border-b flex items-center px-4 gap-2">
              <History className="size-4" />
              <h2 className="text-sm font-semibold">History</h2>
              <span className="ml-auto text-xs text-muted-foreground">{history.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
              {loadingHistory ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <ImageIcon className="size-8 mx-auto mb-2 opacity-40" />
                  No conversions yet.
                  <br />
                  Upload a screenshot to get started.
                </div>
              ) : (
                <ul className="p-2 space-y-1">
                  {history.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => onSelectHistory(c.id)}
                        className={cn(
                          "w-full text-left rounded-md p-2 transition-colors flex gap-2 items-start group",
                          current?.id === c.id
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-accent border border-transparent",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/${c.screenshotPath}`}
                          alt=""
                          className="size-12 rounded object-cover border bg-muted shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{c.componentName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatDate(c.createdAt)}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {c.model}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteHistory(c.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded shrink-0"
                          aria-label="Delete conversion"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t p-3">
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => {
                  setCurrent(null);
                  setEditedCode("");
                  setPreviewSrcDoc("");
                }}
              >
                <Upload className="size-3.5" />
                New screenshot
              </Button>
            </div>
          </aside>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/30">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Vision LLM <code className="font-mono">z-ai-web-dev-sdk</code> &middot; Live preview via iframe <code className="font-mono">srcDoc</code> + Babel standalone
          </span>
          <span className="hidden sm:inline">
            {previewSrcDoc ? "Preview rendered" : "Awaiting code"}
          </span>
        </div>
      </footer>
    </div>
  );
}

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { useState } from "react"
import type { CSSProperties } from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import "./workspace-code-viewer.css"

// Adapt Babylon's actual source-viewer palette (src/custom/editor.css) while
// retaining this static Prism viewer. The lighter palette keeps the same hues
// with sufficient contrast on a soft, non-white canvas.
const workspacePalettes = {
  dark: {
    background: "#0b0e14",
    foreground: "#e0e7f0",
    keyword: "#c5a0f0",
    modifier: "#87b6fb",
    type: "#70d6c6",
    function: "#e7ca86",
    comment: "#93a2ac",
    string: "#d6b58d",
    number: "#92d5ac",
    punctuation: "#b6c5db",
  },
  light: {
    background: "#f6f8fb",
    foreground: "#283444",
    keyword: "#6f479a",
    modifier: "#285d91",
    type: "#176e66",
    function: "#786022",
    comment: "#586676",
    string: "#87582f",
    number: "#276746",
    punctuation: "#4c5c70",
  },
}

function workspaceSyntaxTheme(palette: typeof workspacePalettes.dark): Record<string, CSSProperties> {
  const sourceStyle: CSSProperties = {
    color: palette.foreground,
    textShadow: "none",
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    textAlign: "left",
    direction: "ltr",
    tabSize: 2,
    cursor: "default",
    caretColor: "transparent",
    userSelect: "text",
  }

  return {
    'code[class*="language-"]': { ...sourceStyle, background: "transparent" },
    'pre[class*="language-"]': { ...sourceStyle, background: palette.background, overflow: "auto" },
    comment: { color: palette.comment, fontStyle: "italic" },
    prolog: { color: palette.comment },
    cdata: { color: palette.comment },
    keyword: { color: palette.keyword },
    atrule: { color: palette.keyword },
    modifier: { color: palette.modifier },
    operator: { color: palette.modifier },
    builtin: { color: palette.type },
    "class-name": { color: palette.type },
    function: { color: palette.function },
    "function-variable": { color: palette.function },
    string: { color: palette.string },
    char: { color: palette.string },
    regex: { color: palette.string },
    number: { color: palette.number },
    boolean: { color: palette.number },
    constant: { color: palette.number },
    punctuation: { color: palette.punctuation },
    variable: { color: palette.foreground },
    property: { color: palette.foreground },
    namespace: { color: palette.foreground },
  }
}

const workspaceThemes = {
  dark: workspaceSyntaxTheme(workspacePalettes.dark),
  light: workspaceSyntaxTheme(workspacePalettes.light),
}

interface CodeBlockProps {
  code: string
  language?: "solidity" | "typescript" | "bash" | "javascript"
  className?: string
  showCopyButton?: boolean
  presentation?: "classic" | "workspace"
}

export function CodeBlock({ 
  code, 
  language = "solidity", 
  className,
  showCopyButton = true,
  presentation = "classic",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === "dark" ? "dark" : "light"
  const isWorkspace = presentation === "workspace"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopyError(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 3000)
    }
  }

  return (
    <div
      className={cn("relative group", isWorkspace && "workspace-code-viewer", className)}
      data-code-theme={isWorkspace ? theme : undefined}
      style={isWorkspace ? { background: workspacePalettes[theme].background } : undefined}
    >
      {showCopyButton && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={copyError ? "Copy failed" : copied ? "Copied" : "Copy code"}
          className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-muted group-hover:bg-muted"
          onClick={handleCopy}
        >
          {copyError ? (
            <span className="text-xs text-destructive">Copy failed</span>
          ) : copied ? (
            <>
              <Check className="size-4 mr-1 text-green-500" />
              <span className="text-xs text-green-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-4 mr-1" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </Button>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {copyError ? "Copy failed. Select the code manually." : copied ? "Code copied." : ""}
      </span>
      <SyntaxHighlighter
        language={language}
        style={isWorkspace ? workspaceThemes[theme] : theme === "dark" ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: "1rem",
          borderRadius: isWorkspace ? 0 : "0.5rem",
          fontSize: "0.75rem",
          lineHeight: isWorkspace ? "1.65" : "1.5",
          ...(isWorkspace ? { minHeight: "100%" } : {}),
        }}
        wrapLines={true}
        wrapLongLines={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

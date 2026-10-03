import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { useState } from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface CodeBlockProps {
  code: string
  language?: "solidity" | "typescript" | "bash" | "javascript"
  className?: string
  showCopyButton?: boolean
}

export function CodeBlock({ 
  code, 
  language = "solidity", 
  className,
  showCopyButton = true 
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const { resolvedTheme } = useTheme()

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
    <div className={cn("relative group", className)}>
      {showCopyButton && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={copyError ? "Copy failed" : copied ? "Copied" : "Copy code"}
          className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
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
         style={resolvedTheme === "dark" ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: "1rem",
          borderRadius: "0.5rem",
          fontSize: "0.75rem",
          lineHeight: "1.5",
        }}
        wrapLines={true}
        wrapLongLines={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

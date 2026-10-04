import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { CodeBlock } from "./code-block"

const themeState = vi.hoisted(() => ({ resolvedTheme: "dark" }))
vi.mock("next-themes", () => ({ useTheme: () => themeState }))

const source = `// Read-only source review
pragma solidity ^0.8.30;
contract Counter {
    uint256 public count = 1;
    string public name = "Counter";
    bool public enabled = true;
    function increment() external { count += 1; }
}
`

function normalizedColor(color: string) {
  const element = document.createElement("span")
  element.style.color = color
  return element.style.color
}

function luminance(color: string) {
  const channels = normalizedColor(color).match(/[\d.]+/g)!.slice(0, 3).map(Number)
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => a - b)
  return (values[1] + 0.05) / (values[0] + 0.05)
}

beforeEach(() => { themeState.resolvedTheme = "dark" })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe.each([
  { theme: "dark", background: "#0b0e14", keyword: "#c5a0f0", comment: "#93a2ac" },
  { theme: "light", background: "#f6f8fb", keyword: "#6f479a", comment: "#586676" },
])("Workspace $theme source viewer", ({ theme, background, keyword, comment }) => {
  it("uses a flat, full-height canvas with readable syntax colors", () => {
    themeState.resolvedTheme = theme
    const { container } = render(<CodeBlock code={source} presentation="workspace" />)
    const wrapper = container.querySelector<HTMLElement>(".workspace-code-viewer")!
    const pre = container.querySelector("pre")!
    const code = container.querySelector("code")!

    expect(wrapper.dataset.codeTheme).toBe(theme)
    expect(wrapper.style.background).toBe(normalizedColor(background))
    expect(pre.style.background).toBe(normalizedColor(background))
    expect(pre.style.textShadow).toBe("none")
    expect(pre.style.minHeight).toBe("100%")
    expect(pre.style.borderRadius).toBe("0px")
    expect(code.style.background).toBe("transparent")
    expect(code.style.textShadow).toBe("none")

    const syntaxColors = Array.from(code.querySelectorAll<HTMLElement>("span"))
      .map((span) => span.style.color).filter(Boolean)
    expect(syntaxColors).toContain(normalizedColor(keyword))
    expect(syntaxColors).toContain(normalizedColor(comment))
    for (const color of [pre.style.color, ...syntaxColors]) {
      expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("keeps static source selectable and scrollable without an editing caret or input", () => {
    themeState.resolvedTheme = theme
    const { container } = render(<CodeBlock code={source} presentation="workspace" />)
    const pre = container.querySelector("pre")!
    const code = container.querySelector("code")!

    expect(code.textContent).toBe(source)
    expect(container.querySelector('input, textarea, [role="textbox"], [contenteditable]')).toBeNull()
    expect(pre.hasAttribute("tabindex")).toBe(false)
    expect(code.hasAttribute("tabindex")).toBe(false)
    for (const element of [pre, code]) {
      expect(element.style.cursor).toBe("default")
      expect(element.style.caretColor).toBe("transparent")
      expect(element.style.userSelect).toBe("text")
      expect(element.style.pointerEvents).not.toBe("none")
    }
    expect(pre.style.overflow).toBe("auto")
    fireEvent.click(code)
    fireEvent.keyDown(code, { key: "x" })
    expect(document.activeElement).not.toBe(code)
    expect(code.textContent).toBe(source)
  })

  it("copies the exact source through its accessible copy button", async () => {
    themeState.resolvedTheme = theme
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    render(<CodeBlock code={source} presentation="workspace" />)
    const copy = screen.getByRole("button", { name: "Copy code" })
    copy.focus()
    expect(document.activeElement).toBe(copy)
    fireEvent.click(copy)
    await screen.findByRole("button", { name: "Copied" })
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source)
    expect(screen.getByRole("status").textContent).toBe("Code copied.")
  })
})

it("keeps manual selection available when clipboard access fails", async () => {
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } })
  const { container } = render(<CodeBlock code={source} presentation="workspace" />)
  fireEvent.click(screen.getByRole("button", { name: "Copy code" }))
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copy failed. Select the code manually."))
  expect(container.querySelector("code")!.style.userSelect).toBe("text")
})

it.each(["light", "dark"])("preserves the existing classic %s presentation by default", (theme) => {
  themeState.resolvedTheme = theme
  const { container } = render(<CodeBlock code={source} />)
  const pre = container.querySelector("pre")!
  const original = theme === "dark" ? oneDark : oneLight
  expect(container.querySelector(".workspace-code-viewer")).toBeNull()
  expect(pre.style.background).toBe(normalizedColor(original['pre[class*="language-"]'].background as string))
  expect(pre.style.borderRadius).toBe("0.5rem")
  expect(pre.style.lineHeight).toBe("1.5")
  expect(pre.style.cursor).toBe("")
})

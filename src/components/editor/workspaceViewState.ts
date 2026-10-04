import { useCallback, useEffect, useMemo, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

const DEFAULT_FILE = "src/Diamond.sol"
const STORAGE_PREFIX = "compose-launchpad:workspace:source:"

/** Only the source paths exposed by the project explorer may be restored. */
function isDisplayPath(value: unknown): value is string {
  return typeof value === "string" && (
    value === DEFAULT_FILE ||
    value === "script/Deploy.s.sol" ||
    value === "scripts/deploy.ts" ||
    /^src\/facets\/[A-Za-z_$][\w$]*\.sol$/.test(value)
  )
}

function storageKey(projectId: string, kind: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(projectId)}:${kind}`
}

function readStored(key: string): unknown {
  try {
    const value = window.sessionStorage.getItem(key)
    return value === null ? undefined : JSON.parse(value)
  } catch {
    // Private browsing, a disabled storage policy, and stale data are harmless.
    return undefined
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // The live view continues to work when browser storage is unavailable.
  }
}

/** Workspace restores per-project selections; Classic keeps its local useState behavior. */
export function useProjectFileSelection(
  projectId: string | undefined,
  persist: boolean,
): [string, Dispatch<SetStateAction<string>>] {
  const scope = persist ? `workspace:${projectId ?? ""}` : "classic"
  const [selections, setSelections] = useState(() => new Map<string, string>())
  const initialFile = useMemo(() => {
    if (!persist || !projectId) return DEFAULT_FILE
    const saved = readStored(storageKey(projectId, "selected"))
    return isDisplayPath(saved) ? saved : DEFAULT_FILE
  }, [persist, projectId])
  const selectedFile = selections.get(scope) ?? initialFile

  useEffect(() => {
    if (persist && projectId) writeStored(storageKey(projectId, "selected"), selectedFile)
  }, [persist, projectId, selectedFile])

  const setSelectedFile = useCallback<Dispatch<SetStateAction<string>>>((update) => {
    setSelections((current) => {
      const previous = current.get(scope) ?? initialFile
      const next = typeof update === "function" ? update(previous) : update
      if (!isDisplayPath(next) || current.get(scope) === next) return current
      return new Map(current).set(scope, next)
    })
  }, [initialFile, scope])

  return [selectedFile, setSelectedFile]
}

export type WorkspaceScrollPosition = { top: number; left: number }

export function readWorkspaceScroll(projectId: string | undefined, filePath: string): WorkspaceScrollPosition {
  const saved = projectId && isDisplayPath(filePath)
    ? readStored(storageKey(projectId, `scroll:${encodeURIComponent(filePath)}`))
    : undefined
  if (saved && typeof saved === "object" && "top" in saved && "left" in saved &&
    typeof saved.top === "number" && Number.isFinite(saved.top) && saved.top >= 0 &&
    typeof saved.left === "number" && Number.isFinite(saved.left) && saved.left >= 0) {
    return { top: saved.top, left: saved.left }
  }
  return { top: 0, left: 0 }
}

export function writeWorkspaceScroll(projectId: string | undefined, filePath: string, position: WorkspaceScrollPosition) {
  if (projectId && isDisplayPath(filePath)) {
    writeStored(storageKey(projectId, `scroll:${encodeURIComponent(filePath)}`), position)
  }
}

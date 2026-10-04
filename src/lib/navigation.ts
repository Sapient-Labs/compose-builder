export type LaunchpadPage = "classic" | "workspace"

export function pageFromHash(hash: string): LaunchpadPage {
  return ["#/workspace", "#/workspace/project"].includes(hash.replace(/\/$/, "")) ? "workspace" : "classic"
}

export function subscribeToNavigation(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

export const getPageSnapshot = () => pageFromHash(window.location.hash)


export type WorkspaceMode = "builder" | "project"
export const workspaceModeFromHash = (hash: string): WorkspaceMode =>
  hash.replace(/\/$/, "") === "#/workspace/project" ? "project" : "builder"
export const getWorkspaceModeSnapshot = () => workspaceModeFromHash(window.location.hash)

export function navigateWorkspace(mode: WorkspaceMode) {
  const hash = mode === "project" ? "#/workspace/project" : "#/workspace"
  if (window.location.hash === hash) return
  window.history.pushState(null, "", hash)
  window.dispatchEvent(new HashChangeEvent("hashchange"))
}

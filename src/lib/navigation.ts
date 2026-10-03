export type LaunchpadPage = "classic" | "workspace"

export function pageFromHash(hash: string): LaunchpadPage {
  return hash.replace(/\/$/, "") === "#/workspace" ? "workspace" : "classic"
}

export function subscribeToNavigation(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

export const getPageSnapshot = () => pageFromHash(window.location.hash)

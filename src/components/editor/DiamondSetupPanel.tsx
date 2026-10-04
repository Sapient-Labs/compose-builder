import { useId, useMemo, useState } from "react"
import { ArrowRight, Gem } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EMPTY_BASE, getAccessBases, getAvailableLibraryFacets, planComposition } from "@/lib/compose-core"
import { updateWorkspaceConfig } from "@/lib/compose-core/workspaceConfig"
import { useLaunchpadStore } from "@/lib/state/store"
import type { FacetEntry } from "@/types/catalog"
import type { DiamondConfig } from "@/types/config"

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value]

function FacetChoices({
  legend,
  entries,
  selected,
  onChange,
  required = false,
}: {
  legend: string
  entries: [string, FacetEntry][]
  selected: string[]
  onChange?: (names: string[]) => void
  required?: boolean
}) {
  const id = useId()
  if (!entries.length) return null

  return (
    <fieldset className="min-w-0 border-b pb-3">
      <legend className="mb-2 w-full text-xs font-semibold">
        {legend}
        <span className="ml-1.5 font-normal text-muted-foreground">
          {required ? entries.length : `${entries.filter(([name]) => selected.includes(name)).length}/${entries.length}`}
        </span>
      </legend>
      <div className="grid gap-1">
        {entries.map(([name, entry], index) => (
          <label
            key={name}
            htmlFor={`${id}-${index}`}
            title={entry.label ? `${entry.label} · ${name}` : name}
            className={`flex min-w-0 items-start gap-2 rounded px-1 py-1.5 text-[11px] leading-4 ${required ? "text-muted-foreground" : "cursor-pointer hover:bg-accent/60"}`}
          >
            <Checkbox
              id={`${id}-${index}`}
              checked={required || selected.includes(name)}
              disabled={required}
              aria-label={required ? `${name} (required)` : name}
              className="mt-px size-3.5"
              onCheckedChange={() => onChange?.(toggle(selected, name))}
            />
            <span className="min-w-0 break-all font-mono">{name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Inline configuration for the existing project on the Workspace page. */
export function DiamondSetupPanel({ onReview }: { onReview?: () => void }) {
  const id = useId()
  const { catalog, activeProject, setConfig, setViewMode } = useLaunchpadStore()
  const config = activeProject?.config
  const [error, setError] = useState("")

  const preview = useMemo(() => {
    if (!catalog || !config) return { plan: null, error: "" }
    try {
      return { plan: planComposition(catalog, config), error: "" }
    } catch (cause) {
      return {
        plan: null,
        error: cause instanceof Error ? cause.message : "This configuration could not be resolved.",
      }
    }
  }, [catalog, config])

  if (!catalog || !config) return null

  const bases = Object.entries(catalog.features).filter(([, definition]) => !definition.access && definition.visible !== false)
  const base = config.baseKey === "none" ? EMPTY_BASE : catalog.features[config.baseKey] ?? EMPTY_BASE
  const accessBases = Object.entries(getAccessBases(catalog, config.baseKey))
  const ownership = accessBases.filter(([, definition]) => definition.accessType === "ownership")
  const roles = accessBases.filter(([, definition]) => definition.accessType !== "ownership")
  const selectedOwner = ownership.filter(([key]) => config.selectedAccess.includes(key)).at(-1)?.[0] ?? "none"
  const libraries = Object.entries(getAvailableLibraryFacets(catalog, base))
  const { plan } = preview

  const update = (patch: Partial<DiamondConfig>) => {
    try {
      const next = updateWorkspaceConfig(catalog, config, patch)
      planComposition(catalog, next)
      setConfig(next)
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This selection could not be applied.")
    }
  }

  const review = () => {
    try {
      planComposition(catalog, config)
      setError("")
      if (onReview) onReview()
      else setViewMode("project")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review your configuration before continuing.")
    }
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-background" aria-labelledby={`${id}-title`}>
      <header className="shrink-0 border-b px-3 py-3">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold">
          <Gem className="size-4 text-primary" aria-hidden="true" />
          Configure diamond
        </h2>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Changes update your current project.</p>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor={`${id}-base`} className="block text-xs font-semibold">Base</label>
            <Select value={config.baseKey} onValueChange={(baseKey) => update({ baseKey })}>
              <SelectTrigger id={`${id}-base`} className="w-full min-w-0 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None · Blank diamond</SelectItem>
                {bases.map(([key, definition]) => (
                  <SelectItem key={key} value={key}>{definition.label}{definition.standard ? ` · ${definition.standard}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {ownership.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor={`${id}-owner`} className="block text-xs font-semibold">Ownership</label>
              <Select
                value={selectedOwner}
                onValueChange={(value) => {
                  const otherAccess = config.selectedAccess.filter((key) => !ownership.some(([ownerKey]) => ownerKey === key))
                  update({ selectedAccess: value === "none" ? otherAccess : [...otherAccess, value] })
                }}
              >
                <SelectTrigger id={`${id}-owner`} className="w-full min-w-0 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ownership.map(([key, definition]) => <SelectItem key={key} value={key}>{definition.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {roles.length > 0 && (
          <fieldset className="min-w-0 border-b pb-3">
            <legend className="mb-2 text-xs font-semibold">Roles</legend>
            <div className="grid gap-1">
              {roles.map(([key, definition]) => (
                <label key={key} htmlFor={`${id}-role-${key}`} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-xs hover:bg-accent/60">
                  <Checkbox id={`${id}-role-${key}`} checked={config.selectedAccess.includes(key)} className="size-3.5" onCheckedChange={() => update({ selectedAccess: toggle(config.selectedAccess, key) })} />
                  <span className="min-w-0 break-words">{definition.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <FacetChoices legend="Required facets" entries={plan?.requiredFacets.map(({ name, entry }) => [name, entry]) ?? []} selected={[]} required />
        <FacetChoices legend="Optional facets" entries={Object.entries(base.optional)} selected={config.selectedExtensions} onChange={(selectedExtensions) => update({ selectedExtensions })} />
        <FacetChoices legend="Access extensions" entries={Object.entries(plan?.availableAccessExtensions ?? {})} selected={config.selectedAccessExtensions} onChange={(selectedAccessExtensions) => update({ selectedAccessExtensions })} />
        <FacetChoices legend="Libraries" entries={libraries} selected={config.selectedLibraries} onChange={(selectedLibraries) => update({ selectedLibraries })} />

        {config.selectedLibraries.includes("DiamondUpgradeFacet") && selectedOwner === "none" && (
          <p className="text-[11px] leading-4 text-muted-foreground">Upgrade requires an initialized owner. Choose ownership or configure it in the source.</p>
        )}
      </div>

      <footer className="shrink-0 space-y-2 border-t bg-background px-3 py-3">
        {(error || preview.error) && <p className="break-words text-xs text-destructive" role="alert">{error || preview.error}</p>}
        <Button size="sm" className="h-8 w-full text-xs" onClick={review} disabled={!plan}>
          Review project
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </footer>
    </section>
  )
}

import { useState, useMemo } from "react"
import { useLaunchpadStore } from "@/lib/state/store"
import { getAccessBases, getAvailableLibraryFacets, planComposition, EMPTY_BASE } from "@/lib/compose-core"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CollapsibleSection } from "@/components/ui/collapsible"
import { SearchInput } from "@/components/ui/search-input"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  Layers,
  Puzzle,
  Library,
  Shield,
  User,
  Users,
  ArrowRight,
  Check
} from "lucide-react"

function accessExtensionLabel(name: string): string {
  const withoutSuffix = name.replace(/Facet$/, "")
  if (withoutSuffix.startsWith("Owner")) {
    return `${humanizeFacetName(withoutSuffix.slice("Owner".length))} Ownership`
  }
  if (withoutSuffix.startsWith("AccessControl")) {
    return `Access ${humanizeFacetName(withoutSuffix.slice("AccessControl".length))}`
  }
  return humanizeFacetName(withoutSuffix)
}

function humanizeFacetName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Two Step/g, "Two-Step")
    .trim()
}

export function ConfigPanel({ onReview }: { onReview?: () => void }) {
  const { catalog, activeProject, setConfig, setViewMode } = useLaunchpadStore()
  const config = activeProject?.config
  const [facetSearch, setFacetSearch] = useState("")
  const [librarySearch, setLibrarySearch] = useState("")

  const features = useMemo(() => {
    if (!catalog) return []
    return Object.entries(catalog.features)
      .filter(([, def]) => !def.access && def.visible !== false)
  }, [catalog])

  const selectedBase = useMemo(() => {
    if (!catalog) return EMPTY_BASE
    return config?.baseKey === "none"
      ? EMPTY_BASE
      : catalog.features[config?.baseKey ?? "none"]
  }, [catalog, config?.baseKey])

  const availableExtensions = useMemo(() => {
    if (!catalog) return []
    return Object.entries(selectedBase.optional)
  }, [catalog, selectedBase])

  const availableLibraries = useMemo(() => {
    if (!catalog) return []
    return Object.entries(
      getAvailableLibraryFacets(catalog, selectedBase)
    )
  }, [catalog, selectedBase])

  const accessBases = useMemo(() => {
    if (!catalog) return []
    return Object.entries(getAccessBases(catalog, config?.baseKey))
  }, [catalog, config?.baseKey])

  const availableAccessExtensions = useMemo(() => {
    if (!catalog || !config || config.selectedAccess.length === 0) return []
    return Object.entries(planComposition(catalog, config).availableAccessExtensions)
  }, [catalog, config])

  // Filter facets by search
  const filteredExtensions = useMemo(() => {
    if (!facetSearch) return availableExtensions
    const query = facetSearch.toLowerCase()
    return availableExtensions.filter(
      ([name, entry]) =>
        name.toLowerCase().includes(query) ||
        (entry.label ?? "").toLowerCase().includes(query)
    )
  }, [availableExtensions, facetSearch])

  const filteredLibraries = useMemo(() => {
    if (!librarySearch) return availableLibraries
    const query = librarySearch.toLowerCase()
    return availableLibraries.filter(
      ([name, entry]) =>
        name.toLowerCase().includes(query) ||
        (entry.label ?? "").toLowerCase().includes(query)
    )
  }, [availableLibraries, librarySearch])

  if (!catalog || !config) return null

  return (
    <div className="relative h-full bg-background">
      <div className="h-full overflow-y-auto pb-20">
        <div className="w-full">
        <div className="p-3 border-b">
          <h1 className="text-sm font-semibold flex items-center gap-2">
            Build your smart contract project
          </h1>
        </div>

        <div className="p-2 space-y-0.5">
        {/* Base Selection - Always Open */}
        <CollapsibleSection 
            title="Starting point"
          defaultOpen={true}
          icon={Layers}
          badge={
            <Badge variant="secondary" className="ml-auto animate-in fade-in">
              {config.baseKey === "none"
                ? "Blank project"
                : selectedBase.standard
                  ? `${selectedBase.label} · ${selectedBase.standard}`
                  : selectedBase.label}
            </Badge>
          }
        >
          <div className="space-y-2 pt-2">
            <Button
              variant={config.baseKey === "none" ? "default" : "outline"}
              size="sm"
              className="w-full justify-start h-7 px-2.5 text-xs transition-all hover:scale-[1.02]"
              onClick={() => setConfig({
                baseKey: "none",
                selectedExtensions: [],
                selectedAccess: [],
                selectedAccessExtensions: [],
              })}
            >
              Blank project
            </Button>
            {features.map(([key, definition]) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Button
                    variant={config.baseKey === key ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-between h-7 px-2.5 text-xs transition-all hover:scale-[1.02]"
                    onClick={() => setConfig({
                      baseKey: key,
                      selectedExtensions: [],
                      selectedAccess: [],
                      selectedAccessExtensions: [],
                    })}
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate">{definition.label}</span>
                      {definition.standard && (
                        <span
                          className={cn(
                            "text-xs font-normal opacity-70",
                            config.baseKey !== key && "text-muted-foreground",
                          )}
                        >
                          {definition.standard}
                        </span>
                      )}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "ml-2",
                        config.baseKey === key &&
                          "border-primary-foreground/50 text-primary-foreground",
                      )}
                    >
                      {Object.keys(definition.required).length + Object.keys(definition.optional).length}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>
                    {definition.label}
                    {definition.standard ? ` (${definition.standard})` : ""} -{" "}
                    {Object.keys(definition.required).length} required,{" "}
                    {Object.keys(definition.optional).length} optional
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </CollapsibleSection>

        {/* Optional Facets */}
        {availableExtensions.length > 0 && (
          <CollapsibleSection 
            title="Optional Features"
            defaultOpen={false}
            icon={Puzzle}
            badge={
              config.selectedExtensions.length > 0 && (
                <Badge variant="secondary" className="ml-auto animate-in zoom-in">
                  {config.selectedExtensions.length}
                </Badge>
              )
            }
          >
            <div className="space-y-2 pt-2">
              {availableExtensions.length > 3 && (
                <SearchInput
                  value={facetSearch}
                  onChange={setFacetSearch}
                  placeholder="Search facets..."
                  className="mb-2"
                />
              )}
              {filteredExtensions.map(([name, entry]) => {
                const isSelected = config.selectedExtensions.includes(name)

                return (
                  <Tooltip key={name}>
                    <TooltipTrigger asChild>
                      <div
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected 
                            ? "border-primary bg-primary/5 shadow-sm" 
                            : "hover:bg-accent/50 hover:border-accent-foreground/20"
                        )}
                        onClick={() => {
                          const newExtensions = isSelected
                            ? config.selectedExtensions.filter((f) => f !== name)
                            : [...config.selectedExtensions, name]
                          setConfig({ selectedExtensions: newExtensions })
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            event.currentTarget.click()
                          }
                        }}
                      >
                        <span aria-hidden="true" className="pointer-events-none">
                          <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", isSelected && "border-primary bg-primary text-primary-foreground")}>
                            {isSelected && <Check className="size-3.5" />}
                          </span>
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium">{entry.label ?? name}</span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="font-medium">{entry.label ?? name}</p>
                      <p className="text-xs opacity-80 mt-0.5 font-mono">{name}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
              {filteredExtensions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No facets match "{facetSearch}"
                </p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Libraries */}
        {availableLibraries.length > 0 && (
          <CollapsibleSection 
            title="Libraries and Dependencies"
            defaultOpen={false}
            icon={Library}
            badge={
              config.selectedLibraries.length > 0 && (
                <Badge variant="secondary" className="ml-auto animate-in zoom-in">
                  {config.selectedLibraries.length}
                </Badge>
              )
            }
          >
            <div className="space-y-2 pt-2">
              {availableLibraries.length > 3 && (
                <SearchInput
                  value={librarySearch}
                  onChange={setLibrarySearch}
                  placeholder="Search libraries and dependencies..."
                  className="mb-2"
                />
              )}
              {filteredLibraries.map(([name, entry]) => {
                const isSelected = config.selectedLibraries.includes(name)

                return (
                  <div
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    key={name}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected 
                        ? "border-primary bg-primary/5 shadow-sm" 
                        : "hover:bg-accent/50 hover:border-accent-foreground/20"
                    )}
                    onClick={() => {
                      const newLibraries = isSelected
                        ? config.selectedLibraries.filter((f) => f !== name)
                        : [...config.selectedLibraries, name]
                      setConfig({ selectedLibraries: newLibraries })
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.currentTarget.click()
                      }
                    }}
                  >
                    <span aria-hidden="true" className="pointer-events-none">
                      <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", isSelected && "border-primary bg-primary text-primary-foreground")}>
                        {isSelected && <Check className="size-3.5" />}
                      </span>
                    </span>
                    <span className="text-xs font-medium">{entry.label ?? name}</span>
                  </div>
                )
              })}
              {filteredLibraries.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No libraries match "{librarySearch}"
                </p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Access Control */}
        {accessBases.length > 0 && (
          <CollapsibleSection 
            title="Permissions"
            defaultOpen={false}
            icon={Shield}
            badge={
              config.selectedAccess.length > 0 && (
                <Badge variant="secondary" className="ml-auto animate-in zoom-in">
                  {config.selectedAccess.length}
                </Badge>
              )
            }
          >
            <div className="space-y-4 pt-2">
              {/* Ownership */}
              {accessBases.filter(([, def]) => def.accessType === "ownership").length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <User className="size-3" />
                    Ownership
                  </div>
                  {accessBases
                    .filter(([, def]) => def.accessType === "ownership")
                    .map(([key, definition]) => {
                      const isSelected = config.selectedAccess.includes(key)
                      return (
                        <Button
                          key={key}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="w-full justify-start h-7 px-2.5 text-xs transition-all hover:scale-[1.02]"
                          onClick={() => {
                            const newAccess = isSelected
                              ? config.selectedAccess.filter((a) => a !== key)
                              : [
                                  ...config.selectedAccess.filter(
                                    (a) =>
                                      !accessBases.some(
                                        ([accessKey, accessDefinition]) =>
                                          accessKey === a &&
                                          accessDefinition.accessType === "ownership"
                                      )
                                  ),
                                  key,
                                ]
                            setConfig({
                              selectedAccess: newAccess,
                              selectedAccessExtensions: [],
                            })
                          }}
                        >
                          {definition.label}
                        </Button>
                      )
                    })}
                </div>
              )}

              {/* Role-Based */}
              {accessBases.filter(([, def]) => def.accessType === "roles" || !def.accessType).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Users className="size-3" />
                    Role-Based
                  </div>
                  {accessBases
                    .filter(([, def]) => def.accessType === "roles" || !def.accessType)
                    .map(([key, definition]) => {
                      const isSelected = config.selectedAccess.includes(key)
                      return (
                        <Button
                          key={key}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="w-full justify-start h-7 px-2.5 text-xs transition-all hover:scale-[1.02]"
                          onClick={() => {
                            const newAccess = isSelected
                              ? config.selectedAccess.filter((a) => a !== key)
                              : [...config.selectedAccess, key]
                            setConfig({
                              selectedAccess: newAccess,
                              selectedAccessExtensions: [],
                            })
                          }}
                        >
                          {definition.label}
                        </Button>
                      )
                    })}
                </div>
              )}

              {availableAccessExtensions.length > 0 && (
                <div className="space-y-3 border-t pt-5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Puzzle className="size-3" />
                    Permissions Extensions
                    {config.selectedAccessExtensions.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {config.selectedAccessExtensions.length}
                      </Badge>
                    )}
                  </div>
                  {availableAccessExtensions.map(([name]) => {
                    const isSelected = config.selectedAccessExtensions.includes(name)
                    const label = accessExtensionLabel(name)

                    return (
                      <Tooltip key={name}>
                        <TooltipTrigger asChild>
                          <div
                            role="checkbox"
                            aria-checked={isSelected}
                            tabIndex={0}
                            className={cn(
                              "flex items-start gap-2 rounded-md border p-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "hover:bg-accent/50 hover:border-accent-foreground/20",
                            )}
                            onClick={() => {
                              const nextExtensions = isSelected
                                ? config.selectedAccessExtensions.filter((item) => item !== name)
                                : [...config.selectedAccessExtensions, name]
                              setConfig({ selectedAccessExtensions: nextExtensions })
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                event.currentTarget.click()
                              }
                            }}
                          >
                            <span aria-hidden="true" className="mt-0.5 pointer-events-none">
                              <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", isSelected && "border-primary bg-primary text-primary-foreground")}>
                                {isSelected && <Check className="size-3.5" />}
                              </span>
                            </span>
                            <span className="text-xs font-medium">{label}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{label}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t bg-background/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button size="sm" className="w-full h-8 text-xs" onClick={onReview ?? (() => setViewMode("project"))}>
            Generate project
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

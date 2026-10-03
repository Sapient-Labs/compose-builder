import { useState, useMemo } from "react"
import { useLaunchpadStore } from "@/lib/state/store"
import { getAccessBases, getAvailableLibraryFacets, EMPTY_BASE } from "@/lib/compose-core"
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
  Settings,
  User,
  Users,
  ArrowRight,
  Check
} from "lucide-react"

export function ConfigPanel() {
  const { catalog, config, setConfig, setViewMode } = useLaunchpadStore()
  const [facetSearch, setFacetSearch] = useState("")
  const [librarySearch, setLibrarySearch] = useState("")

  const features = useMemo(() => {
    if (!catalog) return []
    return Object.entries(catalog.features)
      .filter(([, def]) => !def.access && def.visible !== false)
  }, [catalog])

  const selectedBase = useMemo(() => {
    if (!catalog) return EMPTY_BASE
    return config.baseKey === "none"
      ? EMPTY_BASE
      : catalog.features[config.baseKey]
  }, [catalog, config.baseKey])

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
    return Object.entries(getAccessBases(catalog, config.baseKey))
  }, [catalog, config.baseKey])

  // Filter facets by search
  const filteredExtensions = useMemo(() => {
    if (!facetSearch) return availableExtensions
    return availableExtensions.filter(([name]) => 
      name.toLowerCase().includes(facetSearch.toLowerCase())
    )
  }, [availableExtensions, facetSearch])

  const filteredLibraries = useMemo(() => {
    if (!librarySearch) return availableLibraries
    return availableLibraries.filter(([name]) => 
      name.toLowerCase().includes(librarySearch.toLowerCase())
    )
  }, [availableLibraries, librarySearch])

  if (!catalog) return null

  return (
    <div className="relative h-full bg-background">
      <div className="h-full overflow-y-auto pb-20">
        <div className="w-full">
        <div className="p-4 border-b">
          <h1 className="text-md font-semibold flex items-center gap-2">
            <Settings className="size-5" aria-hidden="true" />
            Build your application
          </h1>
        </div>

        <div className="p-2 space-y-1">
        {/* Base Selection - Always Open */}
        <CollapsibleSection 
          title="Base" 
          defaultOpen={true}
          icon={Layers}
          badge={
            <Badge variant="secondary" className="ml-auto animate-in fade-in">
              {config.baseKey === "none" ? "Blank" : selectedBase.label}
            </Badge>
          }
        >
          <div className="space-y-2 pt-2">
            <Button
              variant={config.baseKey === "none" ? "default" : "outline"}
              size="sm"
              className="w-full justify-start transition-all hover:scale-[1.02]"
              onClick={() => setConfig({
                baseKey: "none",
                selectedExtensions: [],
                selectedAccess: [],
                selectedAccessExtensions: [],
              })}
            >
              Blank
            </Button>
            {features.map(([key, definition]) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Button
                    variant={config.baseKey === key ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-between transition-all hover:scale-[1.02]"
                    onClick={() => setConfig({
                      baseKey: key,
                      selectedExtensions: [],
                      selectedAccess: [],
                      selectedAccessExtensions: [],
                    })}
                  >
                    <span>{definition.label}</span>
                    <Badge variant="outline" className="ml-2">
                      {Object.keys(definition.required).length + Object.keys(definition.optional).length}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{definition.label} - {Object.keys(definition.required).length} required, {Object.keys(definition.optional).length} optional</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </CollapsibleSection>

        {/* Optional Facets */}
        {availableExtensions.length > 0 && (
          <CollapsibleSection 
            title="Optional Facets" 
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
                const hasConstructor = entry.constructor && entry.constructor.length > 0
                const description = entry.constructor?.[0]?.comments?.[0] ?? 
                  (hasConstructor ? "Requires initialization" : "Optional facet")

                return (
                  <Tooltip key={name}>
                    <TooltipTrigger asChild>
                      <div
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                        <span aria-hidden="true" className="mt-0.5 pointer-events-none">
                          <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", isSelected && "border-primary bg-primary text-primary-foreground")}>
                            {isSelected && <Check className="size-3.5" />}
                          </span>
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{name}</span>
                            {hasConstructor && (
                              <Badge variant="secondary" className="text-xs">
                                Init
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {description}
                          </p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="font-medium">{name}</p>
                      <p className="text-xs opacity-80 mt-1">{description}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
              {filteredExtensions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No facets match "{facetSearch}"
                </p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Libraries */}
        {availableLibraries.length > 0 && (
          <CollapsibleSection 
            title="Libraries" 
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
                  placeholder="Search libraries..."
                  className="mb-2"
                />
              )}
              {filteredLibraries.map(([name]) => {
                const isSelected = config.selectedLibraries.includes(name)

                return (
                  <div
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    key={name}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                )
              })}
              {filteredLibraries.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No libraries match "{librarySearch}"
                </p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Access Control */}
        {accessBases.length > 0 && (
          <CollapsibleSection 
            title="Access Control" 
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
                          className="w-full justify-start transition-all hover:scale-[1.02]"
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
                            setConfig({ selectedAccess: newAccess })
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
                          className="w-full justify-start transition-all hover:scale-[1.02]"
                          onClick={() => {
                            const newAccess = isSelected
                              ? config.selectedAccess.filter((a) => a !== key)
                              : [...config.selectedAccess, key]
                            setConfig({ selectedAccess: newAccess })
                          }}
                        >
                          {definition.label}
                        </Button>
                      )
                    })}
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button className="w-full" onClick={() => setViewMode("project")}>
            Review project
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

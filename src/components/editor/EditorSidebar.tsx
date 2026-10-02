import { useLaunchpadStore } from "@/lib/state/store"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Settings, FolderTree, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import type { EditorViewMode } from "@/lib/state/store"

const NAV_ITEMS: { value: EditorViewMode; label: string; icon: typeof Settings }[] = [
  { value: "config", label: "Builder", icon: Settings },
  { value: "project", label: "Preview", icon: FolderTree },
]

export function EditorSidebar() {
  const { viewMode, setViewMode, sidebarCollapsed, toggleSidebar } =
    useLaunchpadStore()

  return (
    <aside
      className={cn(
        "h-full flex flex-col border-r bg-sidebar text-sidebar-foreground flex-shrink-0 transition-[width] duration-200 ease-out overflow-hidden",
        sidebarCollapsed ? "w-14" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex items-center h-11 flex-shrink-0 border-b px-2.5 gap-2.5 text-sm",
          sidebarCollapsed && "justify-center px-0"
        )}
      >
        <img src="/favicon.svg" alt="" className="size-4 shrink-0" />
        {!sidebarCollapsed && (
          <span className="font-semibold truncate">Compose Launchpad</span>
        )}
      </div>

      <nav className="flex-1 p-2 flex flex-col overflow-y-auto">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = viewMode === item.value
            const Icon = item.icon
            const button = (
              <button
                type="button"
                onClick={() => setViewMode(item.value)}
                className={cn(
                  "w-full h-9 flex items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors cursor-pointer outline-none",
                  "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  sidebarCollapsed ? "justify-center px-0" : "justify-start",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            )

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.value}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.value}>{button}</div>
          })}
        </div>

        <div className="mt-auto pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={cn(
                  "w-full h-9 flex items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors cursor-pointer outline-none text-muted-foreground",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  sidebarCollapsed ? "justify-center px-0" : "justify-start"
                )}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="size-4 shrink-0" />
                ) : (
                  <PanelLeftClose className="size-4 shrink-0" />
                )}
                {!sidebarCollapsed && <span className="truncate">Collapse</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </aside>
  )
}

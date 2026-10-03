import { useLaunchpadStore } from "@/lib/state/store"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Settings, File, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import type { EditorViewMode } from "@/lib/state/store"

const NAV_ITEMS: { value: EditorViewMode; label: string; icon: typeof Settings }[] = [
  { value: "config", label: "Builder", icon: Settings },
  { value: "project", label: "Project", icon: File },
]

export function EditorSidebar() {
  const { viewMode, setViewMode, sidebarCollapsed, toggleSidebar } =
    useLaunchpadStore()

  return (
    <aside
      className={cn(
        "h-full flex flex-col border-r bg-sidebar text-sidebar-foreground flex-shrink-0 transition-[width] duration-200 ease-out overflow-hidden max-md:w-14",
        sidebarCollapsed ? "w-14" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex items-center h-11 flex-shrink-0 border-b px-2.5 gap-2.5 text-sm",
          sidebarCollapsed && "justify-center px-0"
        )}
      >
        <img src="/logo.svg" alt="Compose" className="size-4 shrink-0" />
        {!sidebarCollapsed && (
          <span className="font-semibold truncate max-md:hidden">Compose Builder</span>
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
                  sidebarCollapsed ? "justify-center px-0" : "justify-start max-md:justify-center max-md:px-0",
                  active
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
              >
                <Icon className="size-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate max-md:hidden">{item.label}</span>}
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
                  sidebarCollapsed ? "justify-center px-0" : "justify-start max-md:justify-center max-md:px-0"
                )}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="size-4 shrink-0" />
                ) : (
                  <PanelLeftClose className="size-4 shrink-0" />
                )}
                {!sidebarCollapsed && <span className="truncate max-md:hidden">Collapse</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
          {!sidebarCollapsed && (
            <footer className="mt-3 border-t border-sidebar-border/60 px-2.5 pt-3 text-[10px] leading-none text-muted-foreground/60 max-md:hidden">
              © {new Date().getFullYear()} {" "}
              <a
                href="https://compose.diamonds"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-sidebar-foreground"
              >
                Compose
              </a>
            </footer>
          )}
        </div>
      </nav>
    </aside>
  )
}

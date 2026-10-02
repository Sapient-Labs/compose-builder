import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"

function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ 
  className, 
  children,
  ...props 
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      className={cn(
        "flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-md",
        className
      )}
      {...props}
    >
      {children}
    </CollapsiblePrimitive.CollapsibleTrigger>
  )
}

function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={cn(
        "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      )}
      {...props}
    />
  )
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  icon: Icon,
  badge,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  badge?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger>
        <div className="flex items-center gap-2 flex-1">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          <span className="font-medium">{title}</span>
          {badge}
        </div>
        <ChevronRight 
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-90"
          )} 
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleSection }

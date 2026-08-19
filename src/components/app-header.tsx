import { useRef } from 'react'
import {
  Cloud,
  CloudOff,
  Command as CommandIcon,
  Download,
  FileText,
  LayoutGrid,
  MoreHorizontal,
  Printer,
  RotateCcw,
  Settings,
  Upload,
} from 'lucide-react'
import type { Plan } from '@/types'
import type { SyncState } from '@/lib/store'
import { SPECIALIZATIONS } from '@/lib/catalog'
import { PLAN_DOC_PATH, isConfigured } from '@/lib/firebase'
import { exportPlan, importPlan } from '@/lib/plan'
import { GtLogo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const SYNC_LABEL: Record<SyncState, string> = {
  'local-only': 'This browser only',
  connecting: 'Connecting…',
  synced: 'Synced',
  saving: 'Saving…',
  offline: 'Offline — will retry',
  rejected: 'Not saved — check firestore.rules',
}

export function AppHeader({
  plan,
  sync,
  lastSyncedAt,
  view,
  onView,
  onSpecialization,
  onOpenSettings,
  onOpenCommand,
  onImport,
  onReset,
}: {
  plan: Plan
  sync: SyncState
  lastSyncedAt: number | null
  view: 'plan' | 'summary'
  onView: (v: 'plan' | 'summary') => void
  onSpecialization: (id: string) => void
  onOpenSettings: () => void
  onOpenCommand: () => void
  onImport: (p: Plan) => void
  onReset: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const download = () => {
    const blob = new Blob([exportPlan(plan)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `omscs-plan-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
      <GtLogo className="h-5 w-auto shrink-0" />
      <span className="shrink-0 text-sm font-semibold tracking-tight">OMSCS Planner</span>

      <Separator orientation="vertical" className="mx-1 hidden !h-5 sm:block" />

      <Select value={plan.specialization} onValueChange={onSpecialization}>
        <SelectTrigger
          size="sm"
          className="h-7 w-auto min-w-0 max-w-[15rem] border-0 bg-transparent px-2 text-xs shadow-none hover:bg-accent focus-visible:ring-0"
          aria-label="Specialization"
        >
          {/* Render the name only — the hours belong in the list, not the trigger. */}
          <SelectValue>
            {/* Full name where there is room, the short code on a phone. */}
            <span className="hidden sm:inline">
              {SPECIALIZATIONS.find((s) => s.id === plan.specialization)?.name}
            </span>
            <span className="sm:hidden">
              {SPECIALIZATIONS.find((s) => s.id === plan.specialization)?.short}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SPECIALIZATIONS.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span>{s.name}</span>
              <span className="mono ml-auto pl-4 text-muted-foreground">
                {s.specializationHours} hrs
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex-1" />

      {/* Working controls: on screen only. The Summary view is the document. */}
      <div className="flex items-center gap-2" data-print="hide">
        <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={view}
        onValueChange={(v) => v && onView(v as 'plan' | 'summary')}
        className="hidden sm:flex"
      >
        <ToggleGroupItem value="plan" aria-label="Plan view" className="px-2 text-xs">
          <LayoutGrid className="size-3.5" aria-hidden />
          Plan
        </ToggleGroupItem>
        <ToggleGroupItem value="summary" aria-label="Summary view" className="px-2 text-xs">
          <FileText className="size-3.5" aria-hidden />
          Summary
        </ToggleGroupItem>
      </ToggleGroup>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onOpenCommand}
            aria-label="Command palette"
          >
            <CommandIcon className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Command palette <kbd className="mono ml-1 opacity-70">⌘K</kbd>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <Settings className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-sync={sync}
            className={cn(
              'hidden size-7 items-center justify-center sm:flex',
              sync === 'rejected' ? 'text-destructive' : 'text-muted-foreground',
            )}
            aria-label={SYNC_LABEL[sync]}
          >
            {sync === 'synced' || sync === 'saving' || sync === 'connecting' ? (
              <Cloud className={cn('size-4', sync === 'saving' && 'animate-pulse')} aria-hidden />
            ) : (
              <CloudOff className="size-4" aria-hidden />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {SYNC_LABEL[sync]}
          {isConfigured && (
            <div className="mono mt-0.5 text-[10px] opacity-70">
              {PLAN_DOC_PATH}
              {lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''}
            </div>
          )}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label="More">
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={download}>
            <Download className="size-3.5" aria-hidden />
            Export plan (JSON)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" aria-hidden />
            Import plan…
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onView('summary')
              setTimeout(() => window.print(), 120)
            }}
          >
            <Printer className="size-3.5" aria-hidden />
            Print summary
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onReset}>
            <RotateCcw className="size-3.5" aria-hidden />
            Reset plan…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          try {
            onImport(importPlan(await file.text()))
          } catch {
            /* handled by the caller's toast */
          }
          e.target.value = ''
        }}
      />
    </header>
  )
}

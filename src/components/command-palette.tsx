import { useMemo } from 'react'
import { Download, FileText, LayoutGrid, Moon, Plus, Search, Settings, Sun } from 'lucide-react'
import type { Plan, TermId } from '@/types'
import { COURSES, SPECIALIZATIONS } from '@/lib/catalog'
import { checkCap } from '@/lib/placement'
import { exportPlan } from '@/lib/plan'
import { termLabel } from '@/lib/terms'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

/**
 * ⌘K. For a keyboard user this replaces most of the chrome the interface would
 * otherwise have to spend space on: find a course and place it, jump to a term,
 * switch specialization, flip a setting.
 */
export function CommandPalette({
  open,
  onOpenChange,
  plan,
  terms,
  focusedTerm,
  onPlace,
  onOpenCourse,
  onFocusTerm,
  onSpecialization,
  onView,
  onOpenSettings,
  onToggleTheme,
  onToggleGrades,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  plan: Plan
  terms: TermId[]
  focusedTerm: TermId | null
  onPlace: (code: string, term: TermId) => void
  onOpenCourse: (code: string) => void
  onFocusTerm: (t: TermId) => void
  onSpecialization: (id: string) => void
  onView: (v: 'plan' | 'summary') => void
  onOpenSettings: () => void
  onToggleTheme: () => void
  onToggleGrades: () => void
}) {
  const run = (fn: () => void) => {
    onOpenChange(false)
    // let the dialog close before the app re-renders under it
    requestAnimationFrame(fn)
  }

  const placeable = useMemo(
    () =>
      focusedTerm ? COURSES.filter((c) => checkCap(plan, c.code, focusedTerm).ok).slice(0, 200) : [],
    [plan, focusedTerm],
  )

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
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Search courses, jump to a term, or change a setting"
    >
      <CommandInput placeholder="Search courses and commands…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Courses">
          {COURSES.slice(0, 400).map((c) => (
            <CommandItem
              key={c.code}
              value={`${c.code} ${c.title}`}
              onSelect={() => run(() => onOpenCourse(c.code))}
            >
              <Search className="size-3.5" aria-hidden />
              <span className="mono">{c.code}</span>
              <span className="truncate text-muted-foreground">{c.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {focusedTerm && placeable.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Add to ${termLabel(focusedTerm)}`}>
              {placeable.map((c) => (
                <CommandItem
                  key={`place-${c.code}`}
                  value={`add ${c.code} ${c.title}`}
                  onSelect={() => run(() => onPlace(c.code, focusedTerm))}
                >
                  <Plus className="size-3.5" aria-hidden />
                  <span className="mono">{c.code}</span>
                  <span className="truncate text-muted-foreground">{c.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Jump to term">
          {terms.map((t) => (
            <CommandItem key={t} value={`go ${termLabel(t)}`} onSelect={() => run(() => onFocusTerm(t))}>
              <LayoutGrid className="size-3.5" aria-hidden />
              {termLabel(t)}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Specialization">
          {SPECIALIZATIONS.map((s) => (
            <CommandItem
              key={s.id}
              value={`specialization ${s.name}`}
              onSelect={() => run(() => onSpecialization(s.id))}
            >
              <FileText className="size-3.5" aria-hidden />
              {s.name}
              {s.id === plan.specialization && <CommandShortcut>current</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="view plan board" onSelect={() => run(() => onView('plan'))}>
            <LayoutGrid className="size-3.5" aria-hidden />
            Plan view
          </CommandItem>
          <CommandItem value="view summary report" onSelect={() => run(() => onView('summary'))}>
            <FileText className="size-3.5" aria-hidden />
            Summary view
          </CommandItem>
          <CommandItem value="toggle grade tracking" onSelect={() => run(onToggleGrades)}>
            <Settings className="size-3.5" aria-hidden />
            {plan.settings.trackGrades ? 'Turn off grade tracking' : 'Turn on grade tracking'}
          </CommandItem>
          <CommandItem value="toggle theme dark light" onSelect={() => run(onToggleTheme)}>
            <Sun className="size-3.5 dark:hidden" aria-hidden />
            <Moon className="hidden size-3.5 dark:block" aria-hidden />
            Toggle theme
          </CommandItem>
          <CommandItem value="settings preferences" onSelect={() => run(onOpenSettings)}>
            <Settings className="size-3.5" aria-hidden />
            Settings
          </CommandItem>
          <CommandItem value="export plan json backup" onSelect={() => run(download)}>
            <Download className="size-3.5" aria-hidden />
            Export plan
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

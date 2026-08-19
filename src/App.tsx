import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, LayoutGrid, ListChecks } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { useDefaultLayout, usePanelRef } from 'react-resizable-panels'
import type { Plan, TermId } from '@/types'
import { usePlan } from '@/lib/store'
import { usePrefs } from '@/hooks/use-prefs'
import { useIsMobile } from '@/hooks/use-mobile'
import { lookup } from '@/lib/catalog'
import { checkCap } from '@/lib/placement'
import { boardTerms, placementsInTerm } from '@/lib/plan'
import { termIndex, termLabel } from '@/lib/terms'
import { validate } from '@/lib/validate'
import { AppHeader } from '@/components/app-header'
import { Board } from '@/components/board'
import { CommandPalette } from '@/components/command-palette'
import { CourseDialog } from '@/components/course-dialog'
import { EMPTY_FILTER, LibraryPanel, type LibraryFilter } from '@/components/library-panel'
import { RequirementsPanel } from '@/components/requirements-panel'
import { SettingsSheet } from '@/components/settings-sheet'
import { SlotRail, type RailCell } from '@/components/slot-rail'
import { SummaryView } from '@/components/summary-view'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type MobileTab = 'board' | 'library' | 'requirements'

export default function App() {
  const api = usePlan()
  const { plan } = api
  const { prefs, set: setPref } = usePrefs()
  const isMobile = useIsMobile()

  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_FILTER)
  const [dragging, setDragging] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [clearTermTarget, setClearTermTarget] = useState<TermId | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('board')
  const [extraTerms, setExtraTerms] = useState(0)
  const [focusedTermRaw, setFocusedTerm] = useState<TermId | null>(null)

  const libraryRef = usePanelRef()
  const requirementsRef = usePanelRef()

  // Panel widths survive a reload; collapsed/expanded state rides along in prefs.
  const layout = useDefaultLayout({
    id: 'omscs-planner-layout',
    panelIds: ['library', 'board', 'requirements'],
  })

  const validation = useMemo(() => validate(plan), [plan])

  /**
   * Only render terms that hold something, plus one empty term as the next drop
   * target. Rendering four years of empty semesters was pure noise for a two-year plan.
   */
  const terms = useMemo(() => {
    const all = boardTerms(plan, 6)
    const placedIdx = Object.values(plan.placements).map((p) => termIndex(p.term))
    const start = termIndex(plan.matriculationTerm)
    const last = placedIdx.length ? Math.max(...placedIdx) : start - 1
    const end = Math.max(start, last + 1) + extraTerms
    return all.filter((t) => termIndex(t) <= end)
  }, [plan, extraTerms])

  /**
   * The term the library's [+] adds into. Derived rather than stored, so it stays
   * valid when terms appear or disappear: the user's choice if it still exists,
   * otherwise the first term with room.
   */
  const focusedTerm = useMemo(() => {
    if (focusedTermRaw && terms.includes(focusedTermRaw)) return focusedTermRaw
    return terms.find((t) => placementsInTerm(plan, t).length === 0) ?? terms.at(-1) ?? null
  }, [focusedTermRaw, terms, plan])

  /* ⌘K */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const place = useCallback(
    (code: string, term: TermId) => {
      const check = checkCap(plan, code, term)
      if (!check.ok) {
        toast.error(`${termLabel(term)} is full`, {
          description: check.reason ?? undefined,
          action: check.swappable.length
            ? {
                label: `Replace ${check.swappable[0]}`,
                // One atomic write: removing first and placing second would re-run
                // this same check against pre-removal state and refuse again.
                onClick: () => api.swap(check.swappable[0], code, term),
              }
            : undefined,
        })
        return
      }
      api.place(code, term)
      setFocusedTerm(term)
    },
    [api, plan],
  )

  const remove = useCallback(
    (code: string) => {
      const previous = plan.placements[code.replace(/[ .]/g, '_')]
      api.remove(code)
      if (previous) {
        toast(`Removed ${code}`, {
          action: { label: 'Undo', onClick: () => api.place(previous.code, previous.term) },
        })
      }
    },
    [api, plan],
  )

  const clearTerm = useCallback(
    (term: TermId) => {
      const codes = placementsInTerm(plan, term).map((p) => p.code)
      const snapshot = placementsInTerm(plan, term).map((p) => ({ ...p }))
      codes.forEach((c) => api.remove(c))
      toast(`Cleared ${termLabel(term)}`, {
        action: {
          label: 'Undo',
          onClick: () => snapshot.forEach((p) => api.place(p.code, p.term)),
        },
      })
    },
    [api, plan],
  )

  /* Clicking an empty slot on the rail filters the library to exactly what fits. */
  const filterToSlot = useCallback(
    (cell: RailCell) => {
      setFilter({
        ...EMPTY_FILTER,
        slotCodes: cell.eligible.length ? cell.eligible : null,
        slotLabel: cell.restriction ?? cell.group,
        toggles: cell.eligible.length ? [] : ['unplaced'],
      })
      if (isMobile) setMobileTab('library')
      else if (!prefs.libraryOpen) {
        setPref('libraryOpen', true)
        libraryRef.current?.expand()
      }
    },
    [isMobile, prefs.libraryOpen, setPref, libraryRef],
  )

  const toggleLibrary = () => {
    const next = !prefs.libraryOpen
    setPref('libraryOpen', next)
    if (next) libraryRef.current?.expand()
    else libraryRef.current?.collapse()
  }

  const toggleRequirements = () => {
    const next = !prefs.requirementsOpen
    setPref('requirementsOpen', next)
    if (next) requirementsRef.current?.expand()
    else requirementsRef.current?.collapse()
  }

  const importPlan = (next: Plan) => {
    api.replacePlan(next)
    setDetail(null)
    toast.success('Plan imported')
  }

  const boardEl = (
    <Board
      plan={plan}
      terms={terms}
      validation={validation}
      focusedTerm={focusedTerm}
      dragging={dragging}
      showCost={plan.settings.showCost}
      showWorkload={plan.settings.showWorkload}
      onFocusTerm={setFocusedTerm}
      onPlace={place}
      onRemove={remove}
      onOpenCourse={setDetail}
      onNote={api.setNote}
      onAddTerm={() => setExtraTerms((n) => n + 1)}
      onClearTerm={setClearTermTarget}
    />
  )

  const libraryEl = (
    <LibraryPanel
      plan={plan}
      filter={filter}
      setFilter={setFilter}
      focusedTerm={focusedTerm}
      onOpenCourse={setDetail}
      onPlace={place}
      onDragCode={setDragging}
    />
  )

  const requirementsEl = (
    <RequirementsPanel
      plan={plan}
      validation={validation}
      showCost={plan.settings.showCost}
      onTarget={api.setTargetGraduationTerm}
    />
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col overflow-hidden">
        <AppHeader
          plan={plan}
          sync={api.sync}
          lastSyncedAt={api.lastSyncedAt}
          view={prefs.view}
          libraryOpen={prefs.libraryOpen}
          requirementsOpen={prefs.requirementsOpen}
          onView={(v) => setPref('view', v)}
          onToggleLibrary={toggleLibrary}
          onToggleRequirements={toggleRequirements}
          onSpecialization={api.setSpecialization}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
          onImport={importPlan}
          onReset={() => setResetOpen(true)}
        />

        <div className="shrink-0 border-b bg-background px-3 py-1.5" data-print="hide">
          <SlotRail
            plan={plan}
            validation={validation}
            onOpenCourse={setDetail}
            onFilterToSlot={filterToSlot}
          />
        </div>

        {prefs.view === 'summary' ? (
          <ScrollArea className="min-h-0 flex-1 print-full">{
            <SummaryView plan={plan} terms={terms} validation={validation} />
          }</ScrollArea>
        ) : isMobile ? (
          <>
            <ScrollArea className="min-h-0 flex-1">{boardEl}</ScrollArea>

            <Sheet
              open={mobileTab === 'library'}
              onOpenChange={(o) => setMobileTab(o ? 'library' : 'board')}
            >
              <SheetContent side="bottom" className="h-[85vh] gap-0 p-0">
                <SheetHeader className="border-b py-3">
                  <SheetTitle className="text-sm">
                    Course library
                    {focusedTerm && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        adding to {termLabel(focusedTerm)}
                      </span>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-hidden">{libraryEl}</div>
              </SheetContent>
            </Sheet>

            <Sheet
              open={mobileTab === 'requirements'}
              onOpenChange={(o) => setMobileTab(o ? 'requirements' : 'board')}
            >
              <SheetContent side="bottom" className="h-[85vh] gap-0 p-0">
                <SheetHeader className="border-b py-3">
                  <SheetTitle className="text-sm">Requirements</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-hidden">{requirementsEl}</div>
              </SheetContent>
            </Sheet>

            <nav
              className="flex shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]"
              aria-label="Main"
            >
              {(
                [
                  { id: 'board', label: 'Board', Icon: LayoutGrid },
                  { id: 'library', label: 'Library', Icon: BookOpen },
                  { id: 'requirements', label: 'Requirements', Icon: ListChecks },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMobileTab(id)}
                  aria-current={mobileTab === id}
                  className={cn(
                    'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[10px]',
                    mobileTab === id ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </nav>
          </>
        ) : (
          <ResizablePanelGroup
            orientation="horizontal"
            defaultLayout={layout.defaultLayout}
            onLayoutChanged={layout.onLayoutChanged}
            className="min-h-0 flex-1"
          >
            <ResizablePanel
              panelRef={libraryRef}
              id="library"
              defaultSize="20%"
              minSize="14%"
              maxSize="30%"
              collapsible
              collapsedSize={0}
              onResize={(size) => setPref('libraryOpen', size.inPixels > 4)}
              className="min-w-0"
            >
              {libraryEl}
            </ResizablePanel>
            <ResizableHandle withHandle />

            <ResizablePanel id="board" defaultSize="56%" minSize="30%" className="min-w-0">
              <ScrollArea className="h-full">{boardEl}</ScrollArea>
            </ResizablePanel>

            <ResizableHandle withHandle />
            <ResizablePanel
              panelRef={requirementsRef}
              id="requirements"
              defaultSize="24%"
              minSize="16%"
              maxSize="34%"
              collapsible
              collapsedSize={0}
              onResize={(size) => setPref('requirementsOpen', size.inPixels > 4)}
              className="min-w-0"
            >
              {requirementsEl}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      <CourseDialog
        code={detail}
        plan={plan}
        terms={terms}
        validation={validation}
        onClose={() => setDetail(null)}
        onPlace={place}
        onRemove={(c) => {
          remove(c)
          setDetail(null)
        }}
        onGrade={api.setGrade}
      />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={plan.settings}
        prefs={prefs}
        matriculationTerm={plan.matriculationTerm}
        targetGraduationTerm={plan.targetGraduationTerm}
        onSetting={api.setSetting}
        onPref={setPref}
        onTarget={api.setTargetGraduationTerm}
        onMatriculation={api.setMatriculationTerm}
      />

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        plan={plan}
        terms={terms}
        focusedTerm={focusedTerm}
        onPlace={place}
        onOpenCourse={setDetail}
        onFocusTerm={setFocusedTerm}
        onSpecialization={api.setSpecialization}
        onView={(v) => setPref('view', v)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleTheme={() =>
          setPref('theme', document.documentElement.classList.contains('dark') ? 'light' : 'dark')
        }
        onToggleGrades={() => api.setSetting('trackGrades', !plan.settings.trackGrades)}
      />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears every placement, grade, and note for everyone using this URL. There is no
              recovery path — export first if you want a backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                api.resetPlan()
                toast('Plan reset')
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(clearTermTarget)}
        onOpenChange={(o) => !o && setClearTermTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Clear {clearTermTarget ? termLabel(clearTermTarget) : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clearTermTarget &&
                placementsInTerm(plan, clearTermTarget)
                  .map((p) => `${p.code} ${lookup(p.code)?.title ?? ''}`)
                  .join(', ')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (clearTermTarget) clearTerm(clearTermTarget)
                setClearTermTarget(null)
              }}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster position="bottom-center" />
    </TooltipProvider>
  )
}

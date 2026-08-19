import type { PlanSettings, TermId } from '@/types'
import type { Prefs } from '@/hooks/use-prefs'
import { DATA_VERSION } from '@/lib/catalog'
import { termFromIndex, termIndex, termLabel } from '@/lib/terms'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function SettingsSheet({
  open,
  onOpenChange,
  settings,
  prefs,
  matriculationTerm,
  targetGraduationTerm,
  onSetting,
  onPref,
  onTarget,
  onMatriculation,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  settings: PlanSettings
  prefs: Prefs
  matriculationTerm: TermId
  targetGraduationTerm: TermId | null
  onSetting: <K extends keyof PlanSettings>(k: K, v: PlanSettings[K]) => void
  onPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void
  onTarget: (t: TermId | null) => void
  onMatriculation: (t: TermId) => void
}) {
  const targetOptions = Array.from({ length: 20 }, (_, i) =>
    termFromIndex(termIndex(matriculationTerm) + i + 1),
  )
  const matricOptions = Array.from({ length: 15 }, (_, i) => termFromIndex(termIndex('2024FA') + i))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Grade tracking and the display toggles are part of the shared plan, so both devices
            agree. Theme and density are local to this browser.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          <Row
            id="track-grades"
            label="Track grades"
            hint="Off by default. On, you record letter grades and the app checks GPA and the B/C minimums. Off, it plans courses only — the GPA requirement disappears and the minimums become advisories."
          >
            <Switch
              id="track-grades"
              checked={settings.trackGrades}
              onCheckedChange={(v) => onSetting('trackGrades', v)}
            />
          </Row>

          <Separator />

          <Row id="show-cost" label="Show cost estimates" hint="Per-term totals on the board and the cost table in the requirements panel.">
            <Switch
              id="show-cost"
              checked={settings.showCost}
              onCheckedChange={(v) => onSetting('showCost', v)}
            />
          </Row>

          <Row
            id="show-workload"
            label="Show workload estimates"
            hint="OMSCentral self-reported hours per week, summed per semester."
          >
            <Switch
              id="show-workload"
              checked={settings.showWorkload}
              onCheckedChange={(v) => onSetting('showWorkload', v)}
            />
          </Row>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-sm">Target graduation term</Label>
            <Select
              value={targetGraduationTerm ?? 'none'}
              onValueChange={(v) => onTarget(v === 'none' ? null : v)}
            >
              <SelectTrigger className="w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No target</SelectItem>
                {targetOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {termLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Matriculation term</Label>
            <Select value={matriculationTerm} onValueChange={onMatriculation}>
              <SelectTrigger className="w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {matricOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {termLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sets the foundational window and the six-year deadline.
            </p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-sm">Density</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={prefs.density}
              onValueChange={(v) => v && onPref('density', v as Prefs['density'])}
              className="w-full"
            >
              <ToggleGroupItem value="comfortable" className="flex-1 text-xs">
                Comfortable
              </ToggleGroupItem>
              <ToggleGroupItem value="compact" className="flex-1 text-xs">
                Compact
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Theme</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={prefs.theme}
              onValueChange={(v) => v && onPref('theme', v as Prefs['theme'])}
              className="w-full"
            >
              <ToggleGroupItem value="light" className="flex-1 text-xs">
                Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" className="flex-1 text-xs">
                Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system" className="flex-1 text-xs">
                System
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          <p className="text-xs leading-relaxed text-muted-foreground">
            Catalog data v{DATA_VERSION}. There are no accounts — anyone with this URL reads and
            edits the same plan. Export regularly; there is no recovery path.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Row({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <div className="pt-0.5">{children}</div>
    </div>
  )
}

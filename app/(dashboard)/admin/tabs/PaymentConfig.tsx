'use client'
import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, Calendar, SplitSquareVertical, Info, Save } from 'lucide-react'
import { toast } from 'sonner'

interface DeptConfig {
  id: string
  name: string
  lump_sum: boolean
  yearly_payment: boolean
  part_payment: boolean
  min_first_installment_pct: number
  max_installments: number
  max_days_to_clear: number
  yearly_split_y1: number
  yearly_split_y2: number
  yearly_split_y3: number
}

interface Props {
  departments: { id: string; name: string }[]
}

const SAMPLE_CONFIGS: DeptConfig[] = [
  { id: '1', name: 'Commerce', lump_sum: true, yearly_payment: true, part_payment: true, min_first_installment_pct: 40, max_installments: 3, max_days_to_clear: 90, yearly_split_y1: 60, yearly_split_y2: 25, yearly_split_y3: 15 },
  { id: '2', name: 'Management', lump_sum: true, yearly_payment: false, part_payment: true, min_first_installment_pct: 50, max_installments: 2, max_days_to_clear: 60, yearly_split_y1: 100, yearly_split_y2: 0, yearly_split_y3: 0 },
  { id: '3', name: 'Arts', lump_sum: true, yearly_payment: true, part_payment: false, min_first_installment_pct: 40, max_installments: 3, max_days_to_clear: 90, yearly_split_y1: 50, yearly_split_y2: 30, yearly_split_y3: 20 },
]

export function PaymentConfig({ departments }: Props) {
  const [configs, setConfigs] = useState<DeptConfig[]>(() => {
    if (departments.length > 0) {
      return departments.slice(0, 5).map((d, i) => SAMPLE_CONFIGS[i] ? { ...SAMPLE_CONFIGS[i], id: d.id, name: d.name } : { id: d.id, name: d.name, lump_sum: true, yearly_payment: false, part_payment: false, min_first_installment_pct: 40, max_installments: 3, max_days_to_clear: 90, yearly_split_y1: 60, yearly_split_y2: 25, yearly_split_y3: 15 })
    }
    return SAMPLE_CONFIGS
  })
  const [selected, setSelected] = useState<string>(configs[0]?.id ?? '')

  const cfg = configs.find(c => c.id === selected)

  function update(field: keyof DeptConfig, value: unknown) {
    setConfigs(prev => prev.map(c => c.id === selected ? { ...c, [field]: value } : c))
  }

  function handleSave() {
    toast.success(`Payment config saved for ${cfg?.name}`)
  }

  const splitTotal = (cfg?.yearly_split_y1 ?? 0) + (cfg?.yearly_split_y2 ?? 0) + (cfg?.yearly_split_y3 ?? 0)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Payment Configuration</h2>
        <p className="text-sm text-muted-foreground">Enable/disable payment modes per department and configure installment rules.</p>
      </div>

      {/* Department selector tabs */}
      <div className="flex flex-wrap gap-2">
        {configs.map(c => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${selected === c.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}
          >
            {c.name}
            {(c.yearly_payment || c.part_payment) && (
              <span className="ml-1.5 text-[10px] opacity-70">{[c.yearly_payment && 'Y', c.part_payment && 'P'].filter(Boolean).join('+')}</span>
            )}
          </button>
        ))}
      </div>

      {cfg && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Payment Modes Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500" />Payment Modes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Lump Sum</Label>
                  <p className="text-xs text-muted-foreground">Full fee at once</p>
                </div>
                <Switch checked={cfg.lump_sum} onCheckedChange={v => update('lump_sum', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Yearly Payment</Label>
                  <p className="text-xs text-muted-foreground">Fee split year-wise</p>
                </div>
                <Switch checked={cfg.yearly_payment} onCheckedChange={v => update('yearly_payment', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Part Payment</Label>
                  <p className="text-xs text-muted-foreground">EMI-style installments</p>
                </div>
                <Switch checked={cfg.part_payment} onCheckedChange={v => update('part_payment', v)} />
              </div>
            </CardContent>
          </Card>

          {/* Part Payment Rules */}
          <Card className={cfg.part_payment ? '' : 'opacity-50 pointer-events-none'}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><SplitSquareVertical className="w-4 h-4 text-purple-500" />Part Payment Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Min First Installment</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="number" min={10} max={100} value={cfg.min_first_installment_pct} onChange={e => update('min_first_installment_pct', Number(e.target.value))} className="h-8 text-sm" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max Installments</Label>
                <Input type="number" min={2} max={12} value={cfg.max_installments} onChange={e => update('max_installments', Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max Days to Clear</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="number" min={30} max={365} value={cfg.max_days_to_clear} onChange={e => update('max_days_to_clear', Number(e.target.value))} className="h-8 text-sm" />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground bg-slate-50 rounded p-2">
                Example: 40% → 30% → 30% over {cfg.max_days_to_clear} days
              </div>
            </CardContent>
          </Card>

          {/* Yearly Payment Incentive Split */}
          <Card className={cfg.yearly_payment ? '' : 'opacity-50 pointer-events-none'}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-green-500" />Yearly Incentive Split</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">How incentive is split across years. Must total 100%.</p>
              <div>
                <Label className="text-xs text-muted-foreground">Year 1 (%)</Label>
                <Input type="number" min={0} max={100} value={cfg.yearly_split_y1} onChange={e => update('yearly_split_y1', Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Year 2 (%)</Label>
                <Input type="number" min={0} max={100} value={cfg.yearly_split_y2} onChange={e => update('yearly_split_y2', Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Year 3 (%)</Label>
                <Input type="number" min={0} max={100} value={cfg.yearly_split_y3} onChange={e => update('yearly_split_y3', Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div className={`flex items-center gap-2 text-xs font-medium rounded px-2 py-1 ${splitTotal === 100 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                Total: {splitTotal}% {splitTotal !== 100 && '— must equal 100%'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overdue escalation rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Info className="w-4 h-4 text-amber-500" />Overdue Escalation Rules (Global)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-2xl font-bold text-yellow-700">+3 days</p>
              <p className="text-xs text-yellow-600 mt-1">Grace period after due date</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-2xl font-bold text-orange-700">+7 days</p>
              <p className="text-xs text-orange-600 mt-1">Counselor gets notified</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-2xl font-bold text-red-700">+15 days</p>
              <p className="text-xs text-red-600 mt-1">Admin flagged, admission on Hold</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="flex items-center gap-2"><Save className="w-4 h-4" />Save Config for {cfg?.name}</Button>
      </div>
    </div>
  )
}

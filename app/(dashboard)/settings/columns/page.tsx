'use client'
import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { LEAD_COLUMNS } from '@/types/app.types'
import { toast } from 'sonner'

export default function ColumnSettingsPage() {
  const [columns, setColumns] = useState(
    LEAD_COLUMNS.map((c) => ({ ...c, visible: c.default }))
  )

  function toggleColumn(key: string) {
    setColumns((prev) => prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c))
  }

  function handleSave() {
    // In a real implementation, this would save global defaults to DB
    toast.success('Default column settings saved')
  }

  return (
    <div>
      <PageHeader
        title="Default Column Settings"
        description="Set which columns are visible by default for new users"
        action={<Button size="sm" onClick={handleSave}>Save Defaults</Button>}
      />
      <div className="bg-white rounded-lg border p-6 max-w-md">
        <div className="space-y-3">
          {columns.map((col) => (
            <div key={col.key} className="flex items-center justify-between">
              <Label className="text-sm">{col.label}</Label>
              <Switch checked={col.visible} onCheckedChange={() => toggleColumn(col.key)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

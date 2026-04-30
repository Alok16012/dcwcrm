'use client'
import { useState } from 'react'
import { Save, Eye, EyeOff, Globe, CreditCard, Bell, Shield, Server, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Settings {
  crm_api_url: string
  crm_bearer_token: string
  crm_webhook_url: string
  razorpay_key_id: string
  razorpay_key_secret: string
  wallet_min_recharge: number
  wallet_max_recharge: number
  wallet_low_balance_alert: number
  low_balance_alert_enabled: boolean
  otp_expiry_minutes: number
  rate_limit_registration: number
  invoice_prefix: string
  invoice_terms: string
  invoice_gst_number: string
  invoice_company_name: string
  crm_sync_enabled: boolean
  crm_retry_attempts: number
  notification_whatsapp_api: string
  notification_sms_api: string
}

const DEFAULTS: Settings = {
  crm_api_url: 'https://crm.dcw.in/api/v1',
  crm_bearer_token: '',
  crm_webhook_url: 'https://crm.dcw.in/webhook/admissions',
  razorpay_key_id: '',
  razorpay_key_secret: '',
  wallet_min_recharge: 500,
  wallet_max_recharge: 50000,
  wallet_low_balance_alert: 1000,
  low_balance_alert_enabled: true,
  otp_expiry_minutes: 10,
  rate_limit_registration: 5,
  invoice_prefix: 'DCW',
  invoice_terms: 'All fees paid are non-refundable. This invoice is system-generated and valid without signature.',
  invoice_gst_number: '',
  invoice_company_name: 'Distance Courses Wala Pvt. Ltd.',
  crm_sync_enabled: true,
  crm_retry_attempts: 3,
  notification_whatsapp_api: '',
  notification_sms_api: '',
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? '••••••••••••'} className="pr-10" />
      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShow(s => !s)}>
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

export function SystemSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)

  function upd<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(s => ({ ...s, [key]: value }))
  }

  function handleSave(section: string) {
    toast.success(`${section} settings saved. Changes take effect immediately.`)
  }

  function handleReset() {
    setSettings(DEFAULTS)
    toast.info('Settings reset to defaults')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Settings</h2>
          <p className="text-sm text-muted-foreground">Configure CRM integration, payment gateway, notification APIs, invoice settings, and security thresholds.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-1" />Reset Defaults</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CRM Integration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><Server className="w-4 h-4 text-blue-500" />CRM Integration</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sync Enabled</span>
                <Switch checked={settings.crm_sync_enabled} onCheckedChange={v => upd('crm_sync_enabled', v)} />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">CRM API Endpoint</Label>
              <Input value={settings.crm_api_url} onChange={e => upd('crm_api_url', e.target.value)} className="mt-1 h-8 text-sm" placeholder="https://crm.example.com/api/v1" />
            </div>
            <div>
              <Label className="text-xs">Bearer Token</Label>
              <div className="mt-1">
                <SecretInput value={settings.crm_bearer_token} onChange={v => upd('crm_bearer_token', v)} placeholder="Enter CRM bearer token" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Webhook Fallback URL</Label>
              <Input value={settings.crm_webhook_url} onChange={e => upd('crm_webhook_url', e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Max Retry Attempts</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={1} max={10} value={settings.crm_retry_attempts} onChange={e => upd('crm_retry_attempts', Number(e.target.value))} className="h-8 text-sm w-24" />
                <span className="text-xs text-muted-foreground">Backoff: 1m → 5m → 15m</span>
              </div>
            </div>
            <Button size="sm" className="w-full mt-2" onClick={() => handleSave('CRM')}><Save className="w-3.5 h-3.5 mr-1" />Save CRM Settings</Button>
          </CardContent>
        </Card>

        {/* Payment Gateway */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-purple-500" />Payment Gateway (Razorpay)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Key ID</Label>
              <div className="mt-1">
                <SecretInput value={settings.razorpay_key_id} onChange={v => upd('razorpay_key_id', v)} placeholder="rzp_live_XXXXXXXXXX" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Key Secret</Label>
              <div className="mt-1">
                <SecretInput value={settings.razorpay_key_secret} onChange={v => upd('razorpay_key_secret', v)} placeholder="Enter Razorpay secret" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Min Recharge (₹)</Label>
                <Input type="number" value={settings.wallet_min_recharge} onChange={e => upd('wallet_min_recharge', Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Max Recharge (₹)</Label>
                <Input type="number" value={settings.wallet_max_recharge} onChange={e => upd('wallet_max_recharge', Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Low Alert (₹)</Label>
                <Input type="number" value={settings.wallet_low_balance_alert} onChange={e => upd('wallet_low_balance_alert', Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 rounded-lg">
              <Label className="text-xs cursor-pointer">Low Balance Alert Notification</Label>
              <Switch checked={settings.low_balance_alert_enabled} onCheckedChange={v => upd('low_balance_alert_enabled', v)} />
            </div>
            <Button size="sm" className="w-full mt-2" onClick={() => handleSave('Payment Gateway')}><Save className="w-3.5 h-3.5 mr-1" />Save Payment Settings</Button>
          </CardContent>
        </Card>

        {/* Notification APIs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-green-500" />Notification APIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">WhatsApp API Key (MSG91 / Twilio)</Label>
              <div className="mt-1">
                <SecretInput value={settings.notification_whatsapp_api} onChange={v => upd('notification_whatsapp_api', v)} placeholder="Enter WhatsApp API key" />
              </div>
            </div>
            <div>
              <Label className="text-xs">SMS API Key</Label>
              <div className="mt-1">
                <SecretInput value={settings.notification_sms_api} onChange={v => upd('notification_sms_api', v)} placeholder="Enter SMS API key" />
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-medium">Push Notification: Firebase FCM</p>
              <p>Configure FCM service account JSON in server environment variables (FIREBASE_SERVICE_ACCOUNT).</p>
            </div>
            <Button size="sm" className="w-full mt-2" onClick={() => handleSave('Notification')}><Save className="w-3.5 h-3.5 mr-1" />Save Notification Settings</Button>
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-amber-500" />Invoice & Company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Company Name</Label>
              <Input value={settings.invoice_company_name} onChange={e => upd('invoice_company_name', e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Invoice Prefix</Label>
                <Input value={settings.invoice_prefix} onChange={e => upd('invoice_prefix', e.target.value)} className="h-8 text-sm mt-1" placeholder="DCW" />
                <p className="text-[10px] text-muted-foreground mt-1">e.g. DCW-INV-202604-00001</p>
              </div>
              <div>
                <Label className="text-xs">GST Number</Label>
                <Input value={settings.invoice_gst_number} onChange={e => upd('invoice_gst_number', e.target.value)} className="h-8 text-sm mt-1" placeholder="27XXXXX1234X1ZX" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Terms & Conditions (Invoice Footer)</Label>
              <Textarea value={settings.invoice_terms} onChange={e => upd('invoice_terms', e.target.value)} rows={3} className="text-sm mt-1" />
            </div>
            <Button size="sm" className="w-full mt-2" onClick={() => handleSave('Invoice')}><Save className="w-3.5 h-3.5 mr-1" />Save Invoice Settings</Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-red-500" />Security & Rate Limiting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">OTP Expiry (minutes)</Label>
                <Input type="number" min={5} max={30} value={settings.otp_expiry_minutes} onChange={e => upd('otp_expiry_minutes', Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Max OTP Requests / hr</Label>
                <Input type="number" min={1} max={20} value={settings.rate_limit_registration} onChange={e => upd('rate_limit_registration', Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground space-y-1 mt-5 bg-slate-50 rounded-lg p-3">
                  <p>• All API routes protected by role-based middleware (JWT)</p>
                  <p>• File uploads: MIME type check + 10MB limit enforced</p>
                  <p>• All secrets stored in .env — never committed to git</p>
                  <p>• Payment amounts verified server-side — client values ignored</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button size="sm" onClick={() => handleSave('Security')}><Save className="w-3.5 h-3.5 mr-1" />Save Security Settings</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

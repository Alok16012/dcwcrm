#!/usr/bin/env node
/**
 * Create a Berojgar Bharat staff account.
 *
 * BB has no user-management screen yet, and the DCW settings page only issues
 * DCW roles — so without this the first BB admin could never sign in. Uses the
 * service role key from .env.local, so run it locally, never on a server.
 *
 * Usage:
 *   node scripts/create-bb-user.mjs "Name" email@example.com bb_admin
 *   node scripts/create-bb-user.mjs "Name" email@example.com bb_telecaller 'ChosenPass123'
 *
 * Roles: bb_admin | bb_manager | bb_telecaller
 * With no password given, a strong one is generated and printed once.
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()

function loadEnv(file) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}
loadEnv('.env.local')

const [fullName, email, role, givenPassword] = process.argv.slice(2)
const VALID = ['bb_admin', 'bb_manager', 'bb_telecaller']

if (!fullName || !email || !role) {
  console.error('Usage: node scripts/create-bb-user.mjs "Full Name" email@example.com <bb_admin|bb_manager|bb_telecaller> [password]')
  process.exit(1)
}
if (!VALID.includes(role)) {
  console.error(`Role must be one of: ${VALID.join(', ')}`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

// Mixed case, digits and a symbol, so it satisfies any password policy.
const password = givenPassword || `Bb${randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '')}#7`

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: created, error: authErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
})

if (authErr) {
  console.error(`Could not create the login: ${authErr.message}`)
  process.exit(1)
}

// A profile row is what the app actually reads; an auth user without one has
// no role and would be bounced straight back out of every screen.
const { error: profileErr } = await admin.from('profiles').upsert({
  id: created.user.id,
  email,
  full_name: fullName,
  role,
  is_active: true,
})

if (profileErr) {
  await admin.auth.admin.deleteUser(created.user.id)
  console.error(`Could not create the profile, login rolled back: ${profileErr.message}`)
  process.exit(1)
}

console.log(`
Berojgar Bharat account created

  Name      ${fullName}
  Email     ${email}
  Role      ${role}
  Password  ${password}

Sign in at /login → choose "Berojgar Bharat".
${givenPassword ? '' : 'This password is shown once — save it now, then have them change it.'}
`)

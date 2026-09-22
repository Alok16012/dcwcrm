# Biometric attendance — Dahua DHI-ASI3204E-W

Face / card / fingerprint punches from the office door controller become rows in
the existing `attendance` table, so payroll, the HRMS grid and the employee's own
attendance history all keep working unchanged.

## The shape of it

```
┌──────────────────────┐   LAN    ┌────────────────┐  HTTPS + HMAC   ┌───────────────┐
│ DHI-ASI3204E-W       │ ───────► │ bridge agent   │ ──────────────► │ CRM (Railway) │
│ face / card / finger │  events  │ (office PC/Pi) │   /api/biometric│               │
└──────────────────────┘          └────────────────┘                 └──────┬────────┘
                                                                            │
                                                             biometric_punches (raw log)
                                                                            │  rollup
                                                                     attendance (1 row/day)
```

**Why the agent exists:** the controller has a private LAN IP. Railway is on the
public internet and can never dial into the office network. So the agent runs
*inside* the office and pushes outward — no port forwarding, no static IP, no
firewall holes. Full install notes: [`agent/README.md`](agent/README.md).

## What was added

| File | Role |
|---|---|
| `supabase/migrations/104_biometric_attendance.sql` | `biometric_devices`, `biometric_punches`, employee mapping columns |
| `lib/biometric/dahua.ts` | Dahua CGI client — HTTP Digest auth, device info, record log |
| `lib/biometric/ingest.ts` | Dedupe, employee resolution, punches → attendance rollup |
| `lib/biometric/auth.ts` | HMAC-SHA256 request signing for the agent |
| `app/api/biometric/punch` | Punch intake (single event or batch) |
| `app/api/biometric/heartbeat` | Agent liveness, device self-registration |
| `app/api/biometric/map` | Bind a device User ID to an employee + backfill past punches |
| `app/api/cron/biometric-sync` | Optional direct pull, when the device is publicly reachable |
| `app/(dashboard)/hrms/biometric` | Device health, punch log, unknown-identity mapping |
| `agent/dahua-bridge.mjs` | The LAN bridge agent (zero dependencies, Node 18+) |
| `agent/device.mjs` | Shared Dahua transport — Digest auth, CGI parsing, event stream |
| `agent/check-device.mjs` | Setup checker: verifies each device step before the agent runs |
| `scripts/railway-cron.mjs` | Cron entrypoint for Railway's one-shot cron services |

## Firmware differences

The controller's record API is not the same across firmware, and the difference
is silent rather than loud, so the agent detects it per device:

| | Firmware 3.x (e.g. `3.002.0000002.1.R`) | Firmware 2.x |
|---|---|---|
| Record API | one-shot `recordFinder.cgi?action=find` | `factory.create` → `startFind` → `doFind` session |
| Time window | bare `StartTime` / `EndTime` | `condition.StartTime` / `condition.EndTime` |
| User list | `AccessUser.cgi?action=startFind`, JSON | `AccessUser.cgi?action=list`, key=value |

The dangerous one is the time window: 3.x **accepts** the `condition.`-prefixed
form and then ignores it, handing back the entire log instead of the window you
asked for. Records also come back oldest-first with no offset parameter, so a
working window is the only thing that keeps the catch-up poll correct once the
log grows. `agent/check-device.mjs` reports which mode a device negotiated
(`via find` or `via factory`).

## Rules the rollup follows

- **Clock-in** = first granted punch of the IST day; **clock-out** = last.
- Two punches less than `BIOMETRIC_MIN_SPAN_SECONDS` (default 120) apart are the
  same arrival — the day stays open rather than closing instantly.
- **≥ 6 h** (`BIOMETRIC_FULL_DAY_MINUTES`) → `present`; less → `half_day`.
- `BIOMETRIC_LATE_AFTER=10:15` (optional) marks a late arrival `late`, which
  payroll still pays in full.
- A day an admin already marked `leave` or `holiday` **keeps that status**. The
  punch times are still saved; the human's verdict wins.
- The raw log in `biometric_punches` is append-only — it is the audit trail, and
  attendance is always *derived* from it. A punch arriving late (catch-up poll,
  offline queue, a mapping added days later) simply recomputes the day.

## Railway environment variables

Required on the CRM service:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
BIOMETRIC_WEBHOOK_SECRET      # shared with the agent — openssl rand -hex 32
```

Optional tuning:

```
BIOMETRIC_MIN_SPAN_SECONDS=120
BIOMETRIC_FULL_DAY_MINUTES=360
BIOMETRIC_LATE_AFTER=10:15
BIOMETRIC_MAX_SKEW_SECONDS=300
BIOMETRIC_ALLOW_BEARER=false  # true only while commissioning a device
```

Only if the controller is reachable from the internet (static IP / DDNS + a
forwarded port) and you want `/api/cron/biometric-sync` to pull directly:

```
DAHUA_HOST=dcw.ddns.net:8085
DAHUA_USERNAME=...
DAHUA_PASSWORD=...
BIOMETRIC_SYNC_LOOKBACK_HOURS=24
```

## Failover between Railway and Vercel

Both deployments run the same code against the same Supabase, and both hold
`BIOMETRIC_WEBHOOK_SECRET`, so either can accept punches. Railway is where the
agent points; Vercel is the URL staff use *and* a working standby.

If Railway is down, change one line in `agent/.env` and restart the agent:

```
CRM_BASE_URL=https://crmrahul.vercel.app
```

Nothing is lost in the meantime — the agent queues to disk while the CRM is
unreachable, and the device keeps its own log regardless.

## Deploying with the Railway CLI

```bash
railway login
railway link                      # or: railway init --name dcwcrm
railway variables --set "BIOMETRIC_WEBHOOK_SECRET=$(openssl rand -hex 32)"
railway up
railway domain                    # public URL for the agent's CRM_BASE_URL
railway logs
```

### Cron jobs

Railway runs a cron service as a one-shot container, so the Vercel `crons`
block in `vercel.json` does not apply. Add a second service from the same repo
with a cron schedule and this start command:

```bash
node scripts/railway-cron.mjs auto-punchout     # 18:00 IST  →  "30 12 * * *" UTC
node scripts/railway-cron.mjs biometric-sync    # hourly     →  "0 * * * *"   (only if DAHUA_HOST is set)
```

Give that service `CRON_SECRET` and `CRON_TARGET_URL` (the CRM's public URL).

## Commissioning checklist

1. Apply `104_biometric_attendance.sql` to Supabase.
2. Deploy to Railway with the variables above; note the public URL.
3. On the controller (browser, not the device screen): static LAN IP, timezone
   **GMT+05:30**, NTP on, an operator account for the agent. Verify with
   `node agent/check-device.mjs`.
4. Enrol staff on the device. **The `User ID` typed there is the mapping key.**
5. Install the agent on an always-on office machine (`agent/README.md`).
6. Punch once. It appears in **HRMS → Biometric** within seconds.
7. Map each unknown User ID to an employee — past punches backfill automatically.

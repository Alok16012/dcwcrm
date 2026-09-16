# Dahua biometric bridge

Forwards punches from the **DHI-ASI3204E-W** face/card/fingerprint controller to
the CRM running on Railway.

## Why an agent at all

The controller has no public address — it sits on the office LAN with a private
IP. Railway is outside that network, so the CRM can never dial the device. The
agent reverses the direction: it runs *inside* the office, holds the connection
to the device, and pushes outward over HTTPS. No port forwarding, no static IP,
no firewall holes.

```
[ DHI-ASI3204E-W ] --LAN--> [ bridge agent ] --HTTPS(signed)--> [ CRM on Railway ] --> [ Supabase ]
```

If you *do* expose the device publicly (static IP or DDNS + forwarded port),
set `DAHUA_HOST` etc. on the Railway service instead and the
`/api/cron/biometric-sync` route will pull records directly — but the agent is
the recommended install.

## Device setup (once)

The 2.4" screen on this model is **non-touch with mechanical buttons**, so real
configuration happens in a **web browser**, not on the device.

### 1. Find the controller on the network

Plug in the LAN cable (or join Wi-Fi from the device menu), then find its IP:

- the router's DHCP client list — look for a Dahua MAC, or
- factory default **`192.168.1.108`**, user `admin`, or
- Dahua **ConfigTool** / **SmartPSS Lite** (free) discovers every Dahua box on
  the LAN and can change the IP without logging in.

Open `http://<that-ip>` in a browser. On first login the device forces you to
set the admin password and security questions.

### 2. Give it a fixed address

**Network → TCP/IP** → set **Mode: Static**, fill in IP / subnet / gateway that
match your office range, save. The device reboots at the new address.

DHCP works too, but only if you reserve the IP on the router — otherwise the
address changes one day and the agent stops finding it.

### 3. Fix the clock — this one actually matters

**System → General → Date & Time**

- Time Zone: **GMT+05:30**
- Enable **NTP**, server `time.windows.com` or `pool.ntp.org`, interval 60 min
- Set the date/time once by hand so NTP has something close to sync from

The device clock is what stamps every punch. A wrong timezone shifts everybody's
attendance by hours; drift quietly corrupts it over months.

### 4. Make an account for the agent

**System → Account → Add User.** Give it access-control **record** and **event**
permissions. Keep it separate from the admin login you use by hand, so changing
your own password never takes attendance down.

### 5. Enrol staff

**User → Add** (or **UserManager** on some firmware). For each person:

- **User ID** — a number. **This is the mapping key in the CRM.** Use the
  employee code so it stays meaningful; once set, never change it.
- Name, then register the face (and card / fingerprint if you want backups).

### 6. Verify before installing the agent

```bash
node agent/check-device.mjs            # run every check
node agent/check-device.mjs --watch    # then scan a face and watch it arrive
```

It tests the same path the agent uses and names the step that is still missing:

```
[  OK  ] Reachable on the network  —  http://192.168.1.108
[  OK  ] Login accepted  —  serial 7L03D2APAZ00123
[ INFO ] Model  —  ASI3204E-W, firmware 1.000.0000000.5.R
[  OK  ] Device clock matches IST  —  2026-09-16 18:43:23
[  OK  ] NTP enabled  —  time.windows.com every 60 min
[  OK  ] Static IP configured  —  192.168.1.108
[  OK  ] Enrolled users found  —  2 on the device

        User ID    Name                  Card
        ---------  --------------------  ------------
        1001       Alok Kumar            8837221
        1002       Purnima               9911

[  OK  ] Access-control log readable  —  latest punch 16/9/2026, 5:43:22 pm, user 1001
[  OK  ] Live event stream connected
```

That User ID table is the list you map in **HRMS → Biometric**.

## Install

Needs Node 18+ on any always-on machine on the same LAN.

```bash
cd agent
cp .env.example .env     # then fill in DAHUA_PASSWORD, CRM_BASE_URL, BIOMETRIC_WEBHOOK_SECRET
node dahua-bridge.mjs
```

A healthy start looks like:

```
DCW Dahua bridge v1.0.0
device http://192.168.1.108  ->  CRM https://dcwcrm-production.up.railway.app
device serial: 7L03D2APAZ00123
event stream connected
```

## Run it forever

**Linux / Raspberry Pi (systemd)** — `/etc/systemd/system/dcw-biometric.service`:

```ini
[Unit]
Description=DCW Dahua biometric bridge
After=network-online.target

[Service]
ExecStart=/usr/bin/node /opt/dcwcrm/agent/dahua-bridge.mjs
Restart=always
RestartSec=10
User=dcw

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now dcw-biometric
journalctl -u dcw-biometric -f
```

**Windows (reception PC)** — install [NSSM](https://nssm.cc) and run
`nssm install DCWBiometric "C:\Program Files\nodejs\node.exe" "C:\dcwcrm\agent\dahua-bridge.mjs"`.

**Anywhere with pm2** — `pm2 start dahua-bridge.mjs --name dcw-biometric && pm2 save`.

## How a punch becomes attendance

1. Face is recognised → controller fires an `AccessControl` event.
2. Agent forwards it to `POST /api/biometric/punch`, signed with HMAC-SHA256.
3. CRM stores the raw event in `biometric_punches` (audit trail, never rewritten).
4. CRM rebuilds that employee's `attendance` row for the day: **first** punch is
   clock-in, **last** punch is clock-out, ≥6 h worked = `present`, less =
   `half_day`. A day already marked `leave`/`holiday` keeps its status.

Three safety nets mean a punch is never lost:

| Failure | What covers it |
|---|---|
| Stream drops / agent restarts | 10-minute catch-up poll of the device's own log |
| CRM or internet down | On-disk queue (`agent/queue.jsonl`), retried every minute |
| Same punch delivered twice | `dedupe_key` (serial + user + second) — a second delivery is a no-op |

The device itself holds 100,000 records, so even a multi-day outage replays.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `event stream -> HTTP 401` | Wrong `DAHUA_USERNAME`/`DAHUA_PASSWORD`, or the account lacks event rights |
| `cannot open record finder ... HTTP 501` | Old agent against 3.x firmware — update; the agent now detects which record API the firmware speaks |
| `device ... timed out` | Agent machine is not on the same LAN/VLAN as the controller |
| `CRM ... HTTP 401: Bad signature` | `BIOMETRIC_WEBHOOK_SECRET` differs between `.env` and Railway |
| `HTTP 401: Stale or invalid timestamp` | Agent machine's clock is off by >5 min — enable NTP |
| Punches arrive but no attendance | The `User ID` is not mapped yet — HRMS → Biometric → Mapping (mapping backfills past punches) |

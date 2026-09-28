# DCW WhatsApp admission bot

Answers students who arrive on WhatsApp from Meta / Instagram / Google ads,
qualifies them the way the two DCW chatbot briefs lay out, and hands them to
a counsellor with the lead already filled in on the CRM.

Two flows on one number:

| Flow | Who | Qualifies on |
|---|---|---|
| **Open Schooling** | 10th / 12th — NIOS, BBOSE, BOSSE, NWAC | class, fail / compartment / improvement / new / JEE-75%, board, year, subjects, marks, PCM |
| **Distance & Online College** | UG / PG — Manglayatan, MATS, Shubharti | level, course, qualification, %, mode, university, purpose, work, timeline, documents |

The ad's prefilled first message usually picks the flow; if not, the bot asks.

## How it thinks — mostly without AI

The brief was *as little AI as possible*. So:

1. **Local first.** Menu numbers, course names, percentages, years, cities,
   and ~40 approved Q&A answers from the briefs are matched with patterns.
   This handles the large majority of messages, costs nothing and always
   uses DCW's approved wording.
2. **AI only on a miss.** When a free-text answer or an off-script question
   doesn't match, one small call to Gemini (free tier) reads it.
3. **Never trusted blindly.** Every AI reply passes a guard in code that
   rejects promises ("100%", "guarantee", "pakka"), fee amounts and specific
   dates — the one rule both briefs repeat on every page. A rejected reply
   falls back to a safe scripted line.

`AI_PROVIDER=none` turns AI off completely; the bot still works on script.

On the free tier Google may use prompts to improve its models, so only the
student's message text is sent — phone numbers and emails are stripped first,
names and numbers never leave.

## Behaviour worth knowing

- **Counsellor takeover.** Type in a chat from the bot's phone and the bot goes
  silent in that chat for `HUMAN_PAUSE_HOURS` (12). It tells its own messages
  from yours by id, so it never mistakes itself for you.
- **"stop" always works.** The bot confirms once and never messages that chat
  again until they write "Hi".
- **Parents** ("mera beta 12th me fail ho gaya") are asked about *their child*.
- **Several quick messages** are read together and answered once.
- **Voice notes** get a polite request to type. **Photos/PDFs** are logged as
  the marksheet.
- **Two unreadable answers** skip that question rather than trap the student.

## Control centre (CRM → WhatsApp Bot → Control Centre)

Admin steers the bot from the CRM; the bot re-reads it every minute
(`src/control.mjs`, tables from migration 113):

- **Settings** — pause everywhere, AI on/off, and outreach limits.
  `BOT_PAUSED=true` on Railway still wins, so the brake works even if the CRM
  is down.
- **AI Knowledge** — answers admin writes. With keywords they are sent word
  for word when a message contains one (no AI); all active entries are also
  given to the AI as facts. They take priority over the built-in answers.
- **Outreach** — admin queues existing leads (by status, source, age); the bot
  messages them one at a time, inside office hours, up to the daily cap, with
  a random gap of minutes and a random wording. It skips numbers that opted
  out, are already chatting, or are not on WhatsApp. Whoever replies is
  qualified like any other chat and lands on their existing lead. Bulk first
  messages are what get unofficial clients banned — keep the cap low.

## The lead in the CRM

Created once through the CRM's normal ingest (`/api/leads/whatsapp`), so
dedupe by phone and round-robin assignment work as for every other source.
Answers land on the lead as readable fields (Class, Previous Board, Lead
Temperature, Bot Summary…). On handoff the summary goes on the lead's
timeline and the owner gets a notification — "🔥 Hot WhatsApp lead — call now"
for hot ones.

## Environment

| Variable | |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | conversation state + transcript |
| `CRM_BASE_URL` | e.g. `https://crmrahul.vercel.app/crm` |
| `WHATSAPP_BOT_SECRET` | shared with the CRM (same value on Vercel) |
| `WA_PHONE_NUMBER` | the bot's own number, e.g. `919812345678` — enables pairing-code login |
| `COUNSELOR_PHONE` | shown as "📞 Call Now" on handoff |
| `AI_PROVIDER` | `gemini` (default) or `none` |
| `GEMINI_API_KEY` | free from https://aistudio.google.com/apikey |
| `AI_MODEL` | default `gemini-2.5-flash-lite` |
| `AI_DAILY_LIMIT` | stop calling AI after this many calls/day (default 800) |
| `HUMAN_PAUSE_HOURS` | silence after a counsellor types (default 12) |
| `BOT_PAUSED` | `true` = connected and recording, but silent (emergency brake) |

## Pairing the number (once)

Use a **new, dedicated number**. Baileys is an unofficial client; WhatsApp
bans numbers that use it, sometimes without warning. A dedicated number keeps
the main business number and its chats safe.

1. Put WhatsApp (or WhatsApp Business) on that number, on any phone.
2. Set `WA_PHONE_NUMBER` and deploy. The log prints an 8-character code.
3. On the phone: **Settings → Linked devices → Link a device → Link with phone
   number instead**, and enter the code.

The credentials live on the Railway volume at `/data`, so redeploys do not
need a new pairing. `/health` is liveness; `/ready` is 200 only while
connected.

## Tests

```bash
npm test
```

24 conversation and pipeline tests — every scenario from the briefs, plus
redelivery, takeover and CRM ordering — run with no WhatsApp and no database.

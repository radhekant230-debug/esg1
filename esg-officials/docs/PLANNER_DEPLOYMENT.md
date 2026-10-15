# Sales Planner, Reminders, WhatsApp & Analytics — Deployment Guide

This upgrade is **additive**: no existing route, model field or page was removed.
New collections: `scheduledactivities`, `notificationjobs`, `auditlogs`, `counters`, `schedulerlocks`.
New optional fields: `User` (supervisor, WhatsApp number/verification, notification preferences),
`Notification` (activity, link, relatedId, dedupeKey), `SalesRecord` (salesBasis, discount, cost, expenses),
`SalesBusiness` (clientAccount), `SalesImportJob` (preview / safe-import fields).

## 1. Back up and migrate (once)

```bash
cd esg-officials/server
npm install
npm run db:backup          # writes JSON backups to server/backups/backup_<timestamp>/
npm run migrate:planner    # backs up again, creates the new indexes, reports legacy records
```

Legacy sales records stay untouched: they are treated as **Gross** sales with discount / cost / expenses
"not recorded", so the P&L shows *Data unavailable* rather than invented zeros.

## 2. Environment variables (server)

| Variable | Required | Purpose |
|---|---|---|
| `APP_BASE_URL` | yes | Frontend URL used in reminder links (e.g. `https://esg-officials.vercel.app`) |
| `CRON_SECRET` | yes on Render free plan | ≥16 chars. Protects `POST /api/planner/cron/run` |
| `REMINDER_LEAD_HOURS` | no (24) | Reminder = scheduled time − N hours |
| `ESCALATION_HOURS` | no (24) | Escalate N hours after the deadline / escalation start |
| `QUARTER_START_MONTH` | no (1) | `1` calendar quarters, `4` Indian FY quarters |
| `PLANNER_SCHEDULER_ENABLED` | no (true) | In-process scheduler on/off |
| `PLANNER_SCHEDULER_INTERVAL_MS` | no (60000) | In-process scheduler interval |
| `WHATSAPP_ACCESS_TOKEN` | for WhatsApp | Permanent System User token (Meta Business) |
| `WHATSAPP_PHONE_NUMBER_ID` | for WhatsApp | Sender phone number ID |
| `WHATSAPP_API_VERSION` | no (v21.0) | Graph API version |
| `WHATSAPP_REMINDER_TEMPLATE` | for WhatsApp | Approved reminder template name |
| `WHATSAPP_ESCALATION_TEMPLATE` | optional | Approved escalation template name |
| `WHATSAPP_OTP_TEMPLATE` | optional | Approved *authentication* template for number verification |
| `WHATSAPP_OTP_TEMPLATE_HAS_BUTTON` | no (true) | Authentication templates with a copy-code button |
| `WHATSAPP_TEMPLATE_LANGUAGE` | no (en) | Template language code exactly as approved (`en`, `en_US`, `hi`) |
| `WHATSAPP_TEMPLATE_PARAM_FORMAT` | no (named) | `named` for `{{business_name}}`, `positional` for `{{1}}` |
| `WHATSAPP_APP_SECRET` | for receipts | App secret, used to verify webhook signatures |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | for receipts | Any random string; also entered in Meta's webhook setup |

Credentials are only read on the server. If WhatsApp variables are missing, the dashboard shows a
setup warning, WhatsApp jobs are recorded as **skipped (not configured)**, and in-app notifications keep working.

## 3. WhatsApp templates (create in WhatsApp Manager, category *Utility*)

**upload_reminder** (named parameters, in this exact order):

> Upload Reminder: Your scheduled upload for {{business_name}} is due on {{scheduled_date}} at {{scheduled_time}}. Please review and complete the task before the deadline. Open: {{task_link}}

**task_escalation**:

> Escalation: The task {{task_title}} for {{business_name}} was due on {{deadline}} and is still incomplete. Please take action: {{task_link}}

**Authentication template** (optional, for self-service number verification) with one body parameter
`{{code}}` (or `{{1}}`) and a copy-code button. Without it, an admin verifies numbers in
*Manager dashboard → Reminders & Notifications → Manager WhatsApp numbers*.

Webhook: in Meta App → WhatsApp → Configuration set the callback URL to
`https://<your-api-host>/api/webhooks/whatsapp`, the verify token to `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
and subscribe to the **messages** field. Without it, sent messages stay at "accepted" (never shown as delivered).

## 4. Making reminders run without a browser

Reminders and escalations are processed **on the server**, from the `notificationjobs` collection:

1. **In-process scheduler** — runs every minute while the API process is awake.
2. **External trigger** (needed on Render's free plan, which sleeps after 15 minutes idle). Use one of:
   - The GitHub Action in `docs/planner-cron.github-workflow.yml` (every 10 min) — copy it to `.github/workflows/planner-cron.yml` at the repository root. Add repository secrets
     `PLANNER_API_URL` (e.g. `https://esg1.onrender.com`) and `PLANNER_CRON_SECRET`.
   - A Render Cron Job (paid) with command `npm run planner:run` and root dir `esg-officials/server`.
   - Any HTTP cron (cron-job.org etc.): `POST https://<api>/api/planner/cron/run` with header `X-Cron-Secret`.

Running several of these at once is safe: a MongoDB lease lock allows one runner at a time and each
notification has a unique dedupe key. The dashboard shows when the scheduler last ran.

## 5. Deploy

Backend (Render): add the variables above to the `esg1` service, deploy (`npm install`, `npm start`), then run step 1.
Frontend (Vercel): no new variables. Deploy as before (`npm run build`).

## 6. Tests

```bash
cd esg-officials/server
npm test                    # unit tests: IST dates, reminder/escalation rules, WhatsApp client, import parser, P&L maths
# End-to-end (10 acceptance scenarios) against a THROW-AWAY database:
MONGO_URI_TEST="mongodb+srv://<test-cluster>/..." npm run test:integration
# or locally without MongoDB:  npm i -D mongodb-memory-server && npm run test:integration
```

The integration script uses a database whose name ends in `_test`, drops it before and after,
and refuses to run against `MONGO_URI`. It uses a local mock of the WhatsApp API — to verify the
real WhatsApp delivery, schedule a test upload ~24h ahead (or temporarily set `REMINDER_LEAD_HOURS`
so the reminder is due now), click *Run now* in Reminders & Notifications (admin) and check the
delivery status column (accepted → delivered from the webhook, or failed with Meta's error).

## 7. Where things are

| Area | Location |
|---|---|
| Manager sections | `/manager/dashboard?tab=overview|analytics|calendar|quarter|uploads|reminders|approvals|escalations|imports` |
| Client schedule | Client portal → *Schedule & Calendar* tab |
| Planner API | `server/routes/planner.js`, `controllers/plannerController.js`, `services/planner/*` |
| WhatsApp | `server/services/whatsappService.js`, webhook `routes/whatsappWebhook.js` |
| Import | `controllers/salesImportController.js`, `services/sales/importParser.js` |
| Analytics | `controllers/salesAnalyticsController.js`, `services/sales/financials.js` |
| Audit trail | `auditlogs` collection (`models/AuditLog.js`, append-only) |

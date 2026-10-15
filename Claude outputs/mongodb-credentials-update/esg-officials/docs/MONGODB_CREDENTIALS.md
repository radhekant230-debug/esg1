# MongoDB credentials: configuration, health checks and rotation

This covers the backend in `esg-officials/server` (Express + Mongoose), which Render deploys from `render.yaml`
(service `esg1`). The React client (`esg-officials/client`, Vercel) only calls the backend API. It never connects
to MongoDB and must never hold database credentials.

> **Nothing here rotates passwords automatically.** Changing a password in MongoDB Atlas does **not** update
> Render's `MONGO_URI`. Rotation is a deliberate, manual procedure with a verification step before and after.

## 1. Configuration

| Variable | Where | Required | Notes |
|---|---|---|---|
| `MONGO_URI` | backend only | yes | `mongodb+srv://USER:PASSWORD@CLUSTER/esg-official-clients?retryWrites=true&w=majority`. Validated at startup. Placeholders, `tls=false` and disabled certificate checks are rejected. |
| `JWT_SECRET` | backend only | yes | At least 64 random hex characters. Changing it signs every user out. |
| `MONGO_DB_NAME` | backend | no | Default `esg-official-clients`. |
| `MONGO_MAX_POOL_SIZE` | backend | no | Default 10 (one shared pool per instance). |
| `MONGO_CONNECT_RETRIES` | backend | no | Default 5 start-up retries for network errors. Auth errors are never retried. |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | backend | no | Default 10000. |
| `VITE_API_URL` | client | yes | Backend URL only. Every `VITE_` value is public. |

- **Local:** `server/.env` (git-ignored). Copy `server/.env.example` and fill it in.
- **Render:** Dashboard → `esg1` → **Environment**. `render.yaml` declares `MONGO_URI` and `JWT_SECRET` with
  `sync: false`, so their values live only in Render.

### How the backend uses it

`server/config/db.js` is the single connection module. `index.js`, all portal APIs and the CLI scripts use it.

- It validates the URI before connecting.
- It opens one Mongoose connection pool per process.
- It retries network failures with backoff. It stops immediately on authentication failures.
- It lets the driver reconnect after outages.
- It logs `connected` / `disconnected` / `reconnected` / `connection_error` as JSON lines. Logs never contain the
  URI, user name, password or host.
- While MongoDB is unavailable, `/api/*` answers **503 `DATABASE_UNAVAILABLE`** at once instead of hanging.
- On SIGTERM (Render deploys and restarts) it stops the schedulers, finishes in-flight requests and closes the
  connection.

### Health endpoints

| Endpoint | Meaning | Codes |
|---|---|---|
| `GET /api/health/live` | Process is running | always 200 |
| `GET /api/health` (= `/api/health/ready`) | Config present and valid, MongoDB connected and answering ping, startup tasks done | 200 ready / 503 not ready |

Example ready response:

```json
{ "status": "ok", "ready": true, "uptimeSec": 812,
  "checks": { "config": { "MONGO_URI": true, "MONGO_URI_valid": true, "JWT_SECRET": true },
              "database": { "status": "connected", "reachable": true, "latencyMs": 23, "lastErrorCode": null, "reconnects": 0 },
              "startupTasksComplete": true } }
```

`status` can also be `starting`, `degraded`, `unavailable` or `misconfigured`. `lastErrorCode` is one of `AUTH_FAILED`,
`NETWORK_ACCESS_DENIED`, `UNREACHABLE`, `DNS_LOOKUP_FAILED`, `NOT_AUTHORIZED`, `INVALID_URI`. Responses never include
secrets.

Render uses `/api/health` as its health check path. A deploy whose new `MONGO_URI` does not work never becomes
healthy, and Render keeps the previous instance serving traffic. Check this zero-downtime behaviour for your plan
in Render's documentation; on a single free instance there can still be a short gap during restarts.

## 2. Least privilege and network access (Atlas)

1. **Database Access:** the app's user gets **Specific Privileges → `readWrite` @ `esg-official-clients`** only.
   Use separate, personal users for humans. Use no Atlas admin role for the app. `npm run db:verify` warns if the
   user has broad roles.
2. **Network Access:** allow Render's outbound IPs (Render → service → **Connect → Outbound**) plus your own IP
   while developing. Remove `0.0.0.0/0` if it is set.
3. Keep TLS on (Atlas enforces it). Never add `tlsAllowInvalidCertificates`; the server refuses to start with it.

## 3. Rotating the database password

### Recommended: zero-downtime with a second database user

You need Atlas Project Owner (or Database Access admin) rights and access to Render → `esg1` → Environment.

1. **Create the replacement user** in Atlas → Database Access → **Add New Database User**.
   - Use a new name, e.g. `esg_app_2026q4`.
   - Use password authentication. Choose **Autogenerate Secure Password** and copy it into your password manager.
   - Use the same privileges as the current user: **Specific Privileges → `readWrite` @ `esg-official-clients`**.
   - Restrict access to this cluster.
2. **Build the new connection string.** Use the current one with the new user name and URL-encoded password. Keep
   it in your password manager, not in a file.
3. **Validate it before it reaches production.** From `esg-officials/server`, run:

   ```bash
   npm run db:verify -- --candidate --write-check
   ```

   Paste the new string at the hidden prompt. All steps must show `PASS`: format, connect + authenticate, ping,
   read, and a temporary write/delete in `_connection_checks`. Fix any `FAIL` before going on. Your IP must be
   allowed in Atlas for this.
4. **Update Render.** Go to `esg1` → **Environment** → edit `MONGO_URI` → paste the new string → **Save, rebuild,
   and deploy** (or **Save and deploy**). Saving alone does not affect the running instance; it needs a deploy or
   restart.
5. **Watch the deploy.** In the Render **Events/Logs**, look for `"event":"connected"` then `"event":"ready"`. A
   `connect_failed` with `AUTH_FAILED` means the new string is wrong. The deploy then fails its health check while
   the old instance keeps serving.
6. **Verify the live service:**

   ```bash
   HEALTH_URL=https://<your-service>.onrender.com npm run health:check
   # optional API checks with TEST accounts:
   # SMOKE_ADMIN_EMAIL=… SMOKE_ADMIN_PASSWORD=… SMOKE_MANAGER_EMAIL=… … npm run health:check
   ```

   Also sign in to the Admin, Manager and Client portals once and open a page that reads data.
7. **Update other places that use the old string**: your local `server/.env`, teammates' machines, and anywhere
   you run `npm run db:backup`, `migrate:planner` or `link:clients`.
8. **Revoke the old user only after steps 5–7 succeed.** Wait about 30 minutes and check the Render logs for
   errors. Then go to Atlas → Database Access → old user → **Delete**.
9. Run `npm run health:check` again.

### Simpler: change the existing user's password (short interruption)

1. Atlas → Database Access → the app user → **Edit → Edit Password** → set a new password → **Update User**.
   Connections already open keep working. New connections fail until step 2 is done.
2. Immediately update `MONGO_URI` in Render and **Save and deploy** (step 4 above). Then do steps 5–7.
3. There is no fallback user. If the new value is wrong, fix it in Render right away, or set the password back in
   Atlas.

## 4. Rollback

| Situation | Action |
|---|---|
| New deploy fails health check (old user still exists) | Render → Environment → set `MONGO_URI` back to the previous value → **Save and deploy**. Render's "Rollback" button redeploys an earlier build but does **not** restore old environment variable values, so set the variable explicitly. |
| `AUTH_FAILED` after a password change on the same user | Correct the password in `MONGO_URI` (check URL-encoding) or reset the user's password in Atlas to the value Render has, then deploy. |
| `NETWORK_ACCESS_DENIED` / `UNREACHABLE` | Atlas Network Access must include Render's outbound IPs. Check the cluster is not paused. |
| Old user already deleted and new one fails | Create a new user (step 1), validate it (step 3), update Render (step 4). |

## 5. If a secret was exposed

1. Rotate it with the procedure above. For `JWT_SECRET`, generate a new one; everyone has to sign in again.
2. Also rotate any other key that was exposed with it, such as Resend or Cloudinary, in that provider's dashboard
   and in Render.
3. If it was pushed to GitHub, rotating is mandatory. Removing it from history (`git filter-repo`) does not undo
   the exposure.

## 6. Tests

- `npm test` runs unit tests for `config/db.js` and the health endpoint with an in-memory fake. They need no
  database and use no credentials. They cover:
  - missing or invalid URIs;
  - invalid credentials (no retry, no leak);
  - retry and recovery;
  - disconnect and reconnect;
  - a restart with a changed secret;
  - health output without secrets;
  - startup refusing a bad configuration.
- `npm run test:integration` (needs `MONGO_URI_TEST` or `mongodb-memory-server`, **never production**) adds:
  - scenario 17: health endpoints;
  - scenario 18: a real outage, fast 503s and recovery, then the Admin, Manager and Client portal APIs;
  - scenario 19: a full rotation on the test database (second user → switch → verify → revoke old user → old
    credentials rejected).

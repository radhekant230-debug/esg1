# MongoDB credentials update: separate working copy

This folder is a **separate copy** of the backend with the MongoDB credential, health-check and rotation changes
applied. Your original project in `esg offical\esg-officials` is **unchanged**.

| Folder | Contents |
|---|---|
| `esg-officials\server` | Complete backend: the original sources plus the changes. `node_modules` is not included; run `npm install`. |
| `esg-officials\server\.env` | Your existing local values, copied unchanged from `esg-officials\server\.env`. Git-ignored. Never commit or share it. |
| `esg-officials\docs\MONGODB_CREDENTIALS.md` | Environment variables, Render setup, credential rotation, rollback. |
| `esg-officials\client` | Only the updated `.gitignore`. The React app itself did not change; keep using the original client. |
| `render.yaml`, `.gitignore` | Updated versions for the repository root. |

## Run the backend locally (Windows, from this folder)

```powershell
cd "C:\Users\user\Downloads\esg offical\Claude outputs\mongodb-credentials-update\esg-officials\server"
npm install
npm test               # unit tests (no database needed)
npm run db:verify      # checks MONGO_URI from .env: login, ping, read, roles (prints no secrets)
npm run dev            # or: npm start
```

Then open <http://localhost:5000/api/health>. It shows `"ready": true` only when MongoDB is connected.
`/api/health/live` only shows that the process is running.

Run this copy **or** the original server on port 5000, not both at the same time. You can also set `PORT=5001` in this
copy's `.env`.

## Moving the changes into the real project (only when you are satisfied)

Copy the changed files listed in `CHANGED_FILES.txt` into `esg offical\` at the same relative paths. Do **not** copy
`esg-officials\server\.env`; the original already has it. Commit and push; Render redeploys from `render.yaml`.

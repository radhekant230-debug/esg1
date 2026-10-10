# ESG Officials — Client Management Portal

A full-stack client management portal for ESG Officials, paired with a static marketing website. Admin and Manager users manage projects, tasks, approvals, documents, and messages. Clients access their portal through a JWT-authenticated dashboard.

---

## Project Structure

```
esg offical/
├── esg-officials/          ← Full-stack portal (React + Express + MongoDB)
│   ├── client/             ← React 19 + Vite + Tailwind CSS frontend
│   └── server/             ← Express 5 + Mongoose backend API
└── esgofficial/            ← Static HTML/CSS/JS marketing website
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router v7, Axios, Tailwind CSS v4, Vite 8 |
| Backend | Node.js (CommonJS), Express 5 |
| Database | MongoDB (Mongoose 9) — local or Atlas |
| Auth | JWT (7-day expiry) + bcryptjs + OTP email verification |
| Email | Resend API (OTP delivery, notifications, contact form) |
| File uploads | Multer (memory) + Cloudinary |

---

## Prerequisites

- Node.js v18 or later
- npm v9 or later
- MongoDB Atlas account (or local MongoDB for development)
- A Resend account (for OTP emails, notifications, contact form)
- A Cloudinary account (for document file uploads)

---

## 1. Clone / Download

```bash
# The project root is "esg offical/" — work inside it
cd "esg offical"
```

---

## 2. Configure the Server

```bash
cd esg-officials/server
cp .env.example .env
```

Open `server/.env` and fill in every value:

| Variable | Description |
|---|---|
| `PORT` | Port for the Express server (default: `5000`) |
| `MONGO_URI` | MongoDB Atlas connection string — see below |
| `JWT_SECRET` | Long random string — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `RESEND_API_KEY` | API key from your Resend dashboard — see below |
| `EMAIL_FROM` | Verified sender address, e.g. `ESG Officials <noreply@yourdomain.com>` |
| `CONTACT_RECEIVER_EMAIL` | Email address that receives consultation enquiries |
| `CLIENT_URL` | React app origin for CORS — `http://localhost:5173` in dev |
| `STATIC_SITE_URL` | Static marketing site origin — `http://localhost:5500` in dev |
| `CLOUDINARY_CLOUD_NAME` | From your Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From your Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From your Cloudinary dashboard |

### MongoDB Atlas setup (recommended for production)

1. Create a free cluster at <https://cloud.mongodb.com>
2. Create a database user with read/write access
3. Whitelist your IP (or use `0.0.0.0/0` for all IPs)
4. Copy the connection string from **Connect → Drivers**:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/esg-official-clients?retryWrites=true&w=majority
   ```
5. Paste it as `MONGO_URI` in `server/.env`

### Resend email setup

1. Create a free account at <https://resend.com>
2. Go to **API Keys** → create a key with "Sending access"
3. Paste it as `RESEND_API_KEY` in `server/.env`
4. **Verify a domain** (required to send to any email address):
   - Go to **Domains** → Add domain → follow the DNS record instructions
   - Once verified, set `EMAIL_FROM` to `ESG Officials <noreply@yourdomain.com>`
5. **Without a verified domain** (testing only):
   - You can send from `onboarding@resend.dev` but only to the email you registered with on Resend
   - Leave `EMAIL_FROM` unset and set `CONTACT_RECEIVER_EMAIL` to your Resend account email

### Cloudinary

1. Create a free account at <https://cloudinary.com>
2. Go to **Dashboard → Account Details**
3. Copy Cloud name, API Key, and API Secret into `server/.env`

---

## 3. Configure the Client

```bash
cd esg-officials/client
cp .env.example .env
```

For local development the defaults in `.env.example` are correct — no changes needed.

For production, update `VITE_API_URL` to your deployed backend URL:

```
VITE_API_URL=https://your-backend-domain.com/api
```

---

## 4. Install Dependencies

```bash
# Install server dependencies
cd esg-officials/server
npm install

# Install client dependencies
cd ../client
npm install
```

---

## 5. Run in Development

Open two terminals:

**Terminal 1 — Backend**
```bash
cd esg-officials/server
npm run dev
# Server starts on http://localhost:5000
```

**Terminal 2 — Frontend**
```bash
cd esg-officials/client
npm run dev
# Vite dev server starts on http://localhost:5173
```

Open <http://localhost:5173> in your browser.

### Static marketing website

Open `esgofficial/index.html` directly in a browser, **or** serve it with a local server (e.g. VS Code Live Server on port 5500) so the contact form can POST to the backend.

---

## 6. Seed Demo Data

With the server running and MongoDB connected:

```bash
cd esg-officials/server
node seed.js
```

This creates:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@esgofficial.com` | `password123` |
| Manager | `rahul.manager@esgofficial.com` | `password123` |
| Manager | `priya.manager@esgofficial.com` | `password123` |
| Client | `aarav@client.com` (CLI-YYYY-0001) | `password123` |
| Client | `neha@client.com` | `password123` |
| Client | `rohan@client.com` | `password123` |

---

## 7. API Reference

All routes are under `/api`. Authentication uses `Authorization: Bearer <token>`.

| Prefix | Description |
|---|---|
| `POST /api/auth/register` | Register a new client |
| `POST /api/auth/login` | Login — returns token or triggers OTP |
| `POST /api/auth/verify-otp` | Verify OTP, returns JWT |
| `GET/POST /api/projects` | List / create projects |
| `GET/PUT/DELETE /api/projects/:id` | Read / update / delete a project |
| `GET/POST /api/tasks` | List / create tasks |
| `GET/PUT/DELETE /api/tasks/:id` | Read / update / delete a task |
| `GET/POST /api/documents` | List / upload documents (`multipart/form-data`) |
| `DELETE /api/documents/:id` | Delete a document + Cloudinary asset |
| `GET/POST /api/approvals` | List / create approvals |
| `PUT /api/approvals/:id/approve` | Approve |
| `PUT /api/approvals/:id/reject` | Reject |
| `GET /api/messages` | List messages |
| `GET /api/messages/conversations` | List conversations |
| `POST /api/messages` | Send a message |
| `GET /api/notifications` | List notifications |
| `GET /api/clients` | Admin: list all clients |
| `GET /api/activity` | Admin: activity log |
| `POST /api/contact` | Public: consultation form submission |

---

## 8. User Roles

| Role | Access |
|---|---|
| **Admin** | Full access to all data, clients, managers, activity logs |
| **Manager** | Projects/tasks assigned to them, documents in those projects |
| **Client** | Own projects, tasks, approvals, messages, documents |

Clients who self-register via the portal receive an OTP to their email before they can log in.

---

## 9. Features Summary

- **Authentication**: JWT login, OTP email verification for new clients, role-based route guards
- **Projects**: Full CRUD with status, priority, progress tracking
- **Tasks**: Full CRUD linked to projects and managers
- **Approvals**: Clients review project updates; admin/manager approve or reject
- **Documents**: Admin/Manager upload real files (Cloudinary) per project; all roles can download; admin/manager can delete (file is removed from Cloudinary)
- **Messages**: Per-project conversations between staff and clients
- **Notifications**: Real-time (polling) bell with unread count; auto-created on key events
- **Activity Logs**: Admin audit trail for all document, project, and task operations
- **Contact Form**: Static marketing site consultation form posts to `/api/contact`; sends notification email to the business and auto-reply to the visitor

---

## 10. Deployment

### Backend (e.g. Render, Railway, Fly.io)

1. Push the `esg-officials/server` folder to a Git repository or deploy directly
2. Set all environment variables from `.env.example` in the platform's settings
3. Set the start command to `npm start`
4. Ensure your MongoDB Atlas cluster IP allowlist includes the host's IP (or `0.0.0.0/0`)

### Frontend (e.g. Vercel, Netlify)

1. Set the root directory to `esg-officials/client`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Set `VITE_API_URL` to your deployed backend URL in the platform's environment settings

### Static Marketing Site (e.g. Netlify Drop, GitHub Pages, Vercel)

1. Deploy the `esgofficial/` folder as a static site
2. Add this script before `main.js` on pages that submit the contact form or link to the client portal:
   ```html
   <script>
     window.ESG_API_URL = 'https://your-backend-domain.com/api';
     window.ESG_PORTAL_URL = 'https://your-portal-domain.com/login';
   </script>
   ```
   `ESG_API_URL` connects the contact form; `ESG_PORTAL_URL` makes the static login page hand off to the secure React portal. Do not point the static login page at `portal.html`, which is mock-only content.

---

## 11. Environment Variables Quick Reference

### `server/.env`

```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/esg-official-clients?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=<64-char hex string>
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=ESG Officials <noreply@yourdomain.com>
CONTACT_RECEIVER_EMAIL=enquiries@yourcompany.com
CLIENT_URL=http://localhost:5173
STATIC_SITE_URL=http://localhost:5500
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### `client/.env`

```
VITE_API_URL=http://localhost:5000/api
```

---

## 12. Troubleshooting

| Problem | Solution |
|---|---|
| `MongooseServerSelectionError` | Replace any `<db_password>` placeholder in `MONGO_URI`, then allow the current/deployed host IP in Atlas **Network Access** and verify the database user has access |
| OTP emails not sending | Check `RESEND_API_KEY` is set and valid; check Resend dashboard for send logs and error codes |
| Email arrives only at one address | Your Resend domain is not verified — without verification, Resend restricts delivery to your registered account email only. Verify a domain at resend.com/domains |
| CORS error in browser | Ensure `CLIENT_URL` in `server/.env` matches the exact origin of your React dev server |
| File upload fails with 503 | Fill in `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` |
| Contact form shows "Network error" | Ensure the backend server is running and `ESG_API_URL` points to the correct address |
| Client login redirects back to login | Make sure the client has verified their OTP email |

## BarterBiz API

Backend for BarterBiz MVP: Express + Prisma + PostgreSQL with JWT auth and barter marketplace flows.

### Prerequisites
- Node.js 18+
- PostgreSQL

### Setup
1) Install dependencies:
   ```bash
   npm install
   ```
2) Create `.env` from `.env.example` and set values (`DATABASE_URL`, `JWT_SECRET`, `PORT`).
3) Run migrations and generate Prisma client:
   ```bash
   npx prisma migrate dev
   ```
4) Seed sample data (optional for staging/local):
   ```bash
   npm run seed
   ```

### Scripts
- `npm run dev` — start in watch mode (ts-node-dev).
- `npm run build` — compile TypeScript to `dist`.
- `npm start` — run compiled server (Railway/production entrypoint).
- `npm run seed` — seed sample users/businesses/opportunities.
- `npm run prisma:generate` — regenerate Prisma client.
- `npm run prisma:migrate` — apply migrations in dev.
- `npm run prisma:deploy` — apply migrations in production.

### Deployment notes
- Railway command: `npm run start` (ensure `npm run build` runs first).
- Set env vars in Railway: `DATABASE_URL`, `JWT_SECRET`, `PORT` (Railway injects `PORT`; keep fallback 4000 locally).

### Railway Deployment Troubleshooting

**If you see 404 errors on Railway but the service shows ONLINE:**

1. **Verify environment variables are set:**
   - Go to Railway dashboard → Project → Variables
   - Ensure `DATABASE_URL` is set (use `${{ Postgres.DATABASE_URL }}` reference if using Railway Postgres)
   - Ensure `JWT_SECRET` is set to a secure random string

2. **Check deployment logs:**
   - Railway → Deployments → Latest → View Logs
   - Look for `[STARTUP] ✅ BarterBiz API running on 0.0.0.0:4000`
   - If you see `Missing required environment variables`, the env vars aren't being injected

3. **Verify domain routing:**
   - Railway → Public Networking → Ensure domain points to port `4000`
   - Domain should be configured as `https://your-domain.railway.app` → `0.0.0.0:4000`

4. **Test the health endpoint:**
   - Try: `curl https://your-domain.railway.app/health`
   - Should return: `{"ok": true}`

5. **If still failing:**
   - Redeploy: Railway → Deployments → Redeploy Latest
   - Check that `railway.json` exists in the root directory
   - Verify `npm run build` completes successfully in build logs

### QA flows covered
- Signup/login, business profile, services, opportunities, proposals → deals, messaging, completion, ratings, notifications.

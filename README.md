# Greenhouse Monitoring Web App

Full-stack web app for greenhouse insect monitoring:
- Frontend: Next.js (App Router) in `frontend`
- Backend: FastAPI in `backend`
- Auth/Data: Supabase
- AI inference: FastAPI endpoint consumed by frontend server actions

## Repository

GitHub repository:
- https://github.com/superML-dl/Greenhouse_monitoring_webapp.git

## Project Structure

- `frontend` : Next.js dashboard UI (deployed to Vercel)
- `backend` : FastAPI inference API (deploy to a Python host)
- `weights` : model files
- `start-frontend.cmd` / `start-backend.cmd` : local startup scripts

## Prerequisites

- Node.js 18+
- npm
- Python 3.10+
- Git
- Supabase project

## Environment Variables

### Frontend (`frontend/.env.local`)

Set these for local dev and Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BACKEND_URL`

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
BACKEND_URL=http://localhost:8000
```

### Backend (`backend/.env`)

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CORS_ORIGINS`
- optional: `MAX_UPLOAD_SIZE_MB`

Example:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
CORS_ORIGINS=["https://your-vercel-domain.vercel.app","http://localhost:3000"]
MAX_UPLOAD_SIZE_MB=10
```

## Local Development

### 1) Install frontend dependencies

```bat
cd frontend
npm install
```

### 2) Install backend dependencies

```bat
cd backend
pip install -r requirements.txt
```

### 3) Run backend

```bat
start-backend.cmd
```

Or directly:

```bat
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4) Run frontend

```bat
start-frontend.cmd
```

Or directly:

```bat
cd frontend
npm run dev
```

Frontend default: `http://localhost:3000`
Backend default: `http://localhost:8000`

## Deploy Frontend to Vercel

### Option A: Vercel Dashboard

1. Push project to GitHub (see section below).
2. In Vercel, click **Add New Project**.
3. Import `superML-dl/Greenhouse_monitoring_webapp`.
4. Set **Root Directory** to `frontend`.
5. Framework preset should auto-detect as Next.js.
6. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `BACKEND_URL` (your deployed backend URL)
7. Deploy.

### Option B: Vercel CLI

```bat
cd frontend
npm i -g vercel
vercel
vercel --prod
```

Then configure env vars in Vercel project settings and redeploy.

## Deploy Backend (Required)

Vercel is for the Next.js frontend. The FastAPI backend should be deployed to a Python host (for example: Railway, Render, Azure App Service, VM, or container host).

After backend is live:

1. Update frontend env `BACKEND_URL` in Vercel.
2. Set backend `CORS_ORIGINS` to include your Vercel domain.

## Push to GitHub

Run from project root (`webapp_anti`):

```bat
git init
git branch -M main
git add .
git commit -m "Initial commit: greenhouse monitoring webapp"
git remote add origin https://github.com/superML-dl/Greenhouse_monitoring_webapp.git
git push -u origin main
```

If `origin` already exists:

```bat
git remote set-url origin https://github.com/superML-dl/Greenhouse_monitoring_webapp.git
git push -u origin main
```

## Security Notes

- Never commit `.env` files, keys, tokens, certificates, or credential dumps.
- This repository includes a root `.gitignore` with security-focused patterns.
- Use Supabase service role key only on backend/server side.
- Keep `NEXT_PUBLIC_*` values limited to public-safe values.
- Restrict backend CORS to your trusted frontend origins.

## Quick Verification Checklist

- Frontend builds locally: `cd frontend && npm run build`
- Backend runs: `python -m uvicorn app.main:app --reload`
- Vercel env vars set correctly
- Backend CORS includes Vercel domain
- No secret files shown by `git status`

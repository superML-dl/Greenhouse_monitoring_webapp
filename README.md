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



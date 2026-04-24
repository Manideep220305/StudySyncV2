# StudySync Plain Docker Runbook (No Docker Compose)

This setup runs the full stack using regular Docker commands and PowerShell scripts.

## Services

- MongoDB: container `studysync-mongo` on port `27017`
- FastAPI RAG: container `studysync-fastapi` on port `8000`
- Node backend: container `studysync-backend` on port `5000`
- Frontend (Nginx): container `studysync-frontend` on port `8080`

## Prerequisites

- Docker Desktop is installed and running.
- `backend/.env` exists and contains at least:
  - `JWT_SECRET`
  - any optional values you need (Cloudinary, etc.)
- `fastapi-rag/.env` exists and contains a real `GROQ_API_KEY`.

## One-command startup (recommended)

From project root:

```powershell
./docker/run.ps1
```

This script will:

- create a dedicated Docker network and Mongo volume
- build all images from current source
- start all containers with stable wiring
- apply safe runtime overrides (`MONGO_URI`, `FASTAPI_URL`, `CORS_ORIGINS`, etc.)
- wait for health endpoints before marking startup complete
- fail fast on any Docker command error with a direct command/context message

## Stop stack

```powershell
./docker/stop.ps1
```

Optional cleanup:

```powershell
./docker/stop.ps1 -RemoveNetwork -RemoveData
```

Use `-RemoveData` only if you want to delete MongoDB persisted data.

## Manual plain Docker commands (without scripts)

```powershell
docker network create studysync-network
docker volume create studysync-mongo-data

docker run -d --name studysync-mongo --network studysync-network -p 27017:27017 -v studysync-mongo-data:/data/db --restart unless-stopped mongo:7

docker build -t studysync-fastapi:latest ./fastapi-rag
docker run -d --name studysync-fastapi --network studysync-network -p 8000:8000 --env-file fastapi-rag/.env -e NODE_BACKEND_URL=http://studysync-backend:5000 --restart unless-stopped studysync-fastapi:latest

docker build -t studysync-backend:latest ./backend
docker run -d --name studysync-backend --network studysync-network -p 5000:5000 --env-file backend/.env -e NODE_ENV=production -e PORT=5000 -e MONGO_URI=mongodb://studysync-mongo:27017/studysync -e FASTAPI_URL=http://studysync-fastapi:8000 -e CLIENT_URL=http://localhost:8080 -e CORS_ORIGINS=http://localhost:8080 --restart unless-stopped studysync-backend:latest

docker build -t studysync-frontend:latest --build-arg VITE_API_URL=http://localhost:5000 --build-arg VITE_SOCKET_URL=http://localhost:5000 ./frontend
docker run -d --name studysync-frontend --network studysync-network -p 8080:80 --restart unless-stopped studysync-frontend:latest
```

## Health checks

- Frontend: `http://localhost:8080/health`
- Backend: `http://localhost:5000/health`
- FastAPI: `http://localhost:8000/health`

## Common failure fixes

- Frontend loads but API calls fail:
  - rebuild frontend with correct `VITE_API_URL` and `VITE_SOCKET_URL` build args.
- Backend fails on boot with missing env:
  - confirm `backend/.env` contains `JWT_SECRET`.
- FastAPI exits immediately:
  - confirm `fastapi-rag/.env` has a valid `GROQ_API_KEY`.
- Port conflict:
  - free ports `8080`, `5000`, `8000`, `27017`, or adjust `docker run -p` mappings.

## Upgrade/rebuild flow for same codebase

Any time dependencies or code changes:

```powershell
./docker/stop.ps1
./docker/run.ps1
```

This guarantees fresh images and avoids stale container state issues.

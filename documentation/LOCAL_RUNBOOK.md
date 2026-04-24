# StudySync Local Runbook (No Docker)

Use this when Docker Desktop is not available.

## Prerequisites

- Node.js and npm installed
- Python installed
- backend/.env exists
- fastapi-rag/.env exists
- fastapi-rag/.env has a real GROQ_API_KEY value

## Start all services

From project root:

./scripts/run-local.ps1

This starts:

- Backend on 5000
- FastAPI on 8000
- Frontend on 5173

## Health checks

- Frontend: http://localhost:5173
- Backend: http://localhost:5000/health
- FastAPI: http://localhost:8000/health

## Stop all services

./scripts/stop-local.ps1

## Common issues

- Port already in use:
  - Stop any process running on 5000, 5173, or 8000, then run start script again.
- FastAPI fails at startup:
  - Check GROQ_API_KEY in fastapi-rag/.env.
- Backend says AI dependency offline:
  - Confirm FastAPI health endpoint is up on 8000.

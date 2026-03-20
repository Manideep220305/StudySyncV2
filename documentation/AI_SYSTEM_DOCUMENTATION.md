# StudySync AI System Documentation

## 1. Scope

This document describes the AI subsystem for StudySync with two views:
- target architecture (RAG + agents)
- current implementation status in this repository

It covers:
- RAG pipeline design using LangChain + ChromaDB
- agent orchestration flow using CrewAI
- backend to AI-service integration contract
- end-to-end request/response flow
- current capabilities vs missing features

---

## 2. Current Status Snapshot

Status summary:
- RAG microservice: not implemented in codebase
- CrewAI orchestration: not implemented in codebase
- Node backend AI proxy endpoints: not implemented in codebase
- Current quiz system: implemented as non-RAG local question bank (in-memory)

Evidence in current code:
- backend services note quiz v1 is intentionally non-RAG
- no fastapi-rag directory exists in workspace root
- no LangChain/ChromaDB/CrewAI dependencies exist in backend/frontend package manifests
- no AI-specific routes mounted in Express app

Practical interpretation:
- AI architecture is defined at spec/document level
- runtime functionality is currently classical app logic + realtime quiz/chat

---

## 3. AI System Target Architecture

### 3.1 Service boundaries

Target topology uses three service layers:
1. Frontend (React)
2. Backend API Gateway (Node/Express)
3. AI Microservice (Python/FastAPI)

Responsibilities:
- Frontend: upload PDFs, ask questions, show answers/sources
- Node backend: auth, RBAC, request validation, proxying, telemetry
- AI microservice: document ingestion, embedding, retrieval, generation

### 3.2 Data planes

Control plane data:
- userId
- groupId
- role (leader/member)
- request metadata (topic, difficulty, question count)

RAG data plane:
- uploaded PDF binaries
- extracted text chunks
- chunk embeddings
- vector index metadata
- retrieval contexts and generated answer payloads

### 3.3 Collections and index keys (target)

Suggested logical keys:
- tenant key: groupId
- document key: documentId
- chunk key: documentId + chunkIndex

Required metadata per chunk:
- groupId
- documentId
- source filename
- page number (if available)
- timestamp/version

---

## 4. RAG Pipeline (LangChain + ChromaDB)

### 4.1 Ingestion pipeline

Target steps:
1. Receive PDF upload (group-scoped, authenticated)
2. Parse document text (PyMuPDF or equivalent)
3. Split into chunks using LangChain text splitter
4. Generate embeddings for each chunk
5. Store vectors + metadata in ChromaDB
6. Return ingestion summary to backend

Expected ingestion output:
- documentId
- chunksStored
- embeddingModel
- indexNamespace (groupId)
- warnings (empty pages, parse failures)

### 4.2 Retrieval pipeline

Target steps:
1. Receive user question + groupId
2. Embed query text
3. Query ChromaDB for top-k similar chunks
4. Build grounded prompt from retrieved context
5. Generate answer with LLM
6. Return answer + citations + confidence hints

Recommended defaults:
- topK: 3 to 8
- chunk overlap: 10% to 20%
- max context tokens capped by model limits

### 4.3 Quiz generation from RAG context

Target variant for quiz flow:
1. Retrieve relevant chunks for requested topic
2. Ask model to create N multiple-choice questions
3. Include correct option index and explanation
4. Validate schema before returning to backend

Quiz payload contract (target):
- quizId
- topic
- questions[]
  - question
  - options[4]
  - correctIndex
  - explanation
  - sources[]

### 4.4 ChromaDB persistence modes

Local development mode:
- persistent directory enabled
- useful for repeat queries across restarts

Ephemeral/cloud free-tier mode:
- in-memory only
- index lost on restart
- requires re-ingestion strategy

---

## 5. Agent Flow (CrewAI)

### 5.1 Orchestration objective

CrewAI layer is intended to coordinate multi-step AI tasks so generation is:
- context-aware
- role-aware (group member vs leader actions)
- deterministic in output schema

### 5.2 Proposed agent roles

1. Ingestion Agent
- validates file type and size
- normalizes metadata
- triggers chunking and embedding jobs

2. Retrieval Agent
- converts user prompt to retrieval intent
- tunes topK and filtering by group/document
- returns ranked context snippets

3. Generation Agent
- builds final prompt with context blocks
- generates grounded answer or quiz
- enforces output schema

4. Validation Agent
- checks hallucination risk signals
- verifies source coverage
- rejects malformed response payloads

### 5.3 Crew execution sequence

For Ask Notes flow:
- Retrieval Agent -> Generation Agent -> Validation Agent

For PDF upload flow:
- Ingestion Agent -> Validation Agent

For Quiz-from-notes flow:
- Retrieval Agent -> Generation Agent -> Validation Agent

### 5.4 Current status

CrewAI runtime is not implemented in this repository.
No CrewAI configs, crew definitions, or Python agent modules are present.

---

## 6. Backend -> AI Service Integration

### 6.1 Why Node should call AI service

Node remains the single public gateway for:
- JWT/cookie auth validation
- group membership and role checks
- request shaping and quotas
- centralized logging and error normalization

This prevents direct frontend access to the AI microservice.

### 6.2 Target backend integration points

Proposed Express endpoints (target):
- POST /api/ai/upload
- POST /api/ai/ask
- POST /api/ai/generate-quiz
- GET /api/ai/health

Internal proxy calls from Node to FastAPI:
- POST /ingest
- POST /ask
- POST /generate-quiz
- GET /health

### 6.3 Validation rules before proxying

Node should validate:
- authenticated user present
- user is member of target group
- payload size and prompt length
- allowed mime types for uploads
- rate limits per user/group

### 6.4 Response normalization

Node should normalize FastAPI responses to frontend-safe schema:
- success boolean
- data payload
- machine-readable error code
- user-friendly message

Current status:
- no AI proxy controllers/routes currently implemented

---

## 7. End-to-End Request/Response Flows

### 7.1 Ask Notes flow (target)

1. Frontend sends question + groupId to Node /api/ai/ask
2. Node authenticates and checks group membership
3. Node forwards payload to FastAPI /ask
4. FastAPI retrieves chunks from ChromaDB and generates answer
5. FastAPI returns answer + sources
6. Node normalizes payload and returns to frontend
7. Frontend renders answer and citations

### 7.2 Upload PDF flow (target)

1. Frontend uploads file to Node /api/ai/upload
2. Node validates auth, role, file size/type
3. Node streams/transfers file to FastAPI /ingest
4. FastAPI parses, chunks, embeds, stores in ChromaDB
5. FastAPI returns ingestion report
6. Node stores linkage metadata (optional) and returns summary

### 7.3 Quiz generation flow (target)

1. Leader triggers quiz generation request from room UI
2. Node verifies leader role for group
3. Node calls FastAPI /generate-quiz with topic/count/group context
4. FastAPI retrieves relevant chunks and generates quiz set
5. Node returns validated question set to quiz controller
6. Existing socket broadcast layer publishes quiz to room

### 7.4 Current request/response reality

Current implemented flow is non-RAG:
- room leader starts quiz via Node controller
- quiz questions come from local in-memory bank
- answers scored in Node service
- realtime events emitted through Socket.IO

---

## 8. Capabilities vs Missing Features

### 8.1 Currently available capabilities

- real-time chat and room coordination
- quiz lifecycle (start/current/answer/finish)
- points and leaderboard integration
- role-based access control on quiz start

### 8.2 AI capabilities currently missing

- PDF ingestion endpoint
- LangChain chunking pipeline
- ChromaDB vector index
- semantic retrieval API
- grounded Q&A endpoint
- RAG-based quiz generation
- CrewAI orchestration layer
- backend AI proxy routes/controllers
- AI observability metrics and tracing

### 8.3 Recommended implementation order

1. Create FastAPI service skeleton with health endpoint
2. Implement ingestion (parse -> chunk -> embed -> store)
3. Implement ask endpoint with citations
4. Add Node proxy endpoints with auth and RBAC checks
5. Add frontend Ask Notes UI and upload workflow
6. Replace/augment quiz source with RAG generation path
7. Add CrewAI orchestration and validation agent layer

---

## 9. Operational Risks and Controls

Key risks:
- hallucinations without citation checks
- index loss in ephemeral Chroma deployments
- high latency on large-context prompts
- unbounded token and request cost

Controls to add:
- response must include source snippets
- fallback when retrieval confidence is low
- caching for repeated questions
- strict timeout/retry strategy between Node and FastAPI
- per-user/group quotas and rate limits

---

## 10. Summary

The AI system design is well-defined but not yet implemented in runtime code.

Current production behavior is a non-RAG quiz/chat platform.
The target AI path is:
- FastAPI RAG service (LangChain + ChromaDB)
- Node gateway proxy for secure integration
- optional CrewAI orchestration for multi-agent validation and generation

This document should be treated as implementation blueprint plus status baseline.

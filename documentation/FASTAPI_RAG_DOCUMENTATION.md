# FastAPI RAG Service Documentation

This document explains the FastAPI service in detail.

The goal is simple:

<!-- - show what each part of `fastapi-rag/main.py` does -->
- explain how PDF upload works
- explain how question answering works
- explain how AI quiz generation works
- explain how the service connects to Node and ChromaDB

This is written for learning and debugging, not just for architecture overview.
<!--  -->
---

## 1. What This Service Does

The FastAPI service is the AI brain for PDF-based features.

It handles:

- PDF upload
- text extraction from PDF
- chunking the extracted text
- embedding chunks with `sentence-transformers`
- storing embeddings in ChromaDB
- retrieving relevant chunks for questions
- generating answers with Groq
- generating quiz questions with Groq

### In one sentence

Upload a PDF, turn it into searchable chunks, and use that context to answer questions or generate quizzes.

---

## 2. File Overview

Main file:

- `fastapi-rag/main.py`

Other files:

- `fastapi-rag/.env`
- `fastapi-rag/requirements.txt`

### Environment variables

The service currently expects:

- `GROQ_API_KEY`
- `GROQ_MODEL`
- `NODE_BACKEND_URL`

Example:

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-8b-instant
NODE_BACKEND_URL=http://localhost:5000
```

---

## 3. Libraries Used

The service uses these main libraries:

- `FastAPI` for HTTP endpoints
- `uvicorn` for running the server
- `python-multipart` for file uploads
- `PyMuPDF (fitz)` for PDF text extraction
- `langchain-text-splitters` for chunking text
- `langchain-chroma` for vector store integration
- `chromadb` for in-memory vector storage
- `sentence-transformers` for local embeddings
- `langchain-groq` for Groq LLM calls
- `python-dotenv` for loading `.env`

### Why this setup is good

- embeddings are local and free
- Groq is used only for generation
- the service is lightweight and simple
- the PDF context can be rebuilt by uploading again

---

## 4. High-Level Flow

### Overall data flow

```text
Frontend
    -> Node /api/ai/*
    -> FastAPI /upload-pdf, /ask, /generate-quiz
    -> ChromaDB in memory
    -> Groq model
```

### What Node does before FastAPI

Node is not skipped.
It sits in front of FastAPI and handles:

- login/session checks
- group membership checks
- leader-only checks for upload/generate quiz
- request validation
- error normalization

So FastAPI is only responsible for AI work.

---

## 5. Code Structure in `main.py`

The file is organized in this order:

1. imports
2. environment setup
3. FastAPI app setup
4. shared singletons
5. request models
6. helper functions
7. route handlers
8. uvicorn startup block

That order is important because the app is built from top to bottom.

---

## 6. Environment and App Setup

### Loading env vars

```python
load_dotenv()
```

This loads the `.env` file into Python environment variables.

### Reading settings

```python
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5000").strip()
```

These values control:

- Groq authentication
- which Groq model is used
- which Node origin is allowed for CORS

### Safety check

```python
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is required in .env")
```

This makes startup fail early if the key is missing.

That is good because it avoids silent broken behavior later.

### FastAPI app creation

```python
app = FastAPI(title="StudySync FastAPI RAG Service", version="1.0.0")
```

This creates the API app.

### CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[NODE_BACKEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

This means:

- only the Node backend origin is allowed
- cookies can be sent
- all HTTP methods are allowed
- all headers are allowed

Even though the frontend calls Node, this keeps FastAPI safe and controlled behind the backend.

---

## 7. Shared Objects and Why They Matter

These objects are created once and reused.

### Chroma client

```python
chroma_client = chromadb.Client()
```

This is the in-memory vector database client.

Important:

- it does not persist to disk in the current setup
- restarting the service clears stored vectors

### Embedding model

```python
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
```

This is the local embedding model.

It converts text into vectors.

Why this model:

- free
- lightweight
- good enough for a demo/study platform

### Groq LLM

```python
llm = ChatGroq(
    model=GROQ_MODEL,
    api_key=GROQ_API_KEY,
    temperature=0.2,
)
```

This is the generation model.

It is used for:

- answering questions
- generating quiz questions

Low temperature means the output is more stable and less random.

### Text splitter

```python
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)
```

This splits extracted PDF text into chunks.

Why:

- one huge PDF is too large to pass directly
- chunking helps retrieval
- overlap keeps context from being cut awkwardly

---

## 8. Embeddings Wrapper

FastAPI uses a custom class:

```python
class LocalSentenceTransformerEmbeddings:
```

This wrapper makes `sentence-transformers` behave like a LangChain embedding provider.

### Methods

#### `embed_documents(texts)`

Takes a list of strings and returns vectors for all of them.

#### `embed_query(text)`

Takes one user query and returns one vector.

### Why this wrapper exists

LangChain expects a certain embedding interface.

The wrapper lets us plug in a local model without using a paid API.

---

## 9. Request Models

FastAPI uses Pydantic models to validate incoming JSON.

### `GenerateQuizRequest`

```python
class GenerateQuizRequest(BaseModel):
    group_id: str
    num_questions: int = Field(default=5, ge=1, le=10)
```

This means:

- `group_id` is required
- `num_questions` is optional
- default is 5
- minimum is 1
- maximum is 10

### `AskRequest`

```python
class AskRequest(BaseModel):
    group_id: str
    question: str
```

This means both fields are required.

---

## 10. Helper Functions

These functions keep the route handlers cleaner.

### `sanitize_group_id(group_id)`

Purpose:

- trims whitespace
- rejects empty IDs
- converts unsafe characters to `_`

Why:

- Chroma collection names should be safe
- group IDs are used in collection names

### `collection_name_for_group(group_id)`

This creates a collection name like:

```text
studysync_group_<group_id>
```

In practice, `<group_id>` is the sanitized output of `sanitize_group_id(group_id)`.

Each group gets its own vector collection.

That means groups do not share PDF context.

### `get_vector_store(group_id)`

Creates a Chroma vector store object for that group.

It uses:

- the shared Chroma client
- the group-specific collection name
- the embedding wrapper

### `collection_doc_count(group_id)`

Returns how many docs are stored in the group collection.

Used as a quick check before asking or generating a quiz.

### `parse_pdf_to_documents(pdf_bytes, filename)`

This function:

1. opens the PDF in memory
2. reads each page
3. extracts text
4. creates LangChain `Document` objects
5. stores metadata like source filename and page number

If the PDF is invalid, it raises a `400` error.

### `strip_code_fences(raw)`

Sometimes models return code fences like:

```json
{ ... }
```

This function removes that wrapping so the JSON can be parsed cleanly.

### `validate_quiz_payload(payload, expected_questions)`

This is one of the most important safety functions.

It checks:

- payload must be a dict
- `questions` must be a list
- number of questions must match exactly
- every question must have:
  - question text
  - exactly 4 options
  - valid `correct_index`
  - explanation text

If anything is wrong, it returns a `502` error.

### `build_context(chunks)`

This formats retrieved chunks into a readable prompt context.

Each chunk includes:

- source filename
- page number
- chunk text

That helps the model answer using the right PDF evidence.

---

## 11. Health Endpoint

### `GET /health`

This route is very simple.

It returns:

- service name
- status
- embedding model
- generation model
- storage type

Example response:

```json
{
  "status": "ok",
  "service": "fastapi-rag",
  "embedding_model": "all-MiniLM-L6-v2",
  "generation_model": "llama-3.1-8b-instant",
  "storage": "chromadb_in_memory"
}
```

### Why this endpoint matters

It tells Node whether the AI service is alive.

It is useful for:

- local debugging
- deployment health checks
- backend AI proxy health route

---

## 12. PDF Upload Endpoint

### `POST /upload-pdf`

This is where a PDF gets indexed.

#### Inputs

- `file`: uploaded PDF
- `group_id`: group identifier
- `replace_context`: whether to clear previous vectors first

### Step-by-step flow

1. Check that the file has a name.
2. Verify it ends with `.pdf`.
3. Read the file into memory.
4. Reject files larger than 10 MB.
5. Extract text page by page.
6. Reject PDFs with no readable text.
7. Chunk the extracted text.
8. If `replace_context` is true, delete the old Chroma collection.
9. Add new chunks to the group collection.
10. Return an ingest summary.

### Returned data

The response includes:

- `group_id`
- `filename`
- `pages_with_text`
- `chunks_stored`
- `collection_name`
- `replace_context`

### Why the file is not stored permanently

The current design is deliberate:

- the PDF is processed
- the PDF is discarded
- only the vectorized chunks stay in memory

That keeps the setup simple for the demo.

### Code behavior to remember

The collection is per group.

So:

- Group A has its own vector store
- Group B has a different vector store
- they do not mix context

---

## 13. Generate Quiz Endpoint

### `POST /generate-quiz`

This endpoint creates MCQs from the stored PDF context.

### Inputs

- `group_id`
- `num_questions`

### Flow

1. Clamp `num_questions` to 1..10.
2. Check whether the group has any stored documents.
3. If no documents exist, return a `404`.
4. Load the vector store for that group.
5. Search for the most important chunks.
6. Build a context block.
7. Send a strict JSON prompt to Groq.
8. Strip code fences if the model adds them.
9. Parse the output as JSON.
10. Validate the quiz shape.
11. Return the quiz payload.

### Prompt strategy

The prompt forces:

- strict JSON only
- exactly the requested number of questions
- 4 options per question
- grounded in the provided context

This reduces bad model output.

### Validation

The validator checks that the model does not:

- return too many or too few questions
- return missing options
- return invalid indexes
- return missing explanations

### Returned data

The endpoint returns:

- `group_id`
- `num_questions`
- `model`
- `quiz`

### How Node uses this

Node does not just display the result.
It:

1. fetches the quiz from FastAPI
2. maps it into the live quiz session structure
3. emits `quiz-started` to the room

That is why the frontend quiz UI can stay the same.

---

## 14. Ask Endpoint

### `POST /ask`

This endpoint answers a user question from the uploaded PDF context.

### Inputs

- `group_id`
- `question`

### Flow

1. Trim and validate the question.
2. Ensure the group has documents stored.
3. Load the group vector store.
4. Retrieve the top relevant chunks with similarity search.
5. Build a context block.
6. Prompt Groq to answer only from that context.
7. Return the answer and source snippets.

### Returned data

The response includes:

- `group_id`
- `model`
- `question`
- `answer`
- `sources`

### Sources field

Each source item includes:

- source filename
- page number
- short text preview

This makes the answer easier to trust and debug.

---

## 15. How Group Isolation Works

Each group gets its own Chroma collection.

That means a PDF uploaded for one group is not shared with another group.

This is enforced by:

- `collection_name_for_group(group_id)`
- `get_vector_store(group_id)`
- `collection_doc_count(group_id)`

### Why this is important

Without group isolation:

- answers could come from the wrong PDF
- quizzes could mix unrelated content
- privacy would be poor

---

## 16. Why the Service Uses In-Memory Storage

Both of these are in memory:

- ChromaDB vector data
- Node quiz sessions

### What that means

- restart the service, and data resets
- this is okay for the current demo/study setup
- it is not a long-term production storage strategy
- if you run multiple FastAPI workers/instances, each one has its own separate in-memory vector state

### Practical effect

If FastAPI restarts:

- uploaded PDF context disappears
- the file must be uploaded again

If Node restarts:

- active quiz sessions disappear

This is why the app has restart-sensitive behavior.

---

## 17. Error Handling Style

The service uses HTTP exceptions for clear errors.

Common error patterns:

- `400`: bad request
- `404`: no docs or no matching content
- `502`: model returned invalid output

### Examples

- missing `GROQ_API_KEY` -> runtime error on startup
- invalid PDF -> `400`
- no documents for group -> `404`
- model returned bad JSON -> `502`

This is a good pattern because it tells Node exactly what went wrong.

---

## 18. How Node Connects To This Service

Node uses a proxy controller in:

- `backend/controllers/aiController.js`

That controller calls:

- `POST /upload-pdf`
- `POST /generate-quiz`
- `POST /ask`
- `GET /health`

### Why Node proxies instead of the frontend calling FastAPI directly

Because Node needs to:

- protect routes with JWT auth
- check group membership
- check leader-only access
- normalize errors for the frontend

This keeps the auth boundary in one place.

---

## 19. Request and Response Shape Summary

### Upload PDF

Request:

```text
multipart/form-data
file
group_id
replace_context
```

Response:

```json
{
  "group_id": "string",
  "filename": "string",
  "pages_with_text": 0,
  "chunks_stored": 0,
  "collection_name": "string",
  "replace_context": false
}
```

### Generate quiz

Request:

```json
{
  "group_id": "string",
  "num_questions": 5
}
```

Response:

```json
{
  "group_id": "string",
  "num_questions": 5,
  "model": "llama-3.1-8b-instant",
  "quiz": {
    "quiz_title": "string",
    "questions": []
  }
}
```

### Ask

Request:

```json
{
  "group_id": "string",
  "question": "string"
}
```

Response:

```json
{
  "group_id": "string",
  "model": "llama-3.1-8b-instant",
  "question": "string",
  "answer": "string",
  "sources": []
}
```

---

## 20. What To Remember Most

If you only remember 5 things from this doc, remember these:

1. FastAPI is only handling PDF RAG and Groq generation.
2. ChromaDB is in memory, so uploaded context is temporary.
3. Each group has its own vector collection.
4. Node protects the AI service with auth and RBAC.
5. The frontend always talks to Node, not directly to FastAPI.

---

## 21. Best Way To Read the Code

If you want to learn the service properly, read it in this order:

1. `fastapi-rag/main.py`
2. `backend/controllers/aiController.js`
3. `backend/routes/aiRoutes.js`
4. `frontend/src/services/aiService.ts`
5. `frontend/src/components/QuizPanel.tsx`
6. `frontend/src/components/GroupChat.tsx`

That order shows the full path from UI to backend to AI and back.

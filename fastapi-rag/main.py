import json
import os
import re
from typing import Any, Dict, List

import chromadb
import fitz
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

# ------------------------------------------------------------
# Environment + app setup
# ------------------------------------------------------------
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5000").strip()

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is required in .env")

app = FastAPI(title="StudySync FastAPI RAG Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[NODE_BACKEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------
# Core singletons (in-memory for demo)
# ------------------------------------------------------------
# In-memory Chroma client: data resets on service restart (intentional for demo)
chroma_client = chromadb.Client()

# Local free embedding model (no external embedding API cost/limits)
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Groq LLM for quiz/answer generation
llm = ChatGroq(
    model=GROQ_MODEL,
    api_key=GROQ_API_KEY,
    temperature=0.2,
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)


class LocalSentenceTransformerEmbeddings:
    """LangChain-compatible embedding wrapper using sentence-transformers."""

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return embedding_model.encode(texts, normalize_embeddings=True).tolist()

    def embed_query(self, text: str) -> List[float]:
        return embedding_model.encode(text, normalize_embeddings=True).tolist()


embeddings = LocalSentenceTransformerEmbeddings()


# ------------------------------------------------------------
# Request models
# ------------------------------------------------------------
class GenerateQuizRequest(BaseModel):
    group_id: str
    num_questions: int = Field(default=5, ge=1, le=10)


class AskRequest(BaseModel):
    group_id: str
    question: str


# ------------------------------------------------------------
# Helper functions
# ------------------------------------------------------------
def sanitize_group_id(group_id: str) -> str:
    group = (group_id or "").strip()
    if not group:
        raise HTTPException(status_code=400, detail="group_id is required")
    # Keep collection names safe and deterministic
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", group)


def collection_name_for_group(group_id: str) -> str:
    return f"studysync_group_{sanitize_group_id(group_id)}"


def get_vector_store(group_id: str) -> Chroma:
    name = collection_name_for_group(group_id)
    return Chroma(
        client=chroma_client,
        collection_name=name,
        embedding_function=embeddings,
    )


def collection_doc_count(group_id: str) -> int:
    name = collection_name_for_group(group_id)
    collection = chroma_client.get_or_create_collection(name=name)
    return collection.count()


def parse_pdf_to_documents(pdf_bytes: bytes, filename: str) -> List[Document]:
    try:
        pdf = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {exc}") from exc

    documents: List[Document] = []
    for page_index in range(pdf.page_count):
        text = (pdf.load_page(page_index).get_text() or "").strip()
        if not text:
            continue
        documents.append(
            Document(
                page_content=text,
                metadata={
                    "source": filename,
                    "page": page_index + 1,
                },
            )
        )
    pdf.close()
    return documents


def strip_code_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def validate_quiz_payload(payload: Dict[str, Any], expected_questions: int) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Model returned invalid quiz format")

    questions = payload.get("questions")
    if not isinstance(questions, list) or len(questions) != expected_questions:
        raise HTTPException(
            status_code=502,
            detail=f"Quiz must contain exactly {expected_questions} questions",
        )

    for idx, question in enumerate(questions):
        if not isinstance(question, dict):
            raise HTTPException(status_code=502, detail=f"Question {idx + 1} is malformed")
        if not isinstance(question.get("question"), str) or not question["question"].strip():
            raise HTTPException(status_code=502, detail=f"Question {idx + 1} text is missing")
        options = question.get("options")
        if not isinstance(options, list) or len(options) != 4 or not all(isinstance(opt, str) for opt in options):
            raise HTTPException(status_code=502, detail=f"Question {idx + 1} must have 4 string options")
        correct_index = question.get("correct_index")
        if not isinstance(correct_index, int) or correct_index < 0 or correct_index > 3:
            raise HTTPException(status_code=502, detail=f"Question {idx + 1} has invalid correct_index")
        if not isinstance(question.get("explanation"), str) or not question["explanation"].strip():
            raise HTTPException(status_code=502, detail=f"Question {idx + 1} explanation is missing")

    return payload


def build_context(chunks: List[Document]) -> str:
    context_blocks = []
    for i, doc in enumerate(chunks, start=1):
        source = doc.metadata.get("source", "unknown")
        page = doc.metadata.get("page", "n/a")
        context_blocks.append(
            f"[Chunk {i} | source={source} | page={page}]\n{doc.page_content}"
        )
    return "\n\n".join(context_blocks)


# ------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------
@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "fastapi-rag",
        "embedding_model": "all-MiniLM-L6-v2",
        "generation_model": GROQ_MODEL,
        "storage": "chromadb_in_memory",
    }


@app.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    group_id: str = Form(...),
    replace_context: bool = Form(False),
) -> Dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is missing")

    filename_lower = file.filename.lower()
    if not filename_lower.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_bytes = await file.read()
    max_size_bytes = 10 * 1024 * 1024
    if len(file_bytes) > max_size_bytes:
        raise HTTPException(status_code=400, detail="PDF exceeds 10MB limit")

    base_docs = parse_pdf_to_documents(file_bytes, file.filename)
    if not base_docs:
        raise HTTPException(status_code=400, detail="No readable text found in PDF")

    chunks = text_splitter.split_documents(base_docs)
    if not chunks:
        raise HTTPException(status_code=400, detail="Chunking produced no usable text")

    if replace_context:
        collection_name = collection_name_for_group(group_id)
        try:
            chroma_client.delete_collection(name=collection_name)
        except Exception:
            # If collection doesn't exist yet, continue and create it below
            pass

    vector_store = get_vector_store(group_id)
    vector_store.add_documents(chunks)

    return {
        "group_id": group_id,
        "filename": file.filename,
        "pages_with_text": len(base_docs),
        "chunks_stored": len(chunks),
        "collection_name": collection_name_for_group(group_id),
        "replace_context": replace_context,
    }


@app.post("/generate-quiz")
def generate_quiz(payload: GenerateQuizRequest) -> Dict[str, Any]:
    group_id = payload.group_id
    num_questions = max(1, min(int(payload.num_questions or 5), 10))
    if collection_doc_count(group_id) == 0:
        raise HTTPException(status_code=404, detail="No documents found for this group. Upload PDF first.")

    vector_store = get_vector_store(group_id)
    chunks = vector_store.similarity_search(
        query="Generate a quiz from the most important study concepts",
        k=8,
    )
    if not chunks:
        raise HTTPException(status_code=404, detail="No relevant content found for quiz generation")

    context = build_context(chunks)
    prompt = f"""
You are creating a quiz for students.
Use ONLY the provided context.

Return STRICT JSON only. No markdown, no extra text.

JSON schema:
{{
  "quiz_title": "string",
  "questions": [
    {{
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_index": 0,
      "explanation": "string"
    }}
  ]
}}

Rules:
- Exactly {num_questions} questions.
- 4 options per question.
- One correct answer index (0-3).
- Keep questions factual and grounded in context.

Context:
{context}
"""
    response = llm.invoke(prompt)
    raw_text = response.content if hasattr(response, "content") else str(response)
    clean_text = strip_code_fences(raw_text)

    try:
        quiz_data = json.loads(clean_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Model returned non-JSON quiz output: {exc}") from exc

    validated = validate_quiz_payload(quiz_data, num_questions)
    return {
        "group_id": group_id,
        "num_questions": num_questions,
        "model": GROQ_MODEL,
        "quiz": validated,
    }


@app.post("/ask")
def ask_question(payload: AskRequest) -> Dict[str, Any]:
    group_id = payload.group_id
    question = (payload.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    if collection_doc_count(group_id) == 0:
        raise HTTPException(status_code=404, detail="No documents found for this group. Upload PDF first.")

    vector_store = get_vector_store(group_id)
    chunks = vector_store.similarity_search(query=question, k=8)
    if not chunks:
        raise HTTPException(status_code=404, detail="No relevant context found")

    context = build_context(chunks)
    prompt = f"""
Answer the question using ONLY the context below.
If the answer is not in the context, say you do not have enough information.

Question:
{question}

Context:
{context}
"""
    response = llm.invoke(prompt)
    answer_text = response.content if hasattr(response, "content") else str(response)

    sources = [
        {
            "source": doc.metadata.get("source", "unknown"),
            "page": doc.metadata.get("page", "n/a"),
            "preview": doc.page_content[:200],
        }
        for doc in chunks
    ]

    return {
        "group_id": group_id,
        "model": GROQ_MODEL,
        "question": question,
        "answer": answer_text.strip(),
        "sources": sources,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

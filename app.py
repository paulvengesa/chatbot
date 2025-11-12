from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel

from embeddings import embed_texts, embed_query
from qdrant_utils import ensure_collection, upsert_points, semantic_search
from document_parser import parse_file, chunk_text

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
COLLECTION = "docs"

# CORS: allow any origin if needed, or restrict to your production frontend
origins = [
    "http://localhost:8000",
    "http://127.0.0.1:5500",
    "https://paulvengesa.github.io"
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CMSIn(BaseModel):
    items: list[str]

class ChatIn(BaseModel):
    question: str
    top_k: int = 5

@app.on_event("startup")
async def startup():
    ensure_collection(COLLECTION)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    """Read file in chunks for large uploads"""
    CHUNK_SIZE = 1024 * 1024  # 1MB
    content = b""
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        content += chunk

    texts, meta = parse_file(content, file.filename)
    chunks = chunk_text(texts)
    vectors = embed_texts(chunks)
    upsert_points(COLLECTION, chunks, vectors, meta)

    return {"status": "ok", "chunks": len(chunks)}

@app.post("/cms/import")
async def cms_import(data: CMSIn):
    chunks = chunk_text("\n\n".join(data.items))
    vectors = embed_texts(chunks)
    upsert_points(COLLECTION, chunks, vectors, {"source": "cms"})
    return {"status": "ok", "chunks": len(chunks)}

@app.post("/chat")
async def chat(req: ChatIn):
    qv = embed_query(req.question)
    hits = semantic_search(COLLECTION, qv, top_k=req.top_k)
    context = "\n\n".join(h["text"] for h in hits)
    # Placeholder answer (replace with LLM call if desired)
    answer = f"Based on the docs, here’s what I found:\n{context}"
    return {"answer": answer, "sources": hits}

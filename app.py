import os
import json
import logging
from typing import List


import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware


from .embeddings import embed_texts, embed_query
from .qdrant_utils import ensure_collection, upsert_points, semantic_search
from .document_parser import parse_file, chunk_text


# --- Configuration ---
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini') # change if you prefer another model
BACKEND_ORIGINS = [
'http://localhost:8000',
'http://127.0.0.1:5500',
'https://paulvengesa.github.io'
]


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI()
COLLECTION = 'docs'


app.add_middleware(
CORSMiddleware,
allow_origins=BACKEND_ORIGINS,
allow_credentials=True,
allow_methods=['*'],
allow_headers=['*'],
)


class CMSIn(BaseModel):
items: List[str]


class ChatIn(BaseModel):
question: str
top_k: int = 5


@app.on_event('startup')
async def startup():
ensure_collection(COLLECTION)


@app.get('/health')
async def health():
return {'ok': True}


@app.post('/upload')
async def upload(file: UploadFile = File(...)):
"""Accept a multipart/form-data file upload, parse and index into Qdrant."""
try:
# Read file into memory — if files are very large you may want a streaming parser.
content = await file.read()
texts, meta = parse_file(content, file.filename)
chunks = chunk_text(texts)
vectors = embed_texts(chunks)
upsert_points(COLLECTION, chunks, vectors, meta)
return {'status': 'ok', 'chunks': len(chunks)}
except Exception as e:
logger.exception('Upload failed')
raise HTTPException(status_code=500, detail=str(e))


@app.post('/cms/import')
async def cms_import(data: CMSIn):
try:
chunks = chunk_text('\n\n'.join(data.items))
vectors = embed_texts(chunks)
upsert_points(COLLECTION, chunks, vectors, {'source': 'cms'})
return {'answer': an

# backend/document_parser.py
import io
import pandas as pd
from docx import Document
from pdfminer.high_level import extract_text
from typing import List, Tuple

def parse_file(raw: bytes, filename: str) -> Tuple[str, dict]:
    """
    Detect file type by extension, extract text, return (text, metadata).
    """
    ext = filename.lower().split(".")[-1]
    meta = {"filename": filename, "file_type": ext}

    if ext == "pdf":
        # PDF: extract text
        text = extract_text(io.BytesIO(raw))
    elif ext == "docx":
        # DOCX: extract all paragraphs
        doc = Document(io.BytesIO(raw))
        text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
    elif ext == "csv":
        # CSV: read with pandas
        df = pd.read_csv(io.BytesIO(raw))
        # flatten into strings
        text = "\n".join(df.astype(str).apply(lambda row: " | ".join(row), axis=1))
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    return text, meta


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """
    Split long text into overlapping chunks for embeddings.
    """
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += chunk_size - overlap

    return chunks

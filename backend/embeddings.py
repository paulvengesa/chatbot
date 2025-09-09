# backend/embeddings.py
from typing import List

# Option 1: SentenceTransformers (local, no API cost)
from sentence_transformers import SentenceTransformer

_model = None

def get_model():
    global _model
    if _model is None:
        # Light, fast model (384 dimensions)
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Embed a list of text chunks into vectors.
    """
    model = get_model()
    return model.encode(texts, convert_to_numpy=True).tolist()


def embed_query(query: str) -> List[float]:
    """
    Embed a single query string.
    """
    model = get_model()
    return model.encode([query], convert_to_numpy=True)[0].tolist()

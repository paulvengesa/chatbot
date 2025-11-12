# backend/qdrant_utils.py
import os
from typing import List, Dict
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# Configure Qdrant connection
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")  # local default
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")  # only needed for cloud

client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)


def ensure_collection(name: str, size: int = 384):
    """
    Create a collection if it doesn’t exist yet.
    """
    collections = client.get_collections().collections
    if not any(c.name == name for c in collections):
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=size, distance=Distance.COSINE),
        )
        print(f"✅ Created collection: {name}")
    else:
        print(f"ℹ️ Collection '{name}' already exists")


def upsert_points(collection: str, texts: List[str], vectors: List[List[float]], meta: Dict):
    """
    Insert or update document chunks with embeddings + metadata.
    """
    points = []
    for i, (t, v) in enumerate(zip(texts, vectors)):
        payload = {"text": t, **meta}
        points.append(
            PointStruct(id=None, vector=v, payload=payload)
        )
    client.upsert(collection_name=collection, points=points)
    print(f"📥 Inserted {len(points)} points into '{collection}'")


def semantic_search(collection: str, query_vec: List[float], top_k: int = 5) -> List[Dict]:
    """
    Search the collection with a query embedding.
    Returns list of {text, score, ...metadata}.
    """
    results = client.search(
        collection_name=collection,
        query_vector=query_vec,
        limit=top_k
    )
    return [
        {
            "text": r.payload.get("text", ""),
            "score": r.score,
            **(r.payload or {})
        }
        for r in results
    ]

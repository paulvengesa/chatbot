# backend/qdrant_utils.py
import os
from typing import List, Dict
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

QDRANT_URL = os.getenv("https://02792a42-1798-4c80-b61e-9297261bf1e6.us-east4-0.gcp.cloud.qdrant.io")
QDRANT_API_KEY = os.getenv("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.extf6favi74G9A2x9caxUm6jZjL0yRha6JFWvEBy9kM")

client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
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

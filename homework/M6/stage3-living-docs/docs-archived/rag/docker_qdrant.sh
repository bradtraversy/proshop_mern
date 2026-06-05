# Run from project root: bash docs/rag/docker_qdrant.sh
docker run -d -p 6333:6333 --name qdrant \
  -v "$(pwd)/docs/rag/qdrant-data:/qdrant/storage" \
  qdrant/qdrant:v1.14.0

# Run from the repo root (paths below are relative to it, e.g. k8s/namespaces.yaml)
## Build, tag and push images to Docker Hub so the cluster can pull them directly
# Replace with your own Docker Hub namespace, or export DOCKERHUB_USER before running.
DOCKERHUB_USER="${DOCKERHUB_USER:-anilpandeyio}"

docker login # prompts for Docker Hub credentials; use a Personal Access Token, not your password

docker compose build --no-cache

docker push "$DOCKERHUB_USER/k8s-three-tier-starter-api:latest"
docker push "$DOCKERHUB_USER/k8s-three-tier-starter-app:latest"
docker push "$DOCKERHUB_USER/k8s-three-tier-starter-db:latest"

## Deploy the pushed images to Kubernetes
# ./scripts/k8s/run.sh
# Run from the repo root (paths below are relative to it, e.g. k8s/namespaces.yaml)
## Make locally built docker-compose images available to k3s
# k3s uses its own containerd store, separate from the Docker daemon, so
# even on the same WSL machine the images must be imported manually.
docker compose build --no-cache
docker save k8s-three-tier-starter-api:latest | sudo k3s ctr images import -
docker save k8s-three-tier-starter-app:latest | sudo k3s ctr images import -
docker save k8s-three-tier-starter-db:latest  | sudo k3s ctr images import -

# Verify the images landed in k3s's image store
sudo k3s ctr images ls | grep k8s-three-tier-starter

## Deploy everything at once
# Namespaces must be applied first since every other manifest targets them
kubectl apply -f k8s/namespaces.yaml

# Apply all tiers in one command (each -f can be a directory of manifests)
kubectl apply -f k8s/database -f k8s/backend -f k8s/frontend -f k8s/ingress-nginx

# Check rollout status of everything
kubectl get pods,svc -n database
kubectl get pods,svc -n backend
kubectl get pods,svc -n frontend
kubectl get pods,svc -n ingress-nginx
kubectl get ingress -n frontend

# Watch pods across all 3 app namespaces until they're Running
# (blocks until Ctrl+C -- optional, run in a separate terminal if needed)
# kubectl get pods -n database -n backend -n frontend --watch

# Tail logs if something isn't coming up (swap namespace/label as needed)
# kubectl logs -n backend -l app=quotes-api --tail=100 -f

## Tear down everything: see scripts/k8s/destroy.sh

## Access the app (no hosts-file edits or tracking the node IP needed)
# The Ingress has no 'host' restriction, so port-forward to localhost just works.
# Pick any free local port -- 8080 may already be in use on your machine.
# kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8081:80
# then open http://localhost:8081 in the browser, or: curl http://localhost:8081
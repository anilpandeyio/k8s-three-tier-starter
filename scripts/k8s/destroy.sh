## Destroy everything deployed by scripts/k8s/deploy.sh in one command
# Deleting the namespaces also cascades to any namespaced resources left behind;
# the ingress-nginx and logging dirs additionally remove their cluster-scoped RBAC.
kubectl delete -f k8s/logging/loki -f k8s/logging -f k8s/ingress-nginx -f k8s/frontend -f k8s/backend -f k8s/database -f k8s/namespaces.yaml --ignore-not-found

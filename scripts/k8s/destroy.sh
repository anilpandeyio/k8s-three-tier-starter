## Destroy everything deployed by scripts/k8s/deploy.sh in one command
# Deleting the namespaces also cascades to any namespaced resources left behind;
# the ingress-nginx dir additionally removes its cluster-scoped RBAC/IngressClass.
kubectl delete -f k8s/ingress-nginx -f k8s/frontend -f k8s/backend -f k8s/database -f k8s/namespaces.yaml --ignore-not-found

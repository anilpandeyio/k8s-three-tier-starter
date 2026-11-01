#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/../.."

kubectl() {
    minikube kubectl -- "$@"
}

kubectl rollout status statefulset/mysql -n database --timeout=5m
kubectl rollout status deployment/quotes-api-deployment -n backend --timeout=5m
kubectl rollout status deployment/quotes-frontend-deployment -n frontend --timeout=5m
kubectl rollout status deployment/ingress-nginx-controller -n ingress-nginx --timeout=5m

echo "Starting port-forward; press Ctrl+C to stop it."
echo "Open http://localhost:8081 in your browser, or run: curl http://localhost:8081"
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8081:80

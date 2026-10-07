# 3-Tier Kubernetes Deployment — Quotes Application

A 3-tier Quotes application (MySQL + API + Frontend) that can run locally with Docker Compose or be deployed to Kubernetes.

- **Database (`db`)**: MySQL, seeded with [db/init.sql](db/init.sql).
- **API (`api`)**: Node.js + Express + `mysql2`, exposes `/api/quotes` (GET/POST) and `/health`. See [api/api.js](api/api.js).
- **Frontend (`app`)**: Node.js + Express + EJS, renders quotes and posts new ones via the API. See [app/app.js](app/app.js).
- **Ingress Controller**: nginx ingress, routes external traffic to the frontend.

> Previously the `api` and `app` services were written in Python/Flask. They have been rewritten in Node.js/Express. The old README is kept at [OLD_README.md](OLD_README.md) for reference.

## Prerequisites

- Docker & Docker Compose (for local development)
- Kubernetes cluster (Minikube/K3s/EKS/etc.) + `kubectl` (for deployment)
- A container registry (Docker Hub or similar) if deploying to Kubernetes

## Local Development (Docker Compose)

Build and run all three services:

```sh
docker compose build
docker compose up -d
```

Or use the helper script: [compose-commands.sh](compose-commands.sh).

- Frontend: http://localhost:5002
- API: http://localhost:5001/api/quotes

Stop everything:

```sh
docker compose down
```

Useful MySQL debugging commands are in [db-commands.sh](db-commands.sh).

## Kubernetes Deployment

Manifests live in [manifests/](manifests) (flat files, not subfolders):

| File | Purpose |
|---|---|
| [manifests/ns.yaml](manifests/ns.yaml) | Creates the `database`, `backend`, `frontend` namespaces |
| [manifests/secrets.yaml](manifests/secrets.yaml) | MySQL credentials (`mysql-secret`) |
| [manifests/config.yaml](manifests/config.yaml) | MySQL config (`mysql-config`) |
| [manifests/mysql.yaml](manifests/mysql.yaml) | MySQL `StatefulSet` + `Service` (namespace: `database`) |
| [manifests/quotes-api.yaml](manifests/quotes-api.yaml) | API `Deployment` + `Service` (namespace: `backend`) |
| [manifests/quotes-frontend.yaml](manifests/quotes-frontend.yaml) | Frontend `Deployment` + `Service` (namespace: `frontend`) |
| [manifests/ingress-nginx-controller.yaml](manifests/ingress-nginx-controller.yaml) | nginx ingress controller |
| [manifests/ingress.yaml](manifests/ingress.yaml) | Ingress rule for `my.quotes.com` → frontend service |

### 1. Build & Push Docker Images

```sh
docker build -t <your-docker-username>/quotes-db:latest ./db
docker build -t <your-docker-username>/quotes-api:latest ./api
docker build -t <your-docker-username>/quotes-frontend:latest ./app

docker push <your-docker-username>/quotes-db:latest
docker push <your-docker-username>/quotes-api:latest
docker push <your-docker-username>/quotes-frontend:latest
```

Update the `image:` field in [manifests/mysql.yaml](manifests/mysql.yaml), [manifests/quotes-api.yaml](manifests/quotes-api.yaml) and [manifests/quotes-frontend.yaml](manifests/quotes-frontend.yaml) to match.

### 2. Deploy to Kubernetes

```sh
kubectl apply -f manifests/ns.yaml
kubectl apply -f manifests/secrets.yaml
kubectl apply -f manifests/config.yaml
kubectl apply -f manifests/mysql.yaml
kubectl apply -f manifests/quotes-api.yaml
kubectl apply -f manifests/quotes-frontend.yaml
kubectl apply -f manifests/ingress-nginx-controller.yaml
kubectl apply -f manifests/ingress.yaml
```

### 3. Verify Deployment

```sh
kubectl get pods -n database
kubectl get pods -n backend
kubectl get pods -n frontend
kubectl get ingress -n frontend
```

### 4. Access the Application

Add `my.quotes.com` to your hosts file pointing at the ingress IP, then open it in a browser:

```sh
kubectl get ingress -n frontend
```

### Cleanup

```sh
kubectl delete -f manifests/
```

## Notes

- `mysql-secret` and `mysql-config` must exist before deploying the database (see [manifests/secrets.yaml](manifests/secrets.yaml) / [manifests/config.yaml](manifests/config.yaml)).
- Adjust the Ingress host/rules in [manifests/ingress.yaml](manifests/ingress.yaml) based on your environment.
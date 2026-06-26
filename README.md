# casino-frontend

SPA Angular 17 (standalone components) del **Casino Online** —
Experiencia 2 de la asignatura **Introducción a Herramientas DevOps (ISY1101)**.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Angular 17 — standalone components, signals, lazy routes |
| Lenguaje | TypeScript 5.4 |
| Animaciones | GSAP 3, Three.js (WebGL) |
| Estilos | CSS puro (design system Monaco Royal) |
| Auth | JWT via HTTP interceptor |
| Build | Angular application builder (Vite + esbuild) |

---

## Variables de entorno (runtime)

| Variable | Descripción |
|----------|-------------|
| `BACKEND_HOST` | Nombre del servicio del backend (en Kubernetes: `casino-backend`) |

---

## Correr en local

Requisito: backend corriendo en `http://localhost:3000`.

```bash
npm install
npm start   # ng serve — http://localhost:4200
```

---

## Build de producción

```bash
npm run build
```

Angular 17 genera los archivos en `dist/casino-frontend/browser/` — el COPY del Dockerfile debe apuntar a esa subcarpeta.

---

## Implementación EKS (EP3)

### Rutas nginx.conf
El reverse proxy de Nginx enruta por prefijo:

```
/api/bonos/*        → bonos-service:8004
/api/apuestas/*     → apuestas-service:8005
/api/estadisticas/* → estadisticas-service:8006
/api/*              → casino-backend:3000
/                   → archivos estáticos Angular (SPA fallback)
```

### Manifiestos Kubernetes
- `k8s/deployment.yaml` — Deployment + Service tipo **LoadBalancer** (expone al exterior)
- `k8s/hpa.yaml` — HPA (min 2, max 6 réplicas, target 50% CPU)

### CI/CD
Pipeline en `.github/workflows/deploy-frontend.yml` — trigger: push a rama `deploy`.
Pasos: checkout → configure-aws-credentials → ecr-login → docker build+push (latest + SHA + vX.Y.Z) → eks update-kubeconfig → kubectl apply → kubectl set image → rollout status.

### Secrets GitHub requeridos
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`, `AWS_ACCOUNT_ID`, `EKS_CLUSTER`

### Comandos útiles

```bash
# Obtener URL del LoadBalancer
kubectl get services casino-frontend

# Ver logs de nginx
kubectl logs deployment/casino-frontend

# Reiniciar deployment
kubectl rollout restart deployment casino-frontend
```

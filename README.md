# casino-frontend

SPA Angular 17 (standalone components) del **Casino Online VidalCasino** —
Experiencia 2 de la asignatura **Introducción a Herramientas DevOps (ISY1101)** — DuocUC 2026.

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
| Servidor web | nginx-unprivileged (producción) |
| Contenedor | Docker (multi-stage build) |

---

## Estructura del proyecto

```
casino-frontend/
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.css
│   ├── environments/
│   │   ├── environment.ts               ← dev: apiBaseUrl = http://localhost:3000
│   │   └── environment.prod.ts          ← prod: apiBaseUrl = '' (reverse proxy)
│   └── app/
│       ├── app.component.ts
│       ├── app.routes.ts
│       ├── models/casino.models.ts
│       ├── utils/particles.ts
│       ├── services/
│       │   ├── auth.service.ts
│       │   └── casino.service.ts
│       ├── interceptors/
│       │   └── auth.interceptor.ts
│       ├── guards/
│       │   └── auth.guard.ts
│       └── components/
│           ├── three-background/
│           ├── header/
│           ├── login/   register/
│           ├── lobby/
│           ├── slots/
│           ├── roulette/
│           ├── blackjack/
│           ├── profile/
│           └── history/
├── nginx.conf                           ← config Nginx (reverse proxy + SPA fallback) — en la raíz
├── Dockerfile                           ← multi-stage build (EP2)
├── docker-compose.yml                   ← stack completo local (EP2)
├── .github/
│   └── workflows/
│       └── deploy-frontend.yml          ← pipeline CI/CD (EP2)
├── .dockerignore
├── angular.json
├── package.json
├── tsconfig.json
├── tsconfig.app.json
└── .gitignore
```

---

## Cómo funciona la app

### Autenticación
- El usuario se registra o loguea. El backend devuelve un **JWT**.
- `AuthService` guarda el token en `localStorage` usando Angular **signals**.
- `authInterceptor` adjunta automáticamente `Authorization: Bearer <token>` en cada petición HTTP saliente.
- `authGuard` redirige a `/login` si no hay sesión activa.
- Si el servidor responde con **401**, el interceptor cierra la sesión.

### Rutas protegidas
Todas las rutas de juego están protegidas por `authGuard` y usan **lazy loading** (`loadComponent`): cada juego se descarga como chunk separado solo cuando el usuario navega a él.

### Comunicación con el backend
`CasinoService` y `AuthService` leen `environment.apiBaseUrl` para construir las URLs:

- **Desarrollo:** `http://localhost:3000`
- **Producción:** `''` (cadena vacía) → rutas relativas → Nginx reverse proxy

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `BACKEND_HOST` | IP privada de `ec2-back`, inyectada en `nginx.conf` por `envsubst` al arrancar el contenedor | `10.0.2.237` |

> **Nunca** hardcodear la IP del backend directamente en `nginx.conf`. Si cambia la EC2 se rompe todo. Usar siempre la variable de entorno y pasarla como GitHub Secret o variable de repositorio.

Las credenciales de base de datos y JWT **nunca** se guardan en el repositorio. Se pasan como variables de entorno en `docker-compose.yml` o como GitHub Secrets en el pipeline.

---

## Correr en local (sin Docker)

Requisito: backend corriendo en `http://localhost:3000`.

```bash
npm install
npm start          # ng serve → http://localhost:4200
```

---

## Build de producción

```bash
npm run build      # ng build --configuration production
```

> **Importante — Angular 17:** el artefacto final queda en
> `dist/casino-frontend/browser/`, **no** en `dist/casino-frontend/`.
> La subcarpeta `browser/` es nueva desde v17 con el application builder.
> El `COPY` del Dockerfile debe apuntar exactamente a esa ruta.

---

## Docker

### Por qué Angular necesita reverse proxy (CSR)

El frontend es una aplicación **Client-Side Rendering (CSR)**. La EC2 del frontend solo entrega los archivos estáticos (HTML, JS, CSS) al navegador. Todo el código Angular se ejecuta **dentro del navegador del jugador**, no en AWS.

Cuando Angular hace `this.http.get('/api/games')`, la petición sale **desde el computador del jugador**. Si `environment.prod.ts` tuviera una URL absoluta como `http://10.0.2.237:3000`, el navegador intentaría conectarse directamente al backend privado — que no tiene IP pública y cuyo Security Group solo acepta tráfico del SG del frontend — resultando siempre en `timeout` o `ERR_CONNECTION_REFUSED`.

La solución es que `apiBaseUrl` sea `''` (cadena vacía) y que **Nginx en la EC2 pública** actúe como reverse proxy, reenviando `/api/` al backend por la red interna de la VPC:

```
[Navegador del jugador]
        |
        |  http://<IP_PUBLICA_FRONTEND>/api/games
        |  (mismo origen → sin CORS)
        v
[Nginx en ec2-front — subred pública]
        |
        |  proxy_pass http://10.0.2.237:3000/games
        |  (red interna VPC, autorizado por SG)
        v
[Node.js en ec2-back — subred privada]
        |
        v
[PostgreSQL — mismo docker network]
```

---

### Dockerfile (multi-stage)

Dos etapas: la primera compila la SPA con Node, la segunda sirve solo los estáticos con Nginx sin root.

```dockerfile
# ── Etapa 1: build ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Etapa 2: runtime ────────────────────────────────────────────
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --from=builder --chown=nginx:nginx /app/dist/casino-frontend/browser/ /usr/share/nginx/html/
COPY --chown=nginx:nginx nginx.conf /etc/nginx/templates/default.conf.template
USER nginx
EXPOSE 8080
```

> **Puntos clave:**
> - El artefacto de Angular 17 queda en `dist/casino-frontend/browser/` — no en `dist/casino-frontend/`.
> - El `nginx.conf` se copia a `/etc/nginx/templates/` (no a `conf.d/`). La imagen `nginx-unprivileged` ya trae un entrypoint que procesa los archivos `*.template` con `envsubst` y deja el resultado en `/etc/nginx/conf.d/` al arrancar. Así se inyecta `BACKEND_HOST` automáticamente.
> - `nginx-unprivileged` escucha en el puerto **8080** internamente. En EC2 se mapea a `80`: `-p 80:8080`.

### Verificar usuario no root

```bash
docker exec <container_id> whoami
# debe responder: nginx  (no root)
```

---

### Configuración de Nginx (`nginx.conf` en la raíz del proyecto)

```nginx
server {
    listen 8080;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback: cualquier ruta de Angular cae a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy al backend en subred privada
    # La barra final en proxy_pass reescribe /api/games → /games
    # Si el backend espera el prefijo /api/, quitar la barra final
    location /api/ {
        proxy_pass http://${BACKEND_HOST}:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache de assets estáticos
    location ~* \.(?:js|css|woff2?|svg|png|jpg|jpeg|gif|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

> **Atención a la barra final del `proxy_pass`:** con `/` al final, Nginx reemplaza `/api/` por `/`, entonces `/api/games` llega al backend como `/games`. Si el backend define sus rutas con el prefijo `/api/`, quitar la barra y usar `proxy_pass http://${BACKEND_HOST}:3000;`. Revisar `src/routes/` del backend para confirmar.

### .dockerignore

```
node_modules
dist
.git
.github
*.md
.env
```

---

## Docker Compose (stack completo local)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: casino
      POSTGRES_PASSWORD: casino123
      POSTGRES_DB: casino_db
    volumes:
      - pg-data:/var/lib/postgresql/data
    networks:
      - casino-net

  casino-backend:
    build: ../casino-backend
    environment:
      DATABASE_URL: postgres://casino:casino123@db:5432/casino_db
      JWT_SECRET: supersecreto
      PORT: 3000
    depends_on:
      - db
    networks:
      - casino-net

  casino-frontend:
    build: .
    environment:
      - BACKEND_HOST=casino-backend   # en local, nombre del servicio Docker
    ports:
      - "80:8080"
    depends_on:
      - casino-backend
    networks:
      - casino-net

volumes:
  pg-data:

networks:
  casino-net:
```

> **En local** `BACKEND_HOST` es el nombre del servicio Docker (`casino-backend`), porque Docker resuelve el nombre dentro de la red interna.
> **En EC2** es la IP privada del backend (`10.0.2.237`), pasada como Secret en el pipeline.
>
> Notar que el backend **no expone puerto** en compose — solo el frontend lo hace. Esto replica el aislamiento de la subred privada en producción.

```bash
# Levantar todo el stack
docker compose up --build

# Validar reverse proxy en local
# Abrir http://localhost → DevTools → Network → las llamadas /api/... deben
# mostrar Remote Address apuntando al contenedor del frontend, no al backend

# Verificar persistencia
docker compose rm -f db
docker compose up -d db
# Los datos siguen ahí gracias al named volume pg-data
```

> **Named volume vs bind mount:** se eligió `named volume` porque Docker gestiona el ciclo de vida del almacenamiento de forma independiente al contenedor, los datos sobreviven a `docker rm` y funcionan igual en cualquier SO sin problemas de permisos.

---

## CI/CD — GitHub Actions

### Ramas

| Rama | Propósito |
|------|-----------|
| `main` | Referencia estable. No se hace push directo. |
| `dev` | Trabajo diario. Todos los commits van aquí. |
| `deploy` | Gatilla el pipeline. Solo se hace merge desde `dev`. |

**Flujo esperado:**
```
dev (commits) → merge a deploy → push dispara Actions → build → push registry → deploy en EC2
```

### Workflow `.github/workflows/deploy-frontend.yml`

```yaml
name: Deploy Frontend

on:
  push:
    branches:
      - deploy

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Login a Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build y push imagen
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ secrets.DOCKERHUB_USERNAME }}/casino-frontend:latest
            ${{ secrets.DOCKERHUB_USERNAME }}/casino-frontend:${{ github.sha }}

      - name: Deploy en EC2
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_FRONT_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            docker pull ${{ secrets.DOCKERHUB_USERNAME }}/casino-frontend:latest
            docker stop casino-frontend || true
            docker rm casino-frontend || true
            docker run -d \
              --name casino-frontend \
              -p 80:8080 \
              -e BACKEND_HOST=${{ secrets.EC2_BACK_PRIVATE_IP }} \
              ${{ secrets.DOCKERHUB_USERNAME }}/casino-frontend:latest
```

### GitHub Secrets requeridos

| Secret | Descripción |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Usuario de Docker Hub |
| `DOCKERHUB_TOKEN` | Token de acceso de Docker Hub |
| `EC2_FRONT_HOST` | IP pública de `ec2-front` (`52.71.44.40`) |
| `EC2_SSH_KEY` | Clave privada SSH para conectarse a la EC2 |
| `EC2_BACK_PRIVATE_IP` | IP privada de `ec2-back` (`10.0.2.237`) — se inyecta como `BACKEND_HOST` |

> Las credenciales de AWS Academy expiran cada ~4 horas.
> Actualizar `EC2_SSH_KEY`, `EC2_FRONT_HOST` y `EC2_BACK_PRIVATE_IP` en cada sesión si cambian.
> La IP privada del backend se obtiene en AWS Console → EC2 → instancia backend → **Private IPv4 address**.

---

## Despliegue en AWS EC2

### Infraestructura

| Recurso | Valor |
|---------|-------|
| VPC | `vidal-casino-vpc` — `10.0.0.0/16` |
| Subred pública | `10.0.1.0/24` |
| Subred privada | `10.0.2.0/24` |
| `ec2-front` | `t3.micro` — Amazon Linux — IP pública `52.71.44.40` |
| `ec2-back` | `t3.micro` — Amazon Linux — IP privada `10.0.2.237` |
| Security Group frontend | `sg-front`: IN 80 `0.0.0.0/0`, IN 22 `0.0.0.0/0` |
| Security Group backend | `sg-back`: IN 3000 `sg-front`, IN 22 `sg-front` |

### Pasos de despliegue manual (primera vez)

```bash
# 1. Conectarse a ec2-front
ssh -i clave.pem ec2-user@52.71.44.40

# 2. Instalar Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user

# 3. Instalar Git
sudo yum install -y git

# 4. Correr el contenedor
docker pull <usuario>/casino-frontend:latest
docker run -d --name casino-frontend -p 80:8080 <usuario>/casino-frontend:latest

# 5. Verificar
curl http://localhost
```

### Verificar que solo el frontend está expuesto a Internet

```bash
# 1. Desde ec2-front (Session Manager) — debe responder 200
curl -i http://localhost/api/health
# Si responde 404 → el location /api/ no está en nginx.conf
# Si responde 502 → Nginx llegó pero el backend no responde, revisar BACKEND_HOST

# 2. Desde tu computador — debe responder 200
curl -i http://52.71.44.40/api/health

# 3. Intento directo al backend — debe fallar (timeout o connection refused)
curl --max-time 5 http://52.71.44.40:3000/health
# Si responde, el backend está mal expuesto → pierden IE6 e IE7
# ec2-back no debería tener IP pública asignada
```

---

## Endpoints del backend (consumidos por esta SPA)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Registro de usuario |
| `POST` | `/api/auth/login` | Login, retorna JWT |
| `GET` | `/api/auth/profile` | Perfil del usuario autenticado |
| `POST` | `/api/games/slots` | Jugar tragamonedas |
| `POST` | `/api/games/roulette` | Jugar ruleta |
| `POST` | `/api/games/blackjack` | Jugar blackjack |
| `GET` | `/api/transactions` | Historial de transacciones |

---

## Checklist de validación antes de entregar

Hacer esto antes de tomar las capturas. Si alguno falla, el reverse proxy no está bien armado:

**1. Local — con `docker compose up`**
Abrir `http://localhost` → DevTools (F12) → Network → hacer login.
Las llamadas `/api/...` deben aparecer con status `200` y `Remote Address` apuntando al contenedor del frontend, no al backend.

**2. En ec2-front — vía Session Manager**
```bash
curl -i http://localhost/api/health
# 200 OK → correcto
# 404   → falta el bloque location /api/ en nginx.conf
# 502   → Nginx llegó pero backend no responde, revisar BACKEND_HOST
```

**3. Desde tu computador — contra la IP pública**
```bash
curl -i http://52.71.44.40/api/health
# debe responder 200
```

**4. Intento directo al backend — debe fallar**
```bash
curl --max-time 5 http://<IP_PUBLICA_BACKEND>:3000/health
# timeout o connection refused → correcto
# Si responde → backend mal expuesto, pierden IE6 e IE7
```

**5. Sesión real de juego en el navegador**
Abrir `http://52.71.44.40`, registrarse, iniciar sesión, jugar una partida de slots.
En DevTools → Network, cada `/api/...` debe mostrar:
- Status: `200`
- Remote Address: IP pública del frontend (no la del backend)
- Response headers: sin errores CORS

**6. Persistencia**
Hacer una transacción → reiniciar el contenedor de BD → volver al historial: la transacción debe seguir ahí.

**7. Pipeline end-to-end**
Hacer un cambio mínimo en `dev`, mergear a `deploy`, ver el run verde en GitHub Actions, refrescar el navegador y confirmar que el cambio aparece sin tocar nada en la EC2.

---

## Troubleshooting

| Problema | Causa probable | Solución |
|----------|----------------|----------|
| `404` al recargar una ruta Angular | Falta `try_files $uri /index.html` | Revisar `nginx.conf` |
| `502 Bad Gateway` en `/api/` | `BACKEND_HOST` incorrecto o backend caído | Verificar IP privada y que `ec2-back` esté corriendo |
| `ERR_CONNECTION_REFUSED` en DevTools | `apiBaseUrl` tiene URL absoluta del backend | Confirmar que `environment.prod.ts` tenga `apiBaseUrl: ''` |
| `404` desde Nginx al llamar `/api/games` | Problema con la barra final del `proxy_pass` | Revisar si el backend usa o no el prefijo `/api/` en sus rutas |
| IP privada del backend hardcodeada en `nginx.conf` | Al cambiar la EC2 se rompe todo | Usar siempre `${BACKEND_HOST}` como variable |
| Backend accesible desde Internet | EC2 backend tiene IP pública o SG con `0.0.0.0/0` | Quitar IP pública, poner `Source: sg-front` en el SG |
| SG del backend con `0.0.0.0/0` | Rompe el aislamiento de red | Source debe ser `sg-front` (no un CIDR) |
| `npm run build` falla en Docker | `node_modules` obsoleto en caché | Agregar `--no-cache` al `docker build` |
| Pipeline falla en step deploy | Secret SSH vencido (AWS Academy ~4h) | Actualizar `EC2_SSH_KEY` en GitHub Secrets |
| Contenedor corre como root | Imagen base incorrecta | Usar `nginxinc/nginx-unprivileged:1.27-alpine`, no `nginx:alpine` |
| Datos de BD se pierden al reiniciar | Sin volumen configurado | Verificar que `pg-data` esté en `volumes:` del compose |
| Frontend levanta pero navegador no llega | Puerto 80 no expuesto en EC2 o falta mapeo `80:8080` | Revisar Security Group de `ec2-front` y el `docker run` |

---

## Comandos útiles

```bash
# Ver logs del contenedor en tiempo real
docker logs -f casino-frontend

# Entrar al contenedor
docker exec -it casino-frontend sh

# Confirmar usuario no root
docker exec casino-frontend whoami
# → nginx

# Reconstruir sin caché
docker compose build --no-cache

# Bajar todo y limpiar volúmenes (¡borra datos de BD!)
docker compose down -v

# Ver imágenes publicadas con sus tags
docker images | grep casino-frontend
```

---

## Notas de arquitectura

- **Standalone components:** no hay `NgModule`. La configuración global (router, HTTP client, interceptors) está en `main.ts` con `provideRouter` y `provideHttpClient`.
- **Signals:** `AuthService` usa `signal()` y `computed()` de Angular 17 en lugar de `BehaviorSubject`. Los componentes leen los signals directamente en el template: `{{ auth.usuario()?.username }}`.
- **Lazy loading:** cada ruta carga su componente solo cuando se visita (`loadComponent`). Reduce el bundle inicial y mejora el LCP.
- **Three.js fuera de NgZone:** el loop de animación corre en `ngZone.runOutsideAngular()` para no disparar detección de cambios en cada frame de `requestAnimationFrame`.
- **Multi-stage build:** la imagen final no contiene `node_modules`, el compilador de Angular ni el código fuente TypeScript. Solo los archivos estáticos compilados y Nginx.

---

## Dependencias notables

| Paquete | Versión | Para qué se usa |
|---------|---------|-----------------|
| `@angular/core` | ^17.3 | Framework principal |
| `gsap` | ^3.15 | Animaciones UI |
| `three` | ^0.184 | Fondo WebGL con naipes 3D y partículas |
| `@types/three` | ^0.184 | TypeScript types para Three.js |
| `rxjs` | ~7.8 | Observables HTTP y reactividad |
| `zone.js` | ~0.14 | Detección de cambios de Angular |

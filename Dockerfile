# =============================================================================
# Dockerfile — bms-core-suporte-frontend (Cloud Run).
# Stage 1: build Vite. Stage 2: nginx servindo a SPA + proxy /api → backend
# interno no GKE (ILB), via Direct VPC egress do Cloud Run.
# VITE_API_URL vazio = requisições relativas à MESMA origem (proxy /api) —
# é o que torna o cookie httpOnly de refresh same-origin (SameSite=Lax).
# =============================================================================

FROM node:22-alpine AS build
WORKDIR /app

# vendor/ contém o tarball do design system referenciado pelo package.json (file:)
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci

COPY . .

ARG VITE_API_URL=""
ARG VITE_APP_NAME="BMS Core Suporte"
ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_NAME=$VITE_APP_NAME
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Template processado pelo entrypoint oficial do nginx (envsubst em ${PORT}/${BACKEND_HOST})
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Cloud Run injeta PORT (8080); BACKEND_HOST é definido no deploy (IP do ILB)
ENV PORT=8080 \
    BACKEND_HOST=127.0.0.1

EXPOSE 8080

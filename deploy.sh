#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy do bms-core-suporte-frontend no Cloud Run.
#   Serve a SPA (Vite) e faz PROXY de /api -> backend no Cloud Run (ingress interno),
#   alcançado por Direct VPC egress all-traffic. Assim frontend, API e cookie de refresh
#   compartilham a MESMA origem https://...run.app (sem CORS no navegador).
#
# Subcomandos:
#   ./deploy.sh            -> all: deploy completo
#   ./deploy.sh setup      -> IMPRIME pré-requisitos (IAM). Você roda manualmente.
#   ./deploy.sh deploy     -> build (Cloud Build) + deploy completo (config + imagem)
#   ./deploy.sh redeploy   -> RECOMPILA e atualiza SÓ a imagem (mantém config)
#
# Sem secrets: o frontend não tem valor sensível (VITE_* é público por definição).
# Ordem: deploy o BACKEND primeiro - este script descobre o host dele no Cloud Run
# (ou receba BACKEND_HOST=<host> por env). IMAGE_REF=<imagem> pula o build no deploy.
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# 1) CONFIG (sobrescrevível por env)
# -----------------------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-invoicy-ped}"
REGION="${REGION:-southamerica-east1}"
SERVICE="${SERVICE:-bms-core-suporte-frontend}"

# Rede para o Direct VPC egress. all-traffic é obrigatório: o backend tem ingress
# interno e só aceita chamada que chega pela VPC (a subnet tem Private Google Access).
VPC_NETWORK="${VPC_NETWORK:-default}"
VPC_SUBNET="${VPC_SUBNET:-ad-subnet}"

# Host do backend no Cloud Run (sem https://). Vazio = descobrir pelo serviço.
BACKEND_HOST="${BACKEND_HOST:-}"
BACKEND_SERVICE="${BACKEND_SERVICE:-bms-core-suporte-backend}"

IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE}"

# Recursos de runtime — timeout 3600s por causa das conexões SSE (/api/v1/events)
MEMORY="${MEMORY:-256Mi}"
CPU="${CPU:-1}"
TIMEOUT="${TIMEOUT:-3600}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-3}"

# -----------------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------------
c_info() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
c_ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
c_err()  { printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; }

exigir_gcloud() {
  command -v gcloud >/dev/null 2>&1 || { c_err "gcloud não encontrado."; exit 1; }
}

imagem_ref() { echo "${IMAGE_BASE}:$(date +%Y%m%d-%H%M%S)"; }

build_imagem() { # $1=IMAGE_REF
  c_info "Build da imagem (Cloud Build): $1"
  gcloud builds submit --project="$PROJECT_ID" --region="$REGION" --timeout=1200s --tag "$1" .
}

descobrir_backend_host() {
  [ -n "$BACKEND_HOST" ] && return
  c_info "Descobrindo o host do backend no Cloud Run..."
  BACKEND_HOST="$(gcloud run services describe "$BACKEND_SERVICE" --project="$PROJECT_ID" --region="$REGION" \
    --format='value(status.url)' 2>/dev/null | tr -d '\r' | sed 's#^https://##')"
  [ -n "$BACKEND_HOST" ] \
    || { c_err "Backend '${BACKEND_SERVICE}' não encontrado - faça o deploy do backend primeiro (repo bms-core-suporte-backend)."; exit 1; }
  c_ok "Backend interno: https://${BACKEND_HOST}"
}

# =============================================================================
# setup — IMPRIME os pré-requisitos. VOCÊ roda manualmente (nunca este script).
# =============================================================================
cmd_setup() {
  cat <<EOF

# ============================================================================
# PRÉ-REQUISITOS — copie e rode os comandos abaixo (você, manualmente).
# APIs necessárias já estão habilitadas no projeto ${PROJECT_ID}.
# ============================================================================

# 0) Projeto ativo
gcloud config set project ${PROJECT_ID}

# 1) IAM — sua identidade precisa de (rode com um admin do projeto):
gcloud projects add-iam-policy-binding ${PROJECT_ID} \\
  --member="user:SEU_EMAIL" --role="roles/run.admin"

# 2) Direct VPC egress usa a subnet '${VPC_SUBNET}' da VPC '${VPC_NETWORK}', que precisa
#    de Private Google Access (privateIpGoogleAccess: True) para chegar no backend interno:
gcloud compute networks subnets describe ${VPC_SUBNET} --region=${REGION} --format='value(privateIpGoogleAccess)'

# 3) Ordem de deploy: PRIMEIRO o backend (bms-core-suporte-backend), depois:
#    ./deploy.sh all
# ============================================================================
EOF
}

# =============================================================================
# deploy — build + deploy completo (config + imagem). 1ª vez ou reconfiguração.
# =============================================================================
cmd_deploy() {
  exigir_gcloud
  descobrir_backend_host

  local IMAGE_REF="${IMAGE_REF:-}"
  if [ -z "$IMAGE_REF" ]; then IMAGE_REF="$(imagem_ref)"; build_imagem "$IMAGE_REF"; fi

  c_info "Deploy '${SERVICE}' em ${REGION} (projeto ${PROJECT_ID})..."
  gcloud run deploy "$SERVICE" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --image="$IMAGE_REF" \
    --platform=managed \
    --allow-unauthenticated \
    --network="$VPC_NETWORK" --subnet="$VPC_SUBNET" --vpc-egress=all-traffic \
    --set-env-vars="BACKEND_HOST=${BACKEND_HOST}" \
    --memory="$MEMORY" --cpu="$CPU" --timeout="$TIMEOUT" \
    --min-instances="$MIN_INSTANCES" --max-instances="$MAX_INSTANCES"

  local URL
  URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
  c_ok "Frontend no ar: $URL"
  c_info "Pós-deploy:"
  c_info "  1. Confirme que o backend tem Cors__AllowedOrigins__0=${URL} (deploy.sh do backend, FRONTEND_URL)."
  c_info "  2. Extensão Chrome usa VITE_API_BASE_URL=${URL}/api/v1 (só muda se a URL do frontend mudar)."
}

# =============================================================================
# redeploy — recompila e atualiza SÓ a imagem (mantém env vars e recursos).
# =============================================================================
cmd_redeploy() {
  exigir_gcloud
  gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" >/dev/null 2>&1 \
    || { c_err "Serviço '${SERVICE}' não existe — rode './deploy.sh all' para o 1º deploy."; exit 1; }

  local IMAGE_REF; IMAGE_REF="$(imagem_ref)"
  build_imagem "$IMAGE_REF"

  c_info "Atualizando imagem do serviço '${SERVICE}'..."
  gcloud run services update "$SERVICE" \
    --project="$PROJECT_ID" --region="$REGION" --image="$IMAGE_REF"

  local URL
  URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
  c_ok "Redeploy concluído: $URL"
}

# -----------------------------------------------------------------------------
main() {
  case "${1:-all}" in
    all|deploy) cmd_deploy ;;
    setup)      cmd_setup ;;
    redeploy)   cmd_redeploy ;;
    *) c_err "Uso: ./deploy.sh [all|setup|deploy|redeploy]"; exit 1 ;;
  esac
}
main "$@"

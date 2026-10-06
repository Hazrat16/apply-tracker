#!/usr/bin/env bash
# Runs ON the server (as root via SSM, or as ubuntu via SSH).
# Writes the compose files, logs into the registry, and restarts the stack.
set -euo pipefail

: "${IMAGE_REGISTRY:?}"
: "${IMAGE_TAG:?}"
: "${COMPOSE_B64:?}"
: "${CADDY_B64:?}"
: "${ACME_EMAIL:?}"

if [ "$(id -u)" -eq 0 ]; then
  DOCKER=(docker)
else
  DOCKER=(sudo docker)
fi

install_docker() {
  if "${DOCKER[@]}" compose version >/dev/null 2>&1; then
    return
  fi
  curl -fsSL https://get.docker.com | sudo sh
  if [ "$(id -u)" -ne 0 ]; then
    sudo usermod -aG docker "$USER" || true
  fi
}

install_aws_cli() {
  if command -v aws >/dev/null 2>&1; then
    return
  fi
  case "$(uname -m)" in
    aarch64 | arm64) arch=aarch64 ;;
    *) arch=x86_64 ;;
  esac
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${arch}.zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  sudo /tmp/aws/install --update
}

install_docker

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | "${DOCKER[@]}" login ghcr.io -u "$GHCR_USER" --password-stdin
else
  install_aws_cli
  : "${AWS_REGION:?}"
  aws ecr get-login-password --region "$AWS_REGION" | "${DOCKER[@]}" login --username AWS --password-stdin "$IMAGE_REGISTRY"
fi

install -d -m 755 /opt/apply-tracker
cd /opt/apply-tracker
echo "$COMPOSE_B64" | base64 -d > docker-compose.yml
echo "$CADDY_B64" | base64 -d > Caddyfile

if [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${JWT_ACCESS_SECRET:-}" ]; then
  if [ -z "${GHCR_TOKEN:-}" ]; then
    POSTGRES_PASSWORD="$(aws ssm get-parameter --name /apply-tracker/postgres-password --with-decryption --query Parameter.Value --output text --region "$AWS_REGION")"
    JWT_ACCESS_SECRET="$(aws ssm get-parameter --name /apply-tracker/jwt-access-secret --with-decryption --query Parameter.Value --output text --region "$AWS_REGION")"
  elif [ -f /opt/apply-tracker/.secrets ]; then
    # shellcheck disable=SC1091
    . /opt/apply-tracker/.secrets
  else
    umask 077
    POSTGRES_PASSWORD="$(openssl rand -hex 24)"
    JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
    cat > /opt/apply-tracker/.secrets <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
EOF
    chmod 600 /opt/apply-tracker/.secrets
  fi
fi

if [ -n "${PUBLIC_IP:-}" ]; then
  :
elif [ -n "${GHCR_TOKEN:-}" ]; then
  PUBLIC_IP="$(curl -4 -fsS https://ifconfig.me)"
else
  TOKEN="$(curl -fsS -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60")"
  PUBLIC_IP="$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)"
fi

SITE_ADDRESS="${PUBLIC_IP}.sslip.io"
WEB_URL="https://${SITE_ADDRESS}"

umask 077
cat > .env <<EOF
IMAGE_REGISTRY=${IMAGE_REGISTRY}
IMAGE_TAG=${IMAGE_TAG}
SITE_ADDRESS=${SITE_ADDRESS}
ACME_EMAIL=${ACME_EMAIL}
WEB_URL=${WEB_URL}
CORS_ORIGINS=${WEB_URL}
NODE_ENV=production
PORT=4000
TRUST_PROXY=1
DATABASE_URL=postgresql://apply:${POSTGRES_PASSWORD}@postgres:5432/apply_tracker?schema=public
REDIS_URL=redis://redis:6379
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
DEMO_ENABLED=true
RATE_LIMIT_ENABLED=true
EOF
chmod 600 .env

if [ -n "${GHCR_TOKEN:-}" ]; then
  sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
  sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
fi

"${DOCKER[@]}" compose pull
"${DOCKER[@]}" compose up -d --remove-orphans
if [ -n "${GHCR_TOKEN:-}" ]; then
  "${DOCKER[@]}" logout ghcr.io >/dev/null 2>&1 || true
fi
echo "Deployed ${IMAGE_TAG} at ${WEB_URL}"

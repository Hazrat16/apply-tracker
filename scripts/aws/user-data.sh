#!/bin/bash
# First boot of the EC2 instance. Docker and the AWS CLI only — CI ships the app.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl unzip
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

if ! command -v aws >/dev/null 2>&1; then
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install --update
fi

if ! fallocate -l 2G /swapfile; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
fi
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service 2>/dev/null || true
install -d -m 755 /opt/apply-tracker

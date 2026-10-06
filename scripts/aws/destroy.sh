#!/usr/bin/env bash
# Delete the AWS resources scripts/aws/bootstrap.sh created. Does not delete the GitHub OIDC provider.
set -euo pipefail

command -v aws >/dev/null
REGION="${AWS_REGION:-$(aws configure get region || true)}"
: "${REGION:?Set AWS_REGION}"
export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"

echo "This deletes the ApplyTracker instance, its disk, Elastic IP, container registry, and secrets in ${REGION}."
read -r -p "Type the AWS account id ${ACCOUNT} to continue: " typed
[ "$typed" = "$ACCOUNT" ]

INSTANCE="$(aws ec2 describe-instances \
  --filters Name=tag:Project,Values=apply-tracker Name=instance-state-name,Values=pending,running,stopping,stopped \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)"
if [ -n "$INSTANCE" ] && [ "$INSTANCE" != "None" ]; then
  aws ec2 terminate-instances --instance-ids "$INSTANCE" >/dev/null
  aws ec2 wait instance-terminated --instance-ids "$INSTANCE"
  echo "Terminated ${INSTANCE}"
fi

ALLOC="$(aws ec2 describe-addresses --filters Name=tag:Project,Values=apply-tracker --query 'Addresses[0].AllocationId' --output text)"
if [ -n "$ALLOC" ] && [ "$ALLOC" != "None" ]; then
  aws ec2 release-address --allocation-id "$ALLOC"
  echo "Released ${ALLOC}"
fi

VPC="$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)"
SG="$(aws ec2 describe-security-groups --filters Name=group-name,Values=apply-tracker Name=vpc-id,Values="$VPC" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
if [ -n "$SG" ] && [ "$SG" != "None" ]; then
  aws ec2 delete-security-group --group-id "$SG"
  echo "Deleted security group ${SG}"
fi

for repo in apply-tracker-api apply-tracker-web; do
  aws ecr delete-repository --repository-name "$repo" --force >/dev/null 2>&1 || true
done

for name in /apply-tracker/postgres-password /apply-tracker/jwt-access-secret /apply-tracker/acme-email; do
  aws ssm delete-parameter --name "$name" >/dev/null 2>&1 || true
done

aws iam remove-role-from-instance-profile --instance-profile-name apply-tracker-ec2 --role-name apply-tracker-ec2 >/dev/null 2>&1 || true
aws iam delete-instance-profile --instance-profile-name apply-tracker-ec2 >/dev/null 2>&1 || true
aws iam delete-role-policy --role-name apply-tracker-ec2 --policy-name apply-tracker-instance >/dev/null 2>&1 || true
aws iam detach-role-policy --role-name apply-tracker-ec2 \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore >/dev/null 2>&1 || true
aws iam delete-role --role-name apply-tracker-ec2 >/dev/null 2>&1 || true
aws iam delete-role-policy --role-name apply-tracker-gha --policy-name apply-tracker-deploy >/dev/null 2>&1 || true
aws iam delete-role --role-name apply-tracker-gha >/dev/null 2>&1 || true

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  for name in AWS_DEPLOY_ROLE_ARN AWS_REGION AWS_INSTANCE_ID AWS_ECR_REGISTRY APP_URL; do
    gh variable delete "$name" >/dev/null 2>&1 || true
  done
fi

echo "AWS resources for ApplyTracker are deleted. ACME_EMAIL was left in GitHub so a free-server deploy can still use it."

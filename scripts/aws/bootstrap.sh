#!/usr/bin/env bash
# One-time AWS setup. No Terraform. After this, pushing to main deploys.
#   ACME_EMAIL=you@example.com bash scripts/aws/bootstrap.sh
set -euo pipefail

: "${ACME_EMAIL:?Set ACME_EMAIL to an inbox Let's Encrypt can mail}"

for cmd in aws gh jq; do
  command -v "$cmd" >/dev/null || { echo "Install $cmd first" >&2; exit 1; }
done

cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
REGION="${AWS_REGION:-$(aws configure get region || true)}"
: "${REGION:?Set AWS_REGION or run aws configure}"
export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
echo "Account ${ACCOUNT}, region ${REGION}, repo ${REPO}"

PREFIX="apply-tracker"
GHA_ROLE="${PREFIX}-gha"
EC2_ROLE="${PREFIX}-ec2"

OIDC_ARN="arn:aws:iam::${ACCOUNT}:oidc-provider/token.actions.githubusercontent.com"
if ! aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text \
  | grep -q 'token.actions.githubusercontent.com'; then
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 >/dev/null
fi

TRUST="$(jq -n --arg arn "$OIDC_ARN" --arg repo "$REPO" '{
  Version: "2012-10-17",
  Statement: [{
    Effect: "Allow",
    Principal: {Federated: $arn},
    Action: "sts:AssumeRoleWithWebIdentity",
    Condition: {
      StringEquals: {"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"},
      StringLike: {"token.actions.githubusercontent.com:sub": ("repo:" + $repo + ":ref:refs/heads/main")}
    }
  }]
}')"
if aws iam get-role --role-name "$GHA_ROLE" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$GHA_ROLE" --policy-document "$TRUST"
else
  aws iam create-role --role-name "$GHA_ROLE" --assume-role-policy-document "$TRUST" >/dev/null
fi

EC2_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if ! aws iam get-role --role-name "$EC2_ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$EC2_ROLE" --assume-role-policy-document "$EC2_TRUST" >/dev/null
fi
aws iam attach-role-policy --role-name "$EC2_ROLE" \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

EC2_POLICY="$(jq -n --arg region "$REGION" --arg account "$ACCOUNT" '{
  Version: "2012-10-17",
  Statement: [
    {Effect: "Allow", Action: "ecr:GetAuthorizationToken", Resource: "*"},
    {
      Effect: "Allow",
      Action: ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"],
      Resource: [
        ("arn:aws:ecr:" + $region + ":" + $account + ":repository/apply-tracker-api"),
        ("arn:aws:ecr:" + $region + ":" + $account + ":repository/apply-tracker-web")
      ]
    },
    {
      Effect: "Allow",
      Action: ["ssm:GetParameter", "ssm:GetParameters"],
      Resource: ("arn:aws:ssm:" + $region + ":" + $account + ":parameter/apply-tracker/*")
    },
    {
      Effect: "Allow",
      Action: "kms:Decrypt",
      Resource: "*",
      Condition: {"StringEquals": {"kms:ViaService": ("ssm." + $region + ".amazonaws.com")}}
    }
  ]
}')"
aws iam put-role-policy --role-name "$EC2_ROLE" --policy-name "${PREFIX}-instance" --policy-document "$EC2_POLICY"

if ! aws iam get-instance-profile --instance-profile-name "$EC2_ROLE" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "$EC2_ROLE" >/dev/null
fi
if ! aws iam get-instance-profile --instance-profile-name "$EC2_ROLE" \
  --query "InstanceProfile.Roles[?RoleName=='${EC2_ROLE}']" --output text | grep -q "$EC2_ROLE"; then
  aws iam add-role-to-instance-profile --instance-profile-name "$EC2_ROLE" --role-name "$EC2_ROLE"
fi

for repo in apply-tracker-api apply-tracker-web; do
  aws ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name "$repo" \
      --image-scanning-configuration scanOnPush=true >/dev/null
done

put_secret() {
  if aws ssm get-parameter --name "$1" >/dev/null 2>&1; then
    echo "Keeping existing $1"
  else
    aws ssm put-parameter --name "$1" --type SecureString --value "$2" >/dev/null
    echo "Created $1"
  fi
}
put_secret /apply-tracker/postgres-password "$(openssl rand -hex 24)"
put_secret /apply-tracker/jwt-access-secret "$(openssl rand -hex 32)"
aws ssm put-parameter --name /apply-tracker/acme-email --type String --value "$ACME_EMAIL" --overwrite >/dev/null

VPC="$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)"
if [ -z "$VPC" ] || [ "$VPC" = "None" ]; then
  echo "This region has no default VPC. Create one with: aws ec2 create-default-vpc" >&2
  exit 1
fi
SUBNET="$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC" Name=default-for-az,Values=true \
  --query 'Subnets[0].SubnetId' --output text)"

SG="$(aws ec2 describe-security-groups --filters Name=group-name,Values="$PREFIX" Name=vpc-id,Values="$VPC" \
  --query 'SecurityGroups[0].GroupId' --output text)"
if [ -z "$SG" ] || [ "$SG" = "None" ]; then
  SG="$(aws ec2 create-security-group --group-name "$PREFIX" --description "ApplyTracker HTTPS" --vpc-id "$VPC" \
    --query GroupId --output text)"
  aws ec2 create-tags --resources "$SG" --tags Key=Project,Value="$PREFIX"
fi
for port in 80 443; do
  aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port "$port" --cidr 0.0.0.0/0 >/dev/null 2>&1 || true
done

INSTANCE="$(aws ec2 describe-instances \
  --filters Name=tag:Project,Values="$PREFIX" Name=instance-state-name,Values=pending,running,stopped \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)"
if [ -z "$INSTANCE" ] || [ "$INSTANCE" = "None" ]; then
  AMI="$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
    --query Parameter.Value --output text 2>/dev/null || true)"
  if [ -z "$AMI" ] || [ "$AMI" = "None" ]; then
    AMI="$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-ssd/ami-id \
      --query Parameter.Value --output text)"
  fi
  ROOT_DEV="$(aws ec2 describe-images --image-ids "$AMI" --query 'Images[0].RootDeviceName' --output text)"
  echo "Waiting for the instance profile to become usable..."
  INSTANCE=""
  for _ in $(seq 1 12); do
    if INSTANCE="$(aws ec2 run-instances \
      --image-id "$AMI" \
      --instance-type t3.small \
      --iam-instance-profile "Name=${EC2_ROLE}" \
      --security-group-ids "$SG" \
      --subnet-id "$SUBNET" \
      --user-data "file://${ROOT}/scripts/aws/user-data.sh" \
      --block-device-mappings "[{\"DeviceName\":\"${ROOT_DEV}\",\"Ebs\":{\"VolumeSize\":30,\"VolumeType\":\"gp3\"}}]" \
      --metadata-options 'HttpTokens=required,HttpEndpoint=enabled' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${PREFIX}},{Key=Project,Value=${PREFIX}}]" \
      --query 'Instances[0].InstanceId' --output text)"; then
      break
    fi
    echo "Instance profile is not ready yet. Retrying..."
    INSTANCE=""
    sleep 10
  done
  [ -n "$INSTANCE" ]
  echo "Launched ${INSTANCE}"
else
  echo "Reusing ${INSTANCE}"
  state="$(aws ec2 describe-instances --instance-ids "$INSTANCE" --query 'Reservations[0].Instances[0].State.Name' --output text)"
  if [ "$state" = "stopped" ]; then
    aws ec2 start-instances --instance-ids "$INSTANCE" >/dev/null
  fi
fi

aws ec2 wait instance-running --instance-ids "$INSTANCE"

ALLOC="$(aws ec2 describe-addresses --filters Name=tag:Project,Values="$PREFIX" --query 'Addresses[0].AllocationId' --output text)"
if [ -z "$ALLOC" ] || [ "$ALLOC" = "None" ]; then
  ALLOC="$(aws ec2 allocate-address --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=${PREFIX}},{Key=Project,Value=${PREFIX}}]" \
    --query AllocationId --output text)"
fi
aws ec2 associate-address --instance-id "$INSTANCE" --allocation-id "$ALLOC" >/dev/null
PUBLIC_IP="$(aws ec2 describe-addresses --allocation-ids "$ALLOC" --query 'Addresses[0].PublicIp' --output text)"

echo "Waiting for Systems Manager..."
online=""
for _ in $(seq 1 60); do
  online="$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=${INSTANCE}" \
    --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
  [ "$online" = "Online" ] && break
  sleep 10
done
if [ "$online" != "Online" ]; then
  echo "Instance ${INSTANCE} is not online in Systems Manager yet. Re-run this script in a few minutes." >&2
  exit 1
fi

GHA_POLICY="$(jq -n --arg region "$REGION" --arg account "$ACCOUNT" --arg instance "$INSTANCE" '{
  Version: "2012-10-17",
  Statement: [
    {Effect: "Allow", Action: "ecr:GetAuthorizationToken", Resource: "*"},
    {
      Effect: "Allow",
      Action: [
        "ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:InitiateLayerUpload",
        "ecr:PutImage", "ecr:UploadLayerPart", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"
      ],
      Resource: [
        ("arn:aws:ecr:" + $region + ":" + $account + ":repository/apply-tracker-api"),
        ("arn:aws:ecr:" + $region + ":" + $account + ":repository/apply-tracker-web")
      ]
    },
    {
      Effect: "Allow",
      Action: "ssm:SendCommand",
      Resource: [
        ("arn:aws:ssm:" + $region + "::document/AWS-RunShellScript"),
        ("arn:aws:ec2:" + $region + ":" + $account + ":instance/" + $instance)
      ]
    },
    {Effect: "Allow", Action: ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"], Resource: "*"}
  ]
}')"
aws iam put-role-policy --role-name "$GHA_ROLE" --policy-name "${PREFIX}-deploy" --policy-document "$GHA_POLICY"

ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${GHA_ROLE}"
REGISTRY="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
APP_URL="https://${PUBLIC_IP}.sslip.io"

gh variable set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN"
gh variable set AWS_REGION --body "$REGION"
gh variable set AWS_INSTANCE_ID --body "$INSTANCE"
gh variable set AWS_ECR_REGISTRY --body "$REGISTRY"
gh variable set APP_URL --body "$APP_URL"
gh variable set ACME_EMAIL --body "$ACME_EMAIL"

cat <<EOF

AWS is ready. Pushes do not deploy. Run the Deploy workflow when you want a release.

  ${APP_URL}

  gh workflow run Deploy --ref main -f target=aws

EOF

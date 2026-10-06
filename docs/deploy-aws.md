# Deploy ApplyTracker on AWS

You deploy from GitHub Actions when you choose to. A push to `main` runs CI only. Actions → **Deploy** → **Run workflow**, with target **aws**. The run builds the images, sends them to the instance, and checks `/api/health`. There is no Terraform and no SSH step on each release.

The site is `https://<elastic-ip>.sslip.io`. That name already points at the instance, so you do not buy a domain. Caddy gets a normal HTTPS certificate, which the sign-in cookies need.

GitHub signs in to AWS with OpenID Connect, so the repository stores no AWS access keys. Run the workflow from `main`.

A `t3.small` is the instance size. A `t3.micro` does not have enough memory to run the web app, API, worker, Postgres, and Redis together. New AWS accounts spend credits rather than getting a permanent free instance. Set a billing alarm before you start, and confirm the current [AWS Free Tier](https://aws.amazon.com/free/) rules. For a server that stays free, use [deploy-free-tier.md](./deploy-free-tier.md).

## One-time setup

On your machine, from the repository root, with the AWS CLI logged in as an admin and the GitHub CLI logged in to this repo:

```bash
export AWS_REGION=ap-south-1
ACME_EMAIL=you@example.com bash scripts/aws/bootstrap.sh
```

Use the region you want. `ACME_EMAIL` is only for certificate expiry notices.

The script creates the instance, Elastic IP, container registry, GitHub login role, and the database password. It writes the addresses into GitHub Actions variables. Re-running it does not rotate the password or launch a second instance.

Then start the first deploy. In GitHub: Actions → **Deploy** → **Run workflow** → target **aws**. Or:

```bash
gh workflow run Deploy --ref main -f target=aws
```

Watch it under the repository’s Actions tab. When it is green, open the URL the script printed.

## What a deploy does

1. You run the **Deploy** workflow and pick **aws** (or **both**).
2. Actions builds `apply-tracker-api` and `apply-tracker-web` and pushes them to ECR.
3. Systems Manager runs `scripts/deploy/remote.sh` on the instance. That starts Caddy, the web app, the API, the worker, Postgres, and Redis.
4. Actions requests `https://<ip>.sslip.io/api/health` until it returns 200.

The API container applies database migrations before it listens. The worker does not. “Try the demo” is on. Each demo account is deleted after 24 hours.

Postgres and Redis are not reachable from the internet. Port 22 is closed. The deploy uses Systems Manager.

## Day to day

Pushing to `main` does not deploy. When you want a release, run **Deploy** again with target **aws**:

```bash
gh workflow run Deploy --ref main -f target=aws
```

Password-reset email and Google sign-in wait until you have a domain a mail provider can verify. Registration still signs the user in.

## Remove it

```bash
export AWS_REGION=ap-south-1
bash scripts/aws/destroy.sh
```

That terminates the instance and deletes its disk, the Elastic IP, the registry, and the stored secrets.

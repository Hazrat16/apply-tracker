# Deploy ApplyTracker on a free server

Use an **Oracle Cloud Always Free** Ampere VM, then deploy it yourself from GitHub Actions. The VM is the only part you create by hand: Oracle has no shorter setup, and this project does not use Terraform. A push to `main` does not deploy. After the two secrets below exist, run the **Deploy** workflow and choose **free-server**.

The site is `https://<public-ip>.sslip.io`. You do not buy a domain. Caddy gets a normal HTTPS certificate, which the sign-in cookies need.

Always Free limits change. Read [Oracle’s Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) before you create the instance. As of October 2026 an Always Free tenancy can run one Ampere VM at **2 OCPUs and 12 GB**. Create it in your home region. “Out of host capacity” means that availability domain is full; try another one in the same region. Sign-up asks for a card. Stay on the Always Free shape and set a budget alert at $1.

The AWS path, which deploys from the same workflow, is in [deploy-aws.md](./deploy-aws.md).

## 1. Create the VM

1. Compute → Instances → Create instance.
2. Image: Ubuntu 24.04 (Arm).
3. Shape: **VM.Standard.A1.Flex**, 2 OCPUs, 12 GB.
4. Networking: give it a public IPv4 address. Open TCP **22**, **80**, and **443** from the internet. GitHub’s runners change address, so the deploy key is what protects SSH, not an IP allow-list.
5. Add your own SSH public key, or download the private key Oracle offers.
6. Boot volume: 50 GB.

Copy the public IP. That is the host you will store in GitHub.

## 2. Tell GitHub how to reach it

From the repository root, logged in with `gh`:

```bash
gh variable set ACME_EMAIL --body "you@example.com"
gh secret set ORACLE_HOST --body "203.0.113.10"
gh secret set ORACLE_SSH_KEY < ~/path/to/the-private-key
```

Replace the IP with the VM’s public IP. `ACME_EMAIL` is for certificate expiry notices. Skip `ACME_EMAIL` if you already ran the AWS bootstrap; that set the same variable.

`ORACLE_USER` is optional. It defaults to `ubuntu`.

## 3. Deploy

Actions → **Deploy** → **Run workflow** → target **free-server**. Or:

```bash
gh workflow run Deploy --ref main -f target=free-server
```

The **Deploy to the free server** job builds Arm images, pushes them to GitHub Container Registry, and SSHs to the VM. The first run installs Docker on the VM, opens ports 80 and 443 in the VM firewall, and creates the database password on that disk. Later runs keep the same password and the same database volume.

When the job is green, open `https://<public-ip>.sslip.io`. `/api/health` returns `"status":"ok"`. “Try the demo” opens a board. People can register and sign in. Password-reset email waits until you have a domain.

## Day to day

Run **Deploy** when you want a release. Target **free-server** updates only this VM. Target **both** updates AWS and this VM.

Deleting the VM deletes the database. There is no separate backup unless you copy one off the machine first.

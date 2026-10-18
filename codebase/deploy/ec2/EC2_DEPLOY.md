# Host the Meridian portal on EC2 — exact steps

Three ways to run the bank. This page is the third.

| Where | Command | Good for |
|---|---|---|
| Hosted class instance | nothing — it's always on | following along in class |
| Your laptop | `make up && make web` | offline, $0, full control |
| **Your EC2 box** | this page | a URL your teammates (and your agent from anywhere) can hit |

Cost note: a `t3.small` is roughly a few cents an hour. **Terminate it when class
ends** — idle cloud is the W14 lesson, and this is where you practise it.

---

## Step 1 — launch the instance (AWS CLI, copy-paste)

```bash
# pick your region once
export AWS_REGION=us-east-1

# a key pair to SSH with (skip if you already have one)
aws ec2 create-key-pair --region $AWS_REGION --key-name meridian-key \
  --query KeyMaterial --output text > ~/.ssh/meridian-key.pem
chmod 400 ~/.ssh/meridian-key.pem

# a security group that lets YOU in on 22 (ssh) and 3100 (the console)
MYIP=$(curl -s https://checkip.amazonaws.com)
SG=$(aws ec2 create-security-group --region $AWS_REGION \
      --group-name meridian-sg --description "Meridian console" \
      --query GroupId --output text)
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG \
  --protocol tcp --port 22   --cidr ${MYIP}/32
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG \
  --protocol tcp --port 3100 --cidr ${MYIP}/32

# the latest Amazon Linux 2023 AMI, resolved by SSM (no hardcoded AMI ids)
AMI=$(aws ssm get-parameters --region $AWS_REGION \
  --names /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query 'Parameters[0].Value' --output text)

# launch
aws ec2 run-instances --region $AWS_REGION \
  --image-id $AMI --instance-type t3.small \
  --key-name meridian-key --security-group-ids $SG \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=20}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=meridian-console}]' \
  --query 'Instances[0].InstanceId' --output text
```

Wait for it, then get the public DNS:

```bash
INSTANCE=<the id printed above>
aws ec2 wait instance-running --region $AWS_REGION --instance-ids $INSTANCE
aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE \
  --query 'Reservations[0].Instances[0].PublicDnsName' --output text
```

## Step 2 — bootstrap the box (one script)

```bash
PUBLIC=<the public dns from above>
ssh -i ~/.ssh/meridian-key.pem ec2-user@$PUBLIC

# on the instance — point it at wherever you pushed this codebase:
curl -fsSL https://raw.githubusercontent.com/<you>/<your-repo>/main/deploy/ec2/ec2_bootstrap.sh \
  | bash -s -- https://github.com/<you>/<your-repo>.git
```

No repo yet? Copy the tree up instead, then run the script locally on the box:

```bash
# from your laptop, at the codebase root
rsync -az --exclude node_modules --exclude .next --exclude .venv \
  ./ ec2-user@$PUBLIC:/tmp/meridian/
ssh -i ~/.ssh/meridian-key.pem ec2-user@$PUBLIC \
  'sudo mkdir -p /opt/meridian && sudo cp -r /tmp/meridian/. /opt/meridian/ && \
   sudo chown -R ec2-user:ec2-user /opt/meridian && bash /opt/meridian/deploy/ec2/ec2_bootstrap.sh'
```

The script installs Docker/Node/uv, starts Postgres, loads the 100k-row
deterministic seed, applies `api.sql`, **mints two scoped analyst keys into
`/opt/meridian/ANALYST_KEYS.txt`**, builds the console, and registers a systemd
service so it survives reboots.

## Step 3 — point everything at your box

```bash
export MERIDIAN_BASE_URL="http://$PUBLIC:3100/api/v1"
export MERIDIAN_CONSOLE_URL="http://$PUBLIC:3100"
export MERIDIAN_KEY_A=<type_a key from ANALYST_KEYS.txt>
export MERIDIAN_KEY_B=<type_b key from ANALYST_KEYS.txt>

make mcp-live      # two-analyst RBAC + a real ticket, on YOUR portal
make slack-live    # the Slack card's button now opens YOUR portal
```

Your agent — laptop, Lambda, or AgentCore — reaches it through the same variable.
Nothing else changes; that is the point of putting the URL in the environment.

## Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://$PUBLIC:3100/login              # 200
curl -s -o /dev/null -w '%{http_code}\n' http://$PUBLIC:3100/api/v1/disputes/29 # 401 (no key)
curl -s -H "Authorization: Bearer $MERIDIAN_KEY_A" \
  http://$PUBLIC:3100/api/v1/disputes/29 | head -c 120                          # the dispute
```

## Operate

```bash
sudo systemctl status meridian      # is it up?
sudo journalctl -u meridian -f      # logs
sudo systemctl restart meridian     # after a code change (rebuild first: npm run build)
```

## Tear down (do this)

```bash
aws ec2 terminate-instances --region $AWS_REGION --instance-ids $INSTANCE
aws ec2 delete-security-group --region $AWS_REGION --group-id $SG   # after termination completes
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| browser hangs on `:3100` | security-group rule missing, or your IP changed | re-run the `authorize-security-group-ingress` call with your current IP |
| `502`/connection refused | service not up yet (first build takes ~2 min) | `sudo journalctl -u meridian -f` |
| console loads, data empty | seed didn't load | `cd /opt/meridian/platform/db && sudo ./load.sh demo` |
| `401` on every API call | key not minted / wrong key | `cat /opt/meridian/ANALYST_KEYS.txt`, or `node mint-key.mjs --demo` |
| `403` on a dispute you expect to see | that's RBAC working — the key's scope doesn't cover that dispute type | use the other key |

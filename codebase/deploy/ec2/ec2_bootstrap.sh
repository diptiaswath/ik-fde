#!/usr/bin/env bash
# Meridian Ops Console → one EC2 box, from nothing to a public URL.
#
# Run ON the instance (Amazon Linux 2023, t3.small or bigger, 20 GB disk):
#   curl -fsSL <raw-url>/ec2_bootstrap.sh | bash -s -- <git-clone-url>
# or, if you scp'd the codebase up:
#   sudo bash deploy/ec2/ec2_bootstrap.sh
#
# What it does: installs Docker + Node + uv, starts Postgres, loads the seed,
# applies the API schema, mints two analyst keys, builds the console, and serves
# it on :3100 under systemd (survives reboots).
set -euo pipefail

REPO_URL="${1:-}"
APP_DIR="${APP_DIR:-/opt/meridian}"
PORT="${PORT:-3100}"

log() { echo -e "\n\033[1;34m==> $*\033[0m"; }

log "installing packages (docker, node 20, git, uv)"
sudo dnf install -y docker git >/dev/null
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
sudo dnf install -y nodejs >/dev/null
curl -fsSL https://astral.sh/uv/install.sh | sh >/dev/null 2>&1
export PATH="$HOME/.local/bin:$PATH"

log "starting docker"
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER" || true

log "fetching the codebase into $APP_DIR"
if [[ -n "$REPO_URL" ]]; then
  sudo rm -rf "$APP_DIR"
  sudo git clone --depth 1 "$REPO_URL" "$APP_DIR"
  sudo chown -R "$USER:$USER" "$APP_DIR"
else
  echo "    (no repo url given — assuming the codebase is already at $APP_DIR)"
fi
cd "$APP_DIR"
[[ -d platform/db ]] || { echo "!! platform/db not found — is this the codebase root?"; exit 1; }

log "postgres + deterministic seed + api schema"
cd platform/db
sudo docker compose up -d
until sudo docker compose exec -T meridian-db pg_isready -U meridian >/dev/null 2>&1; do sleep 2; done
sudo ./load.sh demo
sudo docker compose exec -T meridian-db psql -U meridian -d meridian -q -v ON_ERROR_STOP=1 < api.sql

log "minting two scoped analyst keys — COPY THESE, they are shown once"
MERIDIAN_DB_URL="postgresql://meridian:meridian@localhost:5432/meridian" node mint-key.mjs --demo | tee "$APP_DIR/ANALYST_KEYS.txt"

log "building the console"
cd "$APP_DIR/platform/web"
npm install --silent
printf 'MERIDIAN_DB_URL=postgresql://meridian:meridian@localhost:5432/meridian\n' > .env.local
npm run build

log "installing the systemd service (survives reboot)"
sudo tee /etc/systemd/system/meridian.service >/dev/null <<UNIT
[Unit]
Description=Meridian Ops Console
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR/platform/web
Environment=PORT=$PORT
Environment=MERIDIAN_DB_URL=postgresql://meridian:meridian@localhost:5432/meridian
ExecStart=/usr/bin/npm run start
Restart=always
User=$USER

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now meridian

PUBLIC=$(curl -s --max-time 3 http://169.254.169.254/latest/meta-data/public-hostname || echo "<your-ec2-public-dns>")
cat <<DONE

┌───────────────────────────────────────────────────────────────────────┐
│  Meridian Ops Console is live                                         │
└───────────────────────────────────────────────────────────────────────┘

  Console : http://$PUBLIC:$PORT
  API     : http://$PUBLIC:$PORT/api/v1
  Keys    : $APP_DIR/ANALYST_KEYS.txt
  Logs    : sudo journalctl -u meridian -f

  Open port $PORT in the instance's security group (inbound TCP, your IP).
  Point the labs at it:
      export MERIDIAN_BASE_URL="http://$PUBLIC:$PORT/api/v1"
      export MERIDIAN_CONSOLE_URL="http://$PUBLIC:$PORT"

  Tear down when class ends:  sudo systemctl stop meridian && terminate the instance.
DONE

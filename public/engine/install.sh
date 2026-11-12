#!/usr/bin/env bash
# MOVIE MAX one-line installer for a free Ubuntu cloud server (e.g. Oracle Cloud Always Free).
# Installs FFmpeg + Node.js, downloads the engine and keeps it running 24/7 (survives reboots).
#
#   curl -fsSL https://your-site/engine/install.sh | sudo MMX_API=https://your-site/api/public/engine/v1 MMX_TOKEN=mmx_eng_... bash
#
# MMX_OUTPUT=hls (default) makes this server the stream server: http://<ip>/live/playlist.m3u8
# MMX_OUTPUT=rtmp pushes to the destination in Streaming Endpoints instead (add MMX_PUBLISH_USER / MMX_PUBLISH_PASS).
set -euo pipefail

API="${MMX_API:-}"
TOKEN="${MMX_TOKEN:-}"
OUTPUT="${MMX_OUTPUT:-hls}"
PORT="${MMX_HLS_PORT:-80}"
if [ -z "$API" ] || [ -z "$TOKEN" ]; then echo "MMX_API and MMX_TOKEN are required." >&2; exit 1; fi
if [ "$(id -u)" != "0" ]; then echo "Run this with sudo." >&2; exit 1; fi
SITE="${API%/api/public/engine/v1}"

echo "==> Installing FFmpeg and Node.js"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ffmpeg nodejs curl ca-certificates
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Downloading the MOVIE MAX engine"
mkdir -p /opt/moviemax/hls
curl -fsSLo /opt/moviemax/movie-max-engine.mjs "$SITE/engine/movie-max-engine.mjs"

umask 077
{
  echo "MMX_API=$API"
  echo "MMX_TOKEN=$TOKEN"
  echo "MMX_OUTPUT=$OUTPUT"
  echo "MMX_HLS_PORT=$PORT"
  echo "MMX_HLS_DIR=/opt/moviemax/hls"
  [ -n "${MMX_PUBLISH_USER:-}" ] && echo "MMX_PUBLISH_USER=$MMX_PUBLISH_USER"
  [ -n "${MMX_PUBLISH_PASS:-}" ] && echo "MMX_PUBLISH_PASS=$MMX_PUBLISH_PASS"
  true
} > /opt/moviemax/engine.env
umask 022

cat > /etc/systemd/system/moviemax-engine.service <<'UNIT'
[Unit]
Description=MOVIE MAX playout engine
After=network-online.target
Wants=network-online.target
[Service]
WorkingDirectory=/opt/moviemax
EnvironmentFile=/opt/moviemax/engine.env
ExecStart=/usr/bin/env node /opt/moviemax/movie-max-engine.mjs
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT

if [ "$OUTPUT" = "hls" ]; then
  echo "==> Opening port $PORT for viewers"
  if command -v iptables >/dev/null 2>&1; then
    iptables -C INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$PORT" -j ACCEPT
    if ! command -v netfilter-persistent >/dev/null 2>&1; then apt-get install -y iptables-persistent || true; fi
    command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save || true
  fi
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q active; then ufw allow "$PORT"/tcp || true; fi
fi

systemctl daemon-reload
systemctl enable moviemax-engine
systemctl restart moviemax-engine

IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
echo
echo "MOVIE MAX engine is running and will keep running 24/7."
if [ "$OUTPUT" = "hls" ] && [ -n "$IP" ]; then
  SUFFIX=""; [ "$PORT" != "80" ] && SUFFIX=":$PORT"
  echo "Your stream link: http://${IP//./-}.sslip.io${SUFFIX}/live/playlist.m3u8"
  echo "Paste it in Settings -> Playout engine (or Streaming Endpoints) on your website."
fi
echo "See what it is doing: journalctl -u moviemax-engine -f"

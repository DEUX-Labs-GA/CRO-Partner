#!/usr/bin/env bash

set -euo pipefail

TUNNEL_PORT=46207
TUNNEL_PID=""

port_is_open() {
  ss -ltn 2>/dev/null | grep -q ":${TUNNEL_PORT} "
}

cleanup() {
  if [[ -n "${TUNNEL_PID}" ]] && kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    echo
    echo "Stopping Railway database tunnel..."
    kill "${TUNNEL_PID}" 2>/dev/null || true
    wait "${TUNNEL_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if port_is_open; then
  echo "Railway tunnel already available on port ${TUNNEL_PORT}."
else
  echo "Starting Railway Postgres tunnel on port ${TUNNEL_PORT}..."

  railway connect postgres \
    --tunnel-only \
    --port "${TUNNEL_PORT}" &

  TUNNEL_PID=$!

  echo "Waiting for database tunnel..."

  for attempt in {1..20}; do
    if port_is_open; then
      echo "Railway tunnel is ready."
      break
    fi

    if ! kill -0 "${TUNNEL_PID}" 2>/dev/null; then
      echo "Railway tunnel failed to start."
      wait "${TUNNEL_PID}" || true
      exit 1
    fi

    sleep 1
  done

  if ! port_is_open; then
    echo "Timed out waiting for Railway tunnel."
    exit 1
  fi
fi

echo "Starting Shopify CRO Partner development server..."
shopify app dev

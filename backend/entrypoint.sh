#!/bin/sh

# Sinyalleri gunicorn'a ilet (docker stop, restart icin)
cleanup() {
    echo "[entrypoint] Shutdown signal received, stopping gunicorn..."
    kill -TERM $PID 2>/dev/null
    wait $PID 2>/dev/null
    exit 0
}
trap cleanup TERM INT QUIT

# Gunicorn'u arka planda baslat
gunicorn \
    --bind 0.0.0.0:5001 \
    --workers 1 \
    --threads 4 \
    --worker-class gthread \
    --timeout 60 \
    --graceful-timeout 10 \
    --max-requests 200 \
    --max-requests-jitter 30 \
    --worker-tmp-dir /dev/shm \
    app:app &

PID=$!

# Baslamasini bekle
sleep 5

FAIL_COUNT=0
MAX_FAILS=3

echo "[entrypoint] Health monitoring started (PID: $PID)"

while true; do
    sleep 15

    # Gunicorn process hala yasiyor mu?
    if ! kill -0 $PID 2>/dev/null; then
        echo "[entrypoint] Gunicorn process died, exiting container"
        exit 1
    fi

    # Health endpoint cevap veriyor mu?
    if python3 -c "
import urllib.request
try:
    urllib.request.urlopen('http://localhost:5001/health', timeout=5)
except Exception:
    exit(1)
" 2>/dev/null; then
        FAIL_COUNT=0
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "[entrypoint] Health check failed ($FAIL_COUNT/$MAX_FAILS)"

        if [ "$FAIL_COUNT" -ge "$MAX_FAILS" ]; then
            echo "[entrypoint] Health check failed $MAX_FAILS times, killing container"
            kill -9 $PID 2>/dev/null
            wait $PID 2>/dev/null
            exit 1
        fi
    fi
done

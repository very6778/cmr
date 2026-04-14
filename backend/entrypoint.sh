#!/bin/sh

# Sinyalleri gunicorn'a ilet (docker stop, restart icin)
cleanup() {
    echo "[entrypoint] Shutdown signal received, stopping gunicorn..."
    kill -TERM $PID 2>/dev/null
    wait $PID 2>/dev/null
    exit 0
}
trap cleanup TERM INT QUIT

# Gunicorn: tek worker + cok thread + preload.
# PyMuPDF C extension'lari GIL release ettigi icin thread-level paralellik
# cok-core'da gercek hizlanma saglar. Preload ile font+input.pdf fork oncesi yuklenir.
# Timeout 600s: yuksek sayfa sayili islerde (100+ satir) worker oldurulmesin.
gunicorn \
    --bind 0.0.0.0:5001 \
    --workers 1 \
    --threads 16 \
    --worker-class gthread \
    --timeout 600 \
    --graceful-timeout 30 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --worker-tmp-dir /dev/shm \
    --preload \
    app:app &

PID=$!

sleep 5

FAIL_COUNT=0
MAX_FAILS=5

echo "[entrypoint] Health monitoring started (PID: $PID)"

while true; do
    sleep 30

    # Gunicorn process hala yasiyor mu?
    if ! kill -0 $PID 2>/dev/null; then
        echo "[entrypoint] Gunicorn process died, exiting container"
        exit 1
    fi

    # Health endpoint cevap veriyor mu? Timeout 10s (eski 5s, uzun is tolerans).
    if python3 -c "
import urllib.request
try:
    urllib.request.urlopen('http://localhost:5001/health', timeout=10)
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

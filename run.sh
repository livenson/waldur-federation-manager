#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID_FILE="$ROOT_DIR/.backend.pid"
FRONTEND_PID_FILE="$ROOT_DIR/.frontend.pid"
LOG_DIR="$ROOT_DIR/.logs"

kill_tree() {
    local pid=$1
    # Kill all descendants first, then the process itself
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
    # Wait briefly, then force-kill if still alive
    sleep 1
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
}

start() {
    echo "Starting Waldur Federation..."
    mkdir -p "$LOG_DIR"

    # Backend
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
        echo "Backend already running (PID $(cat "$BACKEND_PID_FILE"))"
    else
        cd "$ROOT_DIR/backend"
        nohup uv run uvicorn app.main:app --reload --port 9000 > "$LOG_DIR/backend.log" 2>&1 &
        echo $! > "$BACKEND_PID_FILE"
        echo "Backend started on http://localhost:9000 (PID $!)"
    fi

    # Frontend
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
        echo "Frontend already running (PID $(cat "$FRONTEND_PID_FILE"))"
    else
        cd "$ROOT_DIR/frontend"
        nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
        echo $! > "$FRONTEND_PID_FILE"
        echo "Frontend started on http://localhost:3000 (PID $!)"
    fi

    echo ""
    echo "Dashboard:  http://localhost:3000"
    echo "API docs:   http://localhost:9000/api/docs"
    echo "Logs:       $LOG_DIR/"
}

stop() {
    echo "Stopping Waldur Federation..."

    for name_pid in "Backend:$BACKEND_PID_FILE" "Frontend:$FRONTEND_PID_FILE"; do
        name="${name_pid%%:*}"
        pidfile="${name_pid#*:}"
        if [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                kill_tree "$pid"
                echo "$name stopped (PID $pid)"
            else
                echo "$name not running"
            fi
            rm -f "$pidfile"
        else
            echo "$name not running"
        fi
    done
}

logs() {
    local service="${2:-}"
    if [ "$service" = "backend" ]; then
        tail -f "$LOG_DIR/backend.log"
    elif [ "$service" = "frontend" ]; then
        tail -f "$LOG_DIR/frontend.log"
    else
        tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
    fi
}

status() {
    for name_pid in "Backend:$BACKEND_PID_FILE" "Frontend:$FRONTEND_PID_FILE"; do
        name="${name_pid%%:*}"
        pidfile="${name_pid#*:}"
        if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
            echo "$name: running (PID $(cat "$pidfile"))"
        else
            echo "$name: stopped"
            rm -f "$pidfile" 2>/dev/null || true
        fi
    done
}

case "${1:-start}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; sleep 1; start ;;
    status)  status ;;
    logs)    logs "$@" ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [backend|frontend]}"
        exit 1
        ;;
esac

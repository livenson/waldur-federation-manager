#!/usr/bin/env bash
# Launch multiple mock Waldur instances for federation scenarios.
#
# Usage:
#   ./mock_waldur/run_instances.sh start   # Start all 4 instances
#   ./mock_waldur/run_instances.sh stop    # Stop all instances
#   ./mock_waldur/run_instances.sh status  # Check running instances
#   ./mock_waldur/run_instances.sh logs    # Tail all logs
#
# Instances:
#   waldur-csc     :9501  — CSC's Waldur (Federation A)
#   waldur-geant   :9502  — GEANT's Waldur (Federation A)
#   waldur-desy    :9503  — DESY's Waldur (Federation B)
#   waldur-surf    :9504  — SURF's Waldur (Federation A + B, dual-federation)
#
# Scenarios enabled:
#   1. Single federation:  waldur-csc & waldur-geant both in Federation A (:9000)
#   2. Cross-federation:   waldur-surf in both Federation A (:9000) and B (:9001)
#   3. Trust bridging:     waldur-desy in Federation B, accessing waldur-csc in Federation A via waldur-surf

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/backend"

LOGS_DIR="$REPO_ROOT/mock_waldur/.logs"
PIDS_DIR="$REPO_ROOT/mock_waldur/.pids"
DATA_DIR="$REPO_ROOT/mock_waldur/data"

mkdir -p "$LOGS_DIR" "$PIDS_DIR" "$DATA_DIR"

# Instance definitions: name port db_file trust_anchors
INSTANCES=(
    "waldur-csc:9501:waldur-csc.db:http://localhost:9000"
    "waldur-geant:9502:waldur-geant.db:http://localhost:9000"
    "waldur-desy:9503:waldur-desy.db:http://localhost:9001"
    "waldur-surf:9504:waldur-surf.db:http://localhost:9000,http://localhost:9001"
)

start_instance() {
    local spec="$1"
    IFS=':' read -r name port db anchors <<< "$spec"
    local pid_file="$PIDS_DIR/$name.pid"

    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "  $name (port $port) already running (PID $(cat "$pid_file"))"
        return
    fi

    MOCK_WALDUR_INSTANCE_NAME="$name" \
    MOCK_WALDUR_PORT="$port" \
    MOCK_WALDUR_DATABASE_URL="sqlite+aiosqlite:///$DATA_DIR/$db" \
    MOCK_WALDUR_DEFAULT_TRUST_ANCHOR_URL="$(echo "$anchors" | cut -d',' -f1)" \
    MOCK_WALDUR_TRUST_ANCHOR_URLS="$anchors" \
    PYTHONPATH="$REPO_ROOT" \
    nohup uv run uvicorn mock_waldur.app:app --port "$port" \
        > "$LOGS_DIR/$name.log" 2>&1 &

    local pid=$!
    disown "$pid" 2>/dev/null || true
    echo "$pid" > "$pid_file"
    echo "  $name started on port $port (PID $!) — trust anchors: $anchors"
}

stop_instance() {
    local spec="$1"
    IFS=':' read -r name port db anchors <<< "$spec"
    local pid_file="$PIDS_DIR/$name.pid"

    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "  $name stopped (PID $pid)"
        else
            echo "  $name was not running"
        fi
        rm -f "$pid_file"
    else
        echo "  $name: no PID file"
    fi
}

status_instance() {
    local spec="$1"
    IFS=':' read -r name port db anchors <<< "$spec"
    local pid_file="$PIDS_DIR/$name.pid"

    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "  $name (port $port) — RUNNING (PID $(cat "$pid_file")) — anchors: $anchors"
    else
        echo "  $name (port $port) — STOPPED"
    fi
}

case "${1:-}" in
    start)
        echo "Starting mock Waldur instances..."
        for spec in "${INSTANCES[@]}"; do
            start_instance "$spec"
        done
        echo
        echo "Instances:"
        echo "  waldur-csc     http://localhost:9501/api/docs  (Federation A)"
        echo "  waldur-geant   http://localhost:9502/api/docs  (Federation A)"
        echo "  waldur-desy    http://localhost:9503/api/docs  (Federation B)"
        echo "  waldur-surf    http://localhost:9504/api/docs  (Federation A+B)"
        ;;
    stop)
        echo "Stopping mock Waldur instances..."
        for spec in "${INSTANCES[@]}"; do
            stop_instance "$spec"
        done
        ;;
    status)
        echo "Mock Waldur instance status:"
        for spec in "${INSTANCES[@]}"; do
            status_instance "$spec"
        done
        ;;
    logs)
        tail -f "$LOGS_DIR"/waldur-*.log
        ;;
    *)
        echo "Usage: $0 {start|stop|status|logs}"
        echo
        echo "Instances:"
        echo "  waldur-csc     :9501  Federation A"
        echo "  waldur-geant   :9502  Federation A"
        echo "  waldur-desy    :9503  Federation B"
        echo "  waldur-surf    :9504  Federation A + B (dual)"
        exit 1
        ;;
esac

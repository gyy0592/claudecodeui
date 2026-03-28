#!/bin/bash
# start.sh — 启动 Claude Code UI (生产模式，全在 :3001)
# 用法: bash start.sh
# 或后台: bash start.sh --detach   (挂 tmux session "claudeui")

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION="claudeui"

# ── 加载 nvm（确保 node/npm 可用）──────────────────────────────────
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if ! command -v node &>/dev/null; then
    echo "[start.sh] ERROR: node not found. 请先加载 nvm。" >&2
    exit 1
fi

# ── 停掉旧实例 ────────────────────────────────────────────────────
OLD_PIDS=$(pgrep -u "$USER" -f "node server/index.js" 2>/dev/null || true)
if [ -n "$OLD_PIDS" ]; then
    echo "[start.sh] 停止旧实例 PID: $OLD_PIDS"
    kill $OLD_PIDS 2>/dev/null || true
    sleep 1
fi

# ── 安装依赖（node_modules 不存在时）────────────────────────────────
cd "$SCRIPT_DIR"
if [ ! -d "node_modules" ]; then
    echo "[start.sh] node_modules 不存在，执行 npm install ..."
    npm install
fi

# ── 构建前端（dist 不存在时）─────────────────────────────────────────
if [ ! -f "dist/index.html" ]; then
    echo "[start.sh] dist 不存在，执行 npm run build ..."
    npm run build
fi

# ── 启动 ─────────────────────────────────────────────────────────
if [ "${1:-}" = "--detach" ]; then
    # 后台模式：挂 tmux
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        echo "[start.sh] 杀掉旧 tmux session: $SESSION"
        tmux kill-session -t "$SESSION"
    fi
    tmux new-session -d -s "$SESSION" -c "$SCRIPT_DIR" "env -u CLAUDECODE npm run server"
    sleep 2
    PORT=$(grep -E "^SERVER_PORT=" .env 2>/dev/null | cut -d= -f2 || echo 3001)
    echo "[start.sh] 已在后台启动，tmux session: $SESSION"
    echo "[start.sh] 访问: http://$(hostname -I | awk '{print $1}'):${PORT}"
    echo "[start.sh] 查看日志: tmux attach -t $SESSION"
else
    # 前台模式
    PORT=$(grep -E "^SERVER_PORT=" .env 2>/dev/null | cut -d= -f2 || echo 3001)
    echo "[start.sh] 前台启动，访问: http://localhost:${PORT}"
    exec env -u CLAUDECODE npm run server
fi

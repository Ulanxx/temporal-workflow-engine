.PHONY: all install temporal api worker designer start-all stop-all

# 默认目标，运行所有服务
all: start-all

# 安装所有依赖
install:
	pnpm install

# 启动Temporal开发服务器
temporal:
	pnpm temporal:dev-server

# 启动API服务
api:
	pnpm start:api

# 启动Worker服务
worker:
	pnpm start:worker

# 启动前端设计器
designer:
	pnpm start:designer

# 一键启动所有服务（使用多个终端会话）
start-all:
	node scripts/dev-windows.mjs start

# 停止所有服务并关闭 make start-all 打开的终端窗口
stop-all:
	node scripts/dev-windows.mjs stop

# 帮助信息
help:
	@echo "Temporal Workflow Engine 启动命令帮助："
	@echo "make install     - 安装所有依赖"
	@echo "make temporal    - 仅启动Temporal开发服务器"
	@echo "make api         - 仅启动API服务，默认 http://localhost:4311"
	@echo "make worker      - 仅启动Worker服务"
	@echo "make designer    - 仅启动前端设计器，默认 http://localhost:3000"
	@echo "make start-all   - 一键启动所有服务（在不同终端窗口中）"
	@echo "make stop-all    - 停止所有服务并关闭 make start-all 打开的终端窗口"
	@echo "make help        - 显示此帮助信息"

# 问牍

导入文档，对着你的材料提问，答案带出处。当前阶段为**开源自托管 Web**：Embedding 内置本地模型，Chat 由你在管理页配置。

## 快速开始（本机开发）

### 1. 依赖

- PostgreSQL 16 + [pgvector](https://github.com/pgvector/pgvector)
- Python 3.12+
- Node.js 20+

### 2. 数据库

```bash
createdb wendu
# 确保已安装 pgvector 扩展（API 启动时会 CREATE EXTENSION）
```

### 3. API

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 必做：下载 Embedding 模型到 models/（约 500MB，已 gitignore，不提交 GitHub）
python scripts/fetch-embedding-model.py
python start.py
```

模型权重在 `apps/api/models/multilingual-e5-small/`。换机器或新 clone 后需再跑一次 `fetch-embedding-model.py`。自定义目录可设 `TEXT_EMBEDDING_LOCAL_PATH`。

### 4. Web

```bash
cd apps/web
npm install
npm run dev
```

浏览器打开 http://localhost:5173

### 5. 首次使用

1. 默认管理员：`admin` / `admin`（见 `apps/api/.env` 的 `ADMIN_USER` / `ADMIN_PASSWORD`）
2. 登录后进入 **管理 → 模型**，填写 **Chat 三项**：API Key、Base URL、对话模型
3. 回到工作台上传 PDF / Word / Markdown 等，等待「完成」后提问

## Docker Compose

```bash
cp apps/api/.env.example apps/api/.env
# 编辑 .env：改 SESSION_SECRET、ADMIN_PASSWORD
docker compose up --build
```

访问 http://localhost （web 反代 api）。Docker 构建时会预下载 Embedding 模型。

## 架构要点

| 组件 | 说明 |
|------|------|
| Embedding | 内置 `multilingual-e5-small`（384 维，E5 query/passage 前缀），本地推理 |
| Chat | OpenAI 兼容 API，管理页配置 |
| 检索 | pgvector + Postgres FTS，默认 top-8 |
| 存储 | 原文件本地磁盘；Postgres 存元数据与切片 |

**从旧版（云端 Embedding + 1024 维）迁移：** 删除全部已上传文件并重新上传，或清空 `chunks` 后重 ingest。

## 测试

```bash
# API 健康 + 主路径 UI（需 Vite + API + Postgres）
cd apps/web && npm run e2e

# 回答质量回归（仅需 API + Postgres + 已配 Chat）
cd apps/web && npm run e2e:quality
```

环境变量：`WENDU_ADMIN_USER` / `WENDU_ADMIN_PASSWORD` 覆盖管理员账号。

## 规格文档

见 [`docs/spec/`](docs/spec/00-索引.md)。桌面安装包等为**远期**规格，当前代码不实现。

## 环境变量（API）

| 变量 | 默认 | 说明 |
|------|------|------|
| `DATABASE_URL` | 见 `.env.example` | Postgres 连接 |
| `SESSION_SECRET` | — | Cookie 签名，生产必改 |
| `COOKIE_SECURE` | false | 生产 HTTPS 反代后设 true |
| `ADMIN_USER` / `ADMIN_PASSWORD` | admin / admin | 种子管理员 |
| `TEXT_EMBEDDING_LOCAL_PATH` | `apps/api/models/multilingual-e5-small` | 覆盖默认模型目录 |
| `VECTOR_MIN_SCORE` / `VECTOR_STRONG_SCORE` | 0.28 / 0.38 | 检索门槛 |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` / `RETRIEVE_K` | 500 / 80 / 8 | 分块与检索条数 |
| `FILES_DIR` | data/files | 原文件目录 |

## License

见仓库根目录 LICENSE（若有）。

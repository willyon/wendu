# 贡献指南 · 问牍

[English](CONTRIBUTING.md) | **中文**

感谢关注。本仓库当前目标是**好用的开源自托管 Web**；桌面安装包等规格里写的远期能力，默认不要在 PR 里实现，除非 Issue 明确说要做。

## 开发环境

按根目录 [README.zh.md](README.zh.md)（或英文 [README.md](README.md)）起 Postgres、API、Web，并下载本地 Embedding 模型。

自测：

```bash
# 主路径 UI 冒烟（需 Vite + API）
cd apps/web && npm run e2e

# 回答质量（需 API + 管理页已配好 Chat）
cd apps/web && npm run e2e:quality
```

## 改代码从哪读起

先读 [docs/implementation/底层实现逻辑.md](docs/implementation/底层实现逻辑.md) 对应章节（英文总览：[docs/README.md](docs/README.md)），再打开文件头注释（**英文**：模块职责 / 入口函数）。

| 你想改… | 先读文档 | 再看代码 |
|---------|----------|----------|
| 上传 / 分块 / 入库 | §3–4 | `ingest.py` · `routers_files.py` |
| 检索 / 能否回答 / 出处 | §5 | `rag.py` |
| 回答文风 / Prompt / Chat | §6 | `llm.py` |
| 本地向量模型 | §4.3 · §8 | `embed.py` · `config.py` |
| 管理页 Chat 配置 | — | `routers_admin.py` · `Admin.vue` |
| 前端提问与流式展示 | §5.1 · §7 | `useAskSession.js` · `AskPanel.vue` |
| 前端上传 UI | §3.1 | `FileSidebar.vue` · `Workspace.vue` |
| 表结构 | §2 | `models.py` |

核心 `.py` / 工作台 `.vue` 文件顶部有短导读；**不要**期待行行注释——非显然约定写在文件头或规格里。

## 改什么要先改规格

| 改动类型 | 做法 |
|----------|------|
| 用户能感知的行为、规则、API/表、文案承诺 | 先改 `docs/spec/` 对应文件，再改代码；在 `docs/spec/CHANGELOG.md` 记一行。若影响海外读者理解的产品边界，同 PR 更新 [docs/README.md](docs/README.md) |
| 内部重构、修 bug、与用户无关的实现细节 | 直接改代码，不必先改规格 |

规格入口：[docs/spec/00-索引.md](docs/spec/00-索引.md)。

## 提 PR 前请确认

1. 没有把 `.env`、API Key、真实密码提交进仓库  
2. 相关路径能跑通（至少本地手动点一遍，或跑上述 e2e）  
3. PR 说明里写清：**为什么改**、是否破坏性变更（例如须重传文件）

## 行为边界（勿在 PR 里「顺便承诺」）

- 每一问最多检索约 **8** 段材料进模型，**不承诺**一次总结全部上传文件或整份长文  
- Embedding 为**内置本地**；管理页只配 Chat（Key / Base URL / 对话模型）  
- 答案须能对应材料出处；材料里没有依据时应拒答，而不是用世界知识编造  

## 沟通

用 GitHub Issue 描述 bug 或需求即可。中文、英文均可。

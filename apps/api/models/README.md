# 本地 Embedding 模型

问牍依赖 `multilingual-e5-small`（384 维）。权重**不提交 GitHub**，克隆后在本目录执行：

```bash
cd apps/api
source .venv/bin/activate
python scripts/fetch-embedding-model.py
```

完成后会生成 `multilingual-e5-small/`。API 默认从该目录加载，启动时预加载。

# 回答质量测试材料

| 文件 | 来源 | 用途 |
|------|------|------|
| `album-*.md` / `album-optimize.txt` | 笑笑相册 `docs/` 摘录 | 真实长文档问答 |
| `planted-notes.txt` | 自建 | txt 植入事实 |
| `planted-brief.pdf/.docx/.pptx` | `generate_binary_fixtures.py` | 补齐相册 docs 没有的类型 |
| `planted-inventory.csv/.xlsx` | 同上 | 表格抽取与问答 |

重新生成二进制材料：

```bash
# 需已安装 apps/api 依赖（python-docx / pptx / openpyxl）
python3 generate_binary_fixtures.py
```

# OCR 搜索链路说明（当前实现）

## 行为摘要

- **召回**：对 `segment` **trim** 后按 **空白**（连续空格/制表等）切成多段；**每一段**分别对 **`media_search.ocr_text`** 做 **子串 LIKE**；各次命中按 **`media_id` 并集去重**（**任一段**在 OCR 中出现即纳入本次 OCR 结果）。
- **SQL**：每段一次 `LOWER(ms.ocr_text) LIKE ? ESCAPE '\\'`，参数为 **`%` + 该段转小写后对 `\`、`%`、`_` 转义 + `%`**。
- **英文**：**不区分大小写**（`LOWER`）。
- **无空白**：整句一段，等价于原来「整句一个 LIKE」。
- **`media_search` 无 `ocr_search_terms` 列**；**`media_search_terms` 仅含图片理解等字段，不含 OCR**。

## 与视觉搜索的边界

- OCR 只读 **`ocr_text`**。
- 一次搜索：**先对 `segment` 按空格拆段做 OCR LIKE（合并去重）**，再用 **`residual` 跑视觉**（FTS / 向量 / term），结果合并排序。

## 代码位置

| 环节 | 文件与符号 |
|------|------------|
| LIKE 参数 | `searchService.js` → `buildOcrTextLikePattern`、`applyOcrRecallForSegment` |
| 查询 | `searchModel.js` → `recallMediaIdsByOcrTextLike` |
| 打分 | `searchService.js` → `scoreOcrTextLikeHits` |
| 入库 | `mediaModel.js` → `rebuildMediaSearchDoc`（仅 `ocr_text` + 其它文案列；无 `ocr_search_terms`） |

## FTS（图片理解）

`media_search_fts` 为 **7 列**（无 `ocr_search_terms`）：description、keywords、subject、action、scene、transcript、caption。`searchModel.recallMediaIdsByFts` 中 **bm25** 权重与列顺序一致（7 个权重）。

## 调试

`scripts/tmp-scripts/debug-search-query.js` 会打印 OCR LIKE pattern 与命中行数。

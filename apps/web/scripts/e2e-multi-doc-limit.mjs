/**
 * 多文档总结 / 回答上限探测（API）
 * 材料：xiaoxiao-album/docs 中选若干 md
 * 运行：node scripts/e2e-multi-doc-limit.mjs
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = (process.env.WENDU_API || "http://127.0.0.1:8000").replace(/\/$/, "");
const DOCS = "/Volumes/Personal-Files/projects/xiaoxiao-album/docs";
const OUT = join(__dirname, "../.e2e-out");
mkdirSync(OUT, { recursive: true });

const adminUser = process.env.WENDU_ADMIN_USER || "admin";
const adminPassword = process.env.WENDU_ADMIN_PASSWORD || "admin";
const testUser = `md${Date.now()}`;
const password = "testpass1";

const FILES = [
  "产品商业化方案-免费试用与买断.md",
  "FTS全文检索链路说明.md",
  "OCR搜索链路说明.md",
  "搜索服务架构与数据流总览.md",
  "视觉文本向量搜索链路说明.md",
  "自然语言搜索理解层设计方案.md",
  "许可证系统-研发设计（简版）.md",
  "笑笑相册上线后功能迭代记录.md",
  "视频文件AI分析功能设计方案.md",
  "产品商业化-研发执行清单.md",
];

const CASES = [
  {
    name: "概括全部10份（开放问法）",
    question: "请总结我已上传的全部材料，分别讲什么主题？",
    fileIds: null,
  },
  {
    name: "能力问法-能答什么",
    question: "这些文档主要涵盖哪些方向？你能帮我查什么？",
    fileIds: null,
  },
  {
    name: "跨主题细问-商业化定价",
    question: "笑笑相册统一定价或买断方案是什么？",
    fileIds: null,
  },
  {
    name: "跨主题细问-搜索入口",
    question: "媒体搜索的 HTTP 入口路径是什么？",
    fileIds: null,
  },
  {
    name: "限定3份-商业化子集",
    question: "总结这几份商业化相关文档的核心要点",
    pick: ["产品商业化方案-免费试用与买断.md", "产品商业化-研发执行清单.md", "许可证系统-研发设计（简版）.md"],
  },
  {
    name: "限定5份-检索子集",
    question: "这几份搜索相关文档分别解决什么问题？",
    pick: [
      "FTS全文检索链路说明.md",
      "OCR搜索链路说明.md",
      "搜索服务架构与数据流总览.md",
      "视觉文本向量搜索链路说明.md",
      "自然语言搜索理解层设计方案.md",
    ],
  },
];

function makeClient() {
  let cookie = "";
  async function req(method, path, { json, body, headers = {} } = {}) {
    const h = { "X-Accept-Language": "zh", ...headers };
    if (cookie) h.Cookie = cookie;
    let payload = body;
    if (json !== undefined) {
      h["Content-Type"] = "application/json";
      payload = JSON.stringify(json);
    }
    const res = await fetch(`${API}${path}`, { method, headers: h, body: payload });
    for (const c of res.headers.getSetCookie?.() || []) {
      const part = c.split(";")[0];
      if (part.startsWith("wendu_session=")) cookie = part;
    }
    const raw = res.headers.get("set-cookie");
    if (raw?.includes("wendu_session=")) cookie = raw.split(";")[0];
    return res;
  }
  return { req };
}

async function login(client, email, pwd) {
  const res = await client.req("POST", "/api/auth/login", { json: { email, password: pwd } });
  if (!res.ok) throw new Error(`login: ${await res.text()}`);
}

async function uploadFile(client, filePath) {
  const buf = readFileSync(filePath);
  const filename = basename(filePath);
  const contentHash = createHash("sha256").update(buf).digest("hex");
  const prep = await client.req("POST", "/api/files/prepare", {
    json: { filename, byteSize: buf.length, contentHash, contentType: "application/octet-stream" },
  });
  const prepBody = await prep.json();
  if (!prep.ok) throw new Error(`prepare ${filename}: ${JSON.stringify(prepBody)}`);
  if (prepBody.type === "upload") {
    const put = await client.req("PUT", prepBody.credential.url, {
      body: buf,
      headers: prepBody.credential.headers || { "Content-Type": "application/octet-stream" },
    });
    if (!put.ok) throw new Error(`put ${filename}`);
    const done = await client.req("POST", "/api/files/complete", { json: { fileId: prepBody.file.id } });
    const doneBody = await done.json();
    if (!done.ok) throw new Error(`complete ${filename}`);
    return doneBody.file;
  }
  return prepBody.file;
}

async function waitReady(client, fileId, filename) {
  for (let i = 0; i < 90; i++) {
    const body = await (await client.req("GET", "/api/files")).json();
    const f = (body.files || []).find((x) => x.id === fileId);
    if (!f) throw new Error(`missing ${filename}`);
    if (f.status === "ready") return true;
    if (f.status === "failed") throw new Error(`failed ${filename}: ${f.failReason}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

function parseSse(text) {
  let done = null;
  let error = null;
  for (const block of text.split("\n\n")) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) continue;
    let obj;
    try {
      obj = JSON.parse(data);
    } catch {
      continue;
    }
    if (event === "done") done = obj;
    if (event === "error") error = obj;
  }
  return { done, error };
}

async function ask(client, conversationId, question, fileIds) {
  const res = await client.req("POST", "/api/ask", {
    json: { question, conversationId, fileIds },
    headers: { Accept: "text/event-stream" },
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`ask HTTP ${res.status}: ${raw.slice(0, 200)}`);
  const parsed = parseSse(raw);
  if (parsed.error) throw new Error(JSON.stringify(parsed.error));
  if (!parsed.done) throw new Error("no done");
  const d = parsed.done;
  const text = d.type === "answer" ? d.text || "" : d.message || "";
  return { type: d.type, text, citations: d.citations || [] };
}

function uniqFiles(cites) {
  return [...new Set((cites || []).map((c) => c.filename).filter(Boolean))];
}

async function main() {
  console.log(`API ${API}`);
  console.log(`docs ${DOCS}`);
  console.log(`上传 ${FILES.length} 份 md\n`);

  const admin = makeClient();
  await login(admin, adminUser, adminPassword);
  await admin.req("POST", "/api/admin/users", { json: { email: testUser, password } });

  const user = makeClient();
  await login(user, testUser, password);

  const fileIdByName = {};
  for (const name of FILES) {
    const path = join(DOCS, name);
    const f = await uploadFile(user, path);
    const ok = await waitReady(user, f.id, name);
    if (!ok) throw new Error(`timeout ${name}`);
    fileIdByName[name] = f.id;
    console.log(`就绪 ${name}`);
  }

  const conv = await (await user.req("POST", "/api/ask/conversations")).json();
  const report = [];

  for (const c of CASES) {
    const ids = c.pick ? c.pick.map((n) => fileIdByName[n]) : null;
    try {
      const ans = await ask(user, conv.id, c.question, ids);
      const citeFiles = uniqFiles(ans.citations);
      const row = {
        case: c.name,
        question: c.question,
        scopedFiles: c.pick?.length || FILES.length,
        type: ans.type,
        answerLen: ans.text.length,
        citationCount: ans.citations.length,
        citedFilenames: citeFiles,
        citedFileCount: citeFiles.length,
        preview: ans.text.replace(/\s+/g, " ").slice(0, 280),
      };
      report.push(row);
      console.log(`\n=== ${c.name} ===`);
      console.log(`类型: ${ans.type} | 回答 ${ans.text.length} 字 | 出处 ${ans.citations.length} 条 | 涉及文件 ${citeFiles.length} 个`);
      if (citeFiles.length) console.log(`出处文件: ${citeFiles.join("；")}`);
      console.log(`摘要: ${row.preview}`);
    } catch (e) {
      report.push({ case: c.name, error: String(e.message || e) });
      console.log(`\n=== ${c.name} === ERROR ${e.message}`);
    }
  }

  const outPath = join(OUT, "multi-doc-limit-report.json");
  writeFileSync(outPath, JSON.stringify({ testUser, fileCount: FILES.length, report }, null, 2));
  console.log(`\n报告 ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

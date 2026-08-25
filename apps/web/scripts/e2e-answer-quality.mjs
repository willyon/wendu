/**
 * 问牍 · 回答质量回归（API）
 *
 * 与 e2e-smoke 不同：不测 UI，专测「上传多类型材料 → 检索 → 生成」是否答对/拒答。
 * 材料：fixtures/answer-quality（笑笑相册 docs 摘录 + 自建 pdf/docx/pptx/csv/xlsx/txt）
 *
 * 前置：Postgres + API 已起（不必起 Vite）
 * 运行：npm run e2e:quality
 * 环境：WENDU_API（默认 http://127.0.0.1:8000）
 *       WENDU_ADMIN_USER / WENDU_ADMIN_PASSWORD
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = (process.env.WENDU_API || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const OUT = join(__dirname, "../.e2e-out");
const FIXTURES = join(__dirname, "fixtures/answer-quality");
mkdirSync(OUT, { recursive: true });

const adminUser = process.env.WENDU_ADMIN_USER || "admin";
const adminPassword = process.env.WENDU_ADMIN_PASSWORD || "123456";
const testUser = `aq${Date.now()}`;
const password = "testpass1";
const results = [];

function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, pass: false, detail });
  console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`);
}

/** Cookie jar（API 用 httponly session） */
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
    const res = await fetch(`${API}${path}`, {
      method,
      headers: h,
      body: payload,
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const part = c.split(";")[0];
      if (part.startsWith("wendu_session=")) cookie = part;
    }
    // Node <18 fallback: getSetCookie may缺，试 raw
    const raw = res.headers.get("set-cookie");
    if (raw && raw.includes("wendu_session=")) {
      cookie = raw.split(";")[0];
    }
    return res;
  }
  return { req };
}

async function login(client, email, pwd) {
  const res = await client.req("POST", "/api/auth/login", {
    json: { email, password: pwd },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(
      `login failed ${res.status}: ${t}\n提示：用 WENDU_ADMIN_USER / WENDU_ADMIN_PASSWORD 覆盖本机管理员账号`,
    );
  }
  return res.json();
}

async function uploadFile(client, filePath) {
  const buf = readFileSync(filePath);
  const filename = basename(filePath);
  const contentHash = createHash("sha256").update(buf).digest("hex");
  const prep = await client.req("POST", "/api/files/prepare", {
    json: {
      filename,
      byteSize: buf.length,
      contentHash,
      contentType: "application/octet-stream",
    },
  });
  const prepBody = await prep.json();
  if (!prep.ok)
    throw new Error(`prepare ${filename}: ${JSON.stringify(prepBody)}`);

  if (prepBody.type === "upload") {
    const url = prepBody.credential.url;
    const put = await client.req("PUT", url, {
      body: buf,
      headers: prepBody.credential.headers || {
        "Content-Type": "application/octet-stream",
      },
    });
    if (!put.ok) throw new Error(`put ${filename}: ${put.status}`);
    const done = await client.req("POST", "/api/files/complete", {
      json: { fileId: prepBody.file.id },
    });
    const doneBody = await done.json();
    if (!done.ok)
      throw new Error(`complete ${filename}: ${JSON.stringify(doneBody)}`);
    return doneBody.file;
  }
  return prepBody.file;
}

async function waitReady(client, fileId, filename, rounds = 60) {
  for (let i = 0; i < rounds; i++) {
    const res = await client.req("GET", "/api/files");
    const body = await res.json();
    const f = (body.files || []).find((x) => x.id === fileId);
    if (!f) throw new Error(`file missing: ${filename}`);
    if (f.status === "ready") return true;
    if (f.status === "failed") {
      throw new Error(
        `ingest failed ${filename}: ${f.failReason || f.failReasonMessage}`,
      );
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

function parseSse(text) {
  let answerText = "";
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
    if (event === "delta" && obj.text) answerText += obj.text;
    if (event === "done") done = obj;
    if (event === "error") error = obj;
  }
  return { answerText, done, error };
}

async function ask(client, conversationId, question, fileIds) {
  const res = await client.req("POST", "/api/ask", {
    json: { question, conversationId, fileIds },
    headers: { Accept: "text/event-stream" },
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`ask HTTP ${res.status}: ${raw.slice(0, 200)}`);
  const parsed = parseSse(raw);
  if (parsed.error)
    throw new Error(`ask error: ${JSON.stringify(parsed.error)}`);
  if (!parsed.done) throw new Error(`ask no done: ${raw.slice(0, 300)}`);
  const text =
    parsed.done.type === "answer"
      ? parsed.done.text || parsed.answerText
      : parsed.done.message || parsed.answerText || "";
  return { ...parsed.done, text };
}

/** 用例：expectType = answer | no_evidence；mustInclude 任一即可（OR）；mustIncludeAll 全要 */
const CASES = [
  {
    name: "商业化定价（md）",
    files: ["album-commerce.md"],
    question: "笑笑相册统一定价是多少？",
    expectType: "answer",
    mustInclude: ["198"],
    preferFilename: "album-commerce.md",
  },
  {
    name: "试用天数（md）",
    files: ["album-commerce.md"],
    question: "免费试用 Pro 多少天？",
    expectType: "answer",
    mustInclude: ["14"],
    preferFilename: "album-commerce.md",
  },
  {
    name: "OCR 召回字段（md）",
    files: ["album-ocr.md"],
    question: "OCR 搜索是对哪个字段做 LIKE 的？",
    expectType: "answer",
    mustInclude: ["ocr_text"],
    preferFilename: "album-ocr.md",
  },
  {
    name: "搜索入口路径（md）",
    files: ["album-search.md"],
    question: "媒体搜索的 HTTP 入口路径是什么？",
    expectType: "answer",
    mustInclude: ["/search/media"],
    preferFilename: "album-search.md",
  },
  {
    name: "纯文本植入工单（txt）",
    files: ["planted-notes.txt"],
    question: "问牍质检笔记里的唯一工单号是什么？值班人是谁？",
    expectType: "answer",
    mustIncludeAll: ["WENDU-TXT-NOTE-6610", "沈予安"],
    preferFilename: "planted-notes.txt",
  },
  {
    name: "PDF 植入编号",
    files: ["planted-brief.pdf"],
    question: "PDF 材料里的项目编号 WENDU-QA-PDF 后面是多少？负责人是谁？",
    expectType: "answer",
    mustInclude: ["9182", "LinQi"],
    preferFilename: "planted-brief.pdf",
  },
  {
    name: "Word 植入工单",
    files: ["planted-brief.docx"],
    question: "Word 材料里的唯一工单号是什么？审批人是谁？",
    expectType: "answer",
    mustIncludeAll: ["WENDU-DOCX-7741", "周晚"],
    preferFilename: "planted-brief.docx",
  },
  {
    name: "PPT 植入密语",
    files: ["planted-brief.pptx"],
    question: "演示密语是什么？讲者是谁？",
    expectType: "answer",
    mustIncludeAll: ["WENDU-PPTX-ALPHA-5520", "顾青禾"],
    preferFilename: "planted-brief.pptx",
  },
  {
    name: "CSV 库存 SKU",
    files: ["planted-inventory.csv"],
    question: "沧澜墨水的 SKU 和数量分别是什么？",
    expectType: "answer",
    mustIncludeAll: ["SKU-WENDU-CSV-3301", "42"],
    preferFilename: "planted-inventory.csv",
  },
  {
    name: "Excel 仓位",
    files: ["planted-inventory.xlsx"],
    question: "归档夹的仓位编号是什么？数量多少？",
    expectType: "answer",
    mustIncludeAll: ["A-17-WENDU-XLSX", "19"],
    preferFilename: "planted-inventory.xlsx",
  },
  {
    name: "材料无关应拒答",
    files: ["planted-notes.txt"],
    question: "火星上有几只企鹅？请直接给出数字。",
    expectType: "no_evidence",
  },
  {
    name: "跨文件但问不存在事实应拒答",
    files: ["album-commerce.md", "planted-brief.pdf"],
    question: "问牍官方在南极洲的办事处地址是哪里？",
    expectType: "no_evidence",
  },
];

async function main() {
  console.log(`API ${API}`);
  console.log(`fixtures ${FIXTURES}`);

  // 健康检查
  const health = await fetch(`${API}/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error("API 未就绪，请先启动：cd apps/api && python3 start.py");
    process.exit(1);
  }

  const admin = makeClient();
  await login(admin, adminUser, adminPassword);
  const create = await admin.req("POST", "/api/admin/users", {
    json: { email: testUser, password },
  });
  if (!create.ok && create.status !== 409) {
    fail("创建测试用户", await create.text());
    finish(1);
    return;
  }
  ok("创建测试用户", testUser);

  const user = makeClient();
  await login(user, testUser, password);
  ok("测试用户登录");

  // 上传全部需要的 fixture
  const needed = new Set(CASES.flatMap((c) => c.files));
  const onDisk = readdirSync(FIXTURES).filter((n) =>
    /\.(md|txt|pdf|docx|pptx|csv|xlsx)$/i.test(n),
  );
  const fileIdByName = {};

  for (const name of needed) {
    if (!onDisk.includes(name)) {
      fail(`缺材料 ${name}`, "请检查 fixtures/answer-quality");
      finish(1);
      return;
    }
    try {
      const f = await uploadFile(user, join(FIXTURES, name));
      const ready = await waitReady(user, f.id, name);
      if (!ready) {
        fail(`解析就绪 ${name}`, "timeout");
        finish(1);
        return;
      }
      fileIdByName[name] = f.id;
      ok(`上传并就绪 ${name}`, f.id.slice(0, 8));
    } catch (e) {
      fail(`上传 ${name}`, String(e.message || e));
      finish(1);
      return;
    }
  }

  const convRes = await user.req("POST", "/api/ask/conversations");
  const conv = await convRes.json();
  if (!convRes.ok || !conv.id) {
    fail("新建对话", JSON.stringify(conv));
    finish(1);
    return;
  }
  ok("新建对话", conv.id.slice(0, 8));

  for (const c of CASES) {
    const ids = c.files.map((n) => fileIdByName[n]);
    try {
      const ans = await ask(user, conv.id, c.question, ids);
      const type = ans.type;
      const text = ans.text || "";
      const cites = ans.citations || [];

      if (type !== c.expectType) {
        fail(
          c.name,
          `期望 ${c.expectType}，得到 ${type}；片段：${text.slice(0, 120)}`,
        );
        continue;
      }

      if (c.expectType === "no_evidence") {
        ok(c.name, "no_evidence");
        continue;
      }

      const lower = text;
      let miss = null;
      if (c.mustIncludeAll) {
        miss = c.mustIncludeAll.find((k) => !lower.includes(k));
      } else if (c.mustInclude) {
        if (!c.mustInclude.some((k) => lower.includes(k))) {
          miss = c.mustInclude.join("|");
        }
      }
      if (miss) {
        fail(c.name, `回答缺关键信息「${miss}」：${text.slice(0, 180)}`);
        continue;
      }

      if (c.preferFilename) {
        const hit = cites.some((x) =>
          (x.filename || "").includes(c.preferFilename),
        );
        if (!hit && cites.length === 0) {
          // 有答案但无出处：记 fail（规格要求可点回原文）
          fail(c.name, `有答案但无出处；文本：${text.slice(0, 120)}`);
          continue;
        }
        if (!hit) {
          fail(
            c.name,
            `出处未指向 ${c.preferFilename}，实际：${cites.map((x) => x.filename).join(",")}`,
          );
          continue;
        }
      }

      ok(c.name, text.replace(/\s+/g, " ").slice(0, 80));
    } catch (e) {
      fail(c.name, String(e.message || e));
    }
  }

  const failed = results.filter((r) => !r.pass).length;
  finish(failed ? 1 : 0);
}

function finish(code) {
  const report = {
    at: new Date().toISOString(),
    api: API,
    testUser,
    results,
    pass: results.filter((r) => r.pass).length,
    fail: results.filter((r) => !r.pass).length,
  };
  writeFileSync(
    join(OUT, "answer-quality-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    `\n报告 ${join(OUT, "answer-quality-report.json")}  PASS ${report.pass}  FAIL ${report.fail}`,
  );
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

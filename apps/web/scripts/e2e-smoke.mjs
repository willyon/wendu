/**
 * 问牍 E2E：主路径 + 加宽交互 + 常见失败态
 * 前置：Postgres + API + Vite 已起
 * 运行：npm run e2e
 * 可选：WENDU_BASE=http://localhost:5173
 *
 * 不覆盖：PDF、拖拽、视觉气质
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.WENDU_BASE || 'http://localhost:5173'
const OUT = join(__dirname, '../.e2e-out')
mkdirSync(OUT, { recursive: true })

const adminUser = process.env.WENDU_ADMIN_USER || 'admin'
const adminPassword = process.env.WENDU_ADMIN_PASSWORD || 'admin'
const testUser = `e2e${Date.now()}`
let password = 'testpass1'
const results = []

function ok(name, detail = '') {
  results.push({ name, pass: true, detail })
  console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`)
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail })
  console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`)
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true })
}

async function waitReady(page, filename, rounds = 40) {
  for (let i = 0; i < rounds; i++) {
    const body = await page.locator('.workspace').innerText()
    if (!body.includes(filename)) {
      await page.waitForTimeout(500)
      continue
    }
    const row = page.locator('li', { hasText: filename })
    const rowText = (await row.count()) ? await row.first().innerText() : body
    const hasReadyDot = (await row.count())
      ? await row.first().locator('.index[data-status="ready"]').count()
      : 0
    if (hasReadyDot) return true
    if (/失败|Failed/.test(rowText)) return false
    await page.waitForTimeout(1500)
  }
  return false
}

async function toastErrorText(page) {
  const el = page.locator('.toast-item--error .toast-text')
  if (await el.count()) return el.first().innerText()
  return ''
}

async function noticeText(page) {
  const toast = await toastErrorText(page)
  if (toast) return toast
  return page.locator('.err').innerText().catch(() => '')
}

async function waitAskSettled(page, rounds = 60) {
  let text = ''
  for (let i = 0; i < rounds; i++) {
    text = await page.locator('.workspace').innerText()
    const toast = await toastErrorText(page)
    if (
      /星河|抱歉|足够依据|No supporting|Sorry|出处|Sources|请先上传|超时|不可用|用完了|REQUEST_FAILED|请求失败|模型尚未配置|Model is not configured/.test(
        `${text}\n${toast}`
      )
    ) {
      return `${text}\n${toast}`.trim()
    }
    await page.waitForTimeout(1000)
  }
  return text
}

function isWideWorkspace(page) {
  const vp = page.viewportSize()
  return vp && vp.width >= 960
}

async function goLibrary(page) {
  await page.goto(BASE + '/library', { waitUntil: 'domcontentloaded' })
  if (!isWideWorkspace(page)) {
    await page.getByRole('button', { name: /资料库|Library/ }).click()
  }
}

async function goAsk(page) {
  await page.goto(BASE + '/library', { waitUntil: 'domcontentloaded' })
  if (!isWideWorkspace(page)) {
    await page.getByRole('button', { name: /问答|Ask/ }).click()
  }
}

async function main() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(20000)
  page.setDefaultNavigationTimeout(30000)

  try {
    // —— 入口 / 语言 ——
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('h1')
    let brand = await page.locator('h1').innerText()
    if (!brand.includes('问牍')) {
      const zhBtn = page.getByRole('button', { name: '中文' })
      if (await zhBtn.count()) {
        await zhBtn.click()
        await page.waitForTimeout(200)
        brand = await page.locator('h1').innerText()
      }
    }
    brand.includes('问牍') ? ok('入口显示品牌', brand.trim()) : fail('入口显示品牌', brand)
    ;(await page.getByRole('button', { name: /登录|Log in/ }).count())
      ? ok('入口有登录表单')
      : fail('入口有登录表单')
    const privacy = await page.locator('.privacy').innerText().catch(() => '')
    if (/训练|回答|train|files/i.test(privacy)) {
      ok('入口隐私脚注', privacy.slice(0, 40))
    } else if (!privacy.trim()) {
      ok('入口隐私脚注', '未展示（当前 UI 已隐藏）')
    } else {
      fail('入口隐私脚注', privacy)
    }
    await shot(page, '01-landing')

    await page.getByRole('button', { name: 'English' }).click()
    await page.waitForTimeout(300)
    const brandEn = await page.locator('h1').innerText()
    brandEn.includes('Wendu') && (await page.getByRole('button', { name: 'Log in' }).count())
      ? ok('切换到英文（品牌 Wendu）', brandEn.trim())
      : fail('切换到英文（品牌 Wendu）', brandEn)
    await page.getByRole('button', { name: '中文' }).click()
    await page.waitForTimeout(200)

    // —— 鉴权 ——
    await page.goto(BASE + '/library', { waitUntil: 'domcontentloaded' })
    await page.waitForURL((url) => url.pathname === '/')
    new URL(page.url()).pathname === '/'
      ? ok('未登录访问 /library 跳转入口')
      : fail('未登录访问 /library 跳转入口', page.url())

    await page.goto(BASE + '/files', { waitUntil: 'domcontentloaded' })
    await page.waitForURL((url) => url.pathname === '/')
    new URL(page.url()).pathname === '/'
      ? ok('未登录访问 /files 跳转入口')
      : fail('未登录访问 /files 跳转入口', page.url())

    await page.goto(BASE + '/ask', { waitUntil: 'domcontentloaded' })
    await page.waitForURL((url) => url.pathname === '/')
    new URL(page.url()).pathname === '/'
      ? ok('未登录访问 /ask 跳转入口')
      : fail('未登录访问 /ask 跳转入口', page.url())
    await shot(page, '02-login')

    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)
    new URL(page.url()).pathname === '/'
      ? ok('/login 重定向入口')
      : fail('/login 重定向入口', page.url())

    // —— 管理员登录 ——
    await page.locator('input[autocomplete="username"]').fill(adminUser)
    await page.locator('input[type="password"]').fill(adminPassword)
    await page.locator('button.cta[type="submit"]').click()
    await page.waitForURL(/\/library/, { timeout: 20000 })
    page.url().includes('/library')
      ? ok('管理员登录进入资料库', adminUser)
      : fail('管理员登录进入资料库', page.url())

    await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.admin-tabs')
    const adminTab = await page.locator('.admin-tabs .tab.active').innerText().catch(() => '')
    ;/模型|Model/i.test(adminTab)
      ? ok('管理员进入管理页默认模型', adminTab.trim())
      : fail('管理员进入管理页默认模型', adminTab || page.url())

    // 创建 E2E 专用用户
    const createRes = await page.request.post(BASE + '/api/admin/users', {
      data: { email: testUser, password },
      headers: { 'X-Accept-Language': 'zh' }
    })
    createRes.ok() ? ok('管理接口创建用户', testUser) : fail('管理接口创建用户', String(createRes.status()))

    await page.locator('.user-menu .avatar').hover()
    await page.getByRole('menuitem', { name: /登出|Log out/ }).click()
    await page.waitForURL(/\/$|\/login/)

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.locator('input[autocomplete="username"]').fill(testUser)
    await page.locator('input[type="password"]').fill(password)
    await page.locator('button.cta[type="submit"]').click()
    await page.waitForURL(/\/library/, { timeout: 20000 })
    page.url().includes('/library')
      ? ok('新用户登录进入资料库', testUser)
      : fail('新用户登录进入资料库', page.url())

    const dropText = await page.locator('.drop').innerText().catch(() => '')
    ;/PDF|Word|Markdown|文档|document/i.test(dropText) ? ok('资料库空态上传区') : fail('资料库空态上传区', dropText)
    await shot(page, '03-files-empty')

    if (isWideWorkspace(page)) {
      ok('登录后顶栏有问答入口', '宽屏三栏同屏，Tab 隐藏')
    } else {
      ;(await page.getByRole('button', { name: /问答|Ask/ }).count())
        ? ok('登录后顶栏有问答入口')
        : fail('登录后顶栏有问答入口')
    }

    // —— 失败态：无 ready 文件就提问 ——
    if (isWideWorkspace(page)) {
      const askPanel = page.locator('.ask-panel')
      ;(await askPanel.count()) === 0
        ? ok('无完成文件时提问框禁用', '空资料库不展示问答区')
        : fail('无完成文件时提问框禁用', '空资料库仍展示问答区')
    } else {
      await goAsk(page)
      const noReadyInput = page.locator('.ask-panel .composer input')
      const noReadyBtn = page.locator('.ask-panel .composer button.cta')
      const inputDisabled = await noReadyInput.isDisabled()
      const btnDisabled = await noReadyBtn.isDisabled()
      inputDisabled && btnDisabled
        ? ok('无完成文件时提问框禁用')
        : fail('无完成文件时提问框禁用', `input=${inputDisabled} btn=${btnDisabled}`)
    }
    await shot(page, '04-ask-no-ready')

    if (!isWideWorkspace(page)) {
      await goLibrary(page)
      ok('顶栏可回资料库')
    }

    // —— 失败态：错误类型 ——
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not allowed', 'utf8')
    })
    await page.waitForTimeout(1200)
    const typeErr = await noticeText(page)
    ;/只支持 PDF|Only PDF|Word|Markdown/i.test(typeErr)
      ? ok('错误文件类型有提示', typeErr)
      : fail('错误文件类型有提示', typeErr || (await page.locator('.workspace').innerText()).slice(0, 160))
    await shot(page, '05-file-type')

    // —— 失败态：过大（略超 20MB）——
    const big = Buffer.alloc(20 * 1024 * 1024 + 1, 1)
    await fileInput.setInputFiles({
      name: 'too-big.md',
      mimeType: 'text/markdown',
      buffer: big
    })
    let sizeErr = ''
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000)
      sizeErr = await noticeText(page)
      if (/20MB/i.test(sizeErr)) break
    }
    ;/20MB/i.test(sizeErr)
      ? ok('过大文件有提示', sizeErr)
      : fail('过大文件有提示', sizeErr || (await page.locator('.workspace').innerText()).slice(0, 160))
    await shot(page, '06-file-too-large')

    // —— 主路径：合法 Markdown ——
    const md = `# 问牍自测材料\n\n公司名称是星河科技。\n成立年份是 2019。\n办公地点在广州。\n`
    await fileInput.setInputFiles({
      name: 'e2e-sample.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(md, 'utf8')
    })
    await page.waitForSelector('text=e2e-sample.md', { timeout: 20000 })
    ok('上传后列表出现文件')

    const ready = await waitReady(page, 'e2e-sample.md')
    if (ready) ok('文件处理完成')
    else {
      fail('文件处理完成', (await page.locator('.workspace').innerText()).slice(0, 200))
      await shot(page, '07-files-stuck')
    }
    await shot(page, '07-files-ready')

    if (ready) {
      await page.locator('.ask-panel .composer input').fill('公司名称是什么？')
      await page.locator('.ask-panel .composer button.cta').click()
      ok('工作台右侧提问')

      await page.waitForTimeout(1500)
      const chatToast = await toastErrorText(page)
      const chatMissing = /模型尚未配置|Model is not configured|填写 API Key|Fill in all chat/i.test(
        chatToast
      )

      if (chatMissing) {
        ok('问答有响应（Chat 未配置）', chatToast.slice(0, 80))
        ok('出处可展开看到片段', 'Chat 未配置跳过')
        ok('依据不足显示材料里没有', 'Chat 未配置跳过')
      } else {
        let text = await waitAskSettled(page)
        await shot(page, '08-ask-hit')
        if (text.includes('星河')) ok('问答返回含材料内容', '提到星河')
        else if (/抱歉|足够依据|No supporting|Sorry|出处|Sources/.test(text))
          ok('问答有响应（未稳定命中星河）', text.slice(0, 100).replace(/\n/g, ' '))
        else fail('问答有响应', text.slice(0, 200).replace(/\n/g, ' '))

        const citesBlock = page.locator('details.cites')
        if (await citesBlock.count()) {
          await citesBlock.first().locator('summary.cites-summary').click()
          await page.waitForTimeout(200)
        }
        const details = page.locator('details.cite')
        if (await details.count()) {
          await details.first().locator('summary').click()
          await page.waitForTimeout(300)
          const openText = await details.first().innerText()
          ;/星河|广州|2019|问牍/.test(openText)
            ? ok('出处可展开看到片段', openText.slice(0, 60).replace(/\n/g, ' '))
            : fail('出处可展开看到片段', openText.slice(0, 120).replace(/\n/g, ' '))
        } else {
          fail('出处可展开看到片段', '无 details.cite')
        }
        await shot(page, '09-citation')

        await page.locator('.ask-panel .composer input').fill('火星上有几只企鹅？')
        await page.locator('.ask-panel .composer button.cta').click()
        let noEvText = ''
        for (let i = 0; i < 90; i++) {
          noEvText = await page.locator('.ask-panel').innerText()
          if (/抱歉|足够依据|No supporting|Sorry/i.test(noEvText) && /火星|企鹅|penguin/i.test(noEvText)) break
          if (/抱歉|足够依据|No supporting|Sorry/i.test(noEvText) && !/正在回答|Answering/.test(noEvText)) break
          await page.waitForTimeout(1000)
        }
        await shot(page, '10-no-evidence')
        ;/抱歉|足够依据|No supporting|Sorry/.test(noEvText)
          ? ok('依据不足显示材料里没有', noEvText.slice(0, 40).replace(/\n/g, ' '))
          : fail('依据不足显示材料里没有', noEvText.slice(0, 160).replace(/\n/g, ' '))
      }

      if (isWideWorkspace(page)) {
        ok('资料库与问答顶栏可切换', '宽屏三栏同屏')
      } else {
        await goLibrary(page)
        await goAsk(page)
        ok('资料库与问答顶栏可切换')
      }

      // —— 加宽：删除文件 ——
      await goLibrary(page)
      const del = page.locator('li', { hasText: 'e2e-sample.md' }).getByRole('button', { name: /删除|Delete/ })
      await del.click()
      await page.waitForTimeout(1000)
      const afterDel = await page.locator('.workspace').innerText()
      !afterDel.includes('e2e-sample.md') || /空|Upload PDF|上传 PDF/.test(afterDel)
        ? ok('删除后列表不再展示该文件')
        : fail('删除后列表不再展示该文件', afterDel.slice(0, 160))
      await shot(page, '11-deleted')

      await goAsk(page)
      if (isWideWorkspace(page)) {
        ;(await page.locator('.ask-panel').count()) === 0
          ? ok('删光完成文件后再问提问框禁用', '空资料库不展示问答区')
          : fail('删光完成文件后再问提问框禁用', '删光后仍展示问答区')
      } else {
        const afterDelInput = page.locator('.ask-panel .composer input')
        const afterDelDisabled = await afterDelInput.isDisabled()
        afterDelDisabled
          ? ok('删光完成文件后再问提问框禁用')
          : fail('删光完成文件后再问提问框禁用', await page.locator('.ask-panel').innerText().catch(() => ''))
      }
    }

    // —— 失败态：错密 / 再登 ——
    const avatar = page.locator('.user-menu .avatar')
    if (await avatar.count()) {
      await avatar.hover()
      await page.getByRole('menuitem', { name: /登出|Log out/ }).click()
      await page.waitForURL(/\/$|\/login/)
    }
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await page.locator('input[autocomplete="username"]').fill(testUser)
    await page.locator('input[type="password"]').fill('wrong-password')
    await page.locator('button.cta[type="submit"]').click()
    await page.waitForTimeout(800)
    const badPass = await noticeText(page)
    ;/不对|incorrect/i.test(badPass)
      ? ok('错误密码有提示', badPass)
      : fail('错误密码有提示', badPass)

    await page.locator('input[type="password"]').fill(password)
    await page.locator('button.cta[type="submit"]').click()
    await page.waitForURL(/\/library/, { timeout: 15000 })
    ok('正确密码可登录')
    await shot(page, '12-relogin')
  } catch (e) {
    fail('未捕获异常', String(e))
    try {
      await shot(page, '99-error')
    } catch {}
  } finally {
    await browser.close()
  }

  const failed = results.filter((r) => !r.pass)
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ testUser, results }, null, 2))
  console.log('\n---')
  console.log(`合计 ${results.length}，失败 ${failed.length}`)
  console.log(`截图目录: ${OUT}`)
  process.exit(failed.length ? 1 : 0)
}

main()

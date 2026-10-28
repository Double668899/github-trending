#!/usr/bin/env node
// github-trending 输出校验器 —— 把「只输出 HTML」和「五列齐全」这两条最容易翻车的软约束变成可执行检查。
//
// 它不联网、不抓取、不校验数据真实性（数据必须来自 MCP，校验器无法证明这一点）。
// 它只检查产物形态：是不是一份裸的完整 HTML、有没有 markdown 围栏、表格五列是否齐、
// 链接是否可点、周期是否标注、错误页有没有按规定给出提示文案。
//
// 用法:
//   node scripts/validate.mjs <file.html> [--period daily|weekly|monthly] [--expect-rows N]
//   node scripts/validate.mjs --stdin [--period ...] [--expect-rows N]
//   node scripts/validate.mjs --selftest
//
// 零依赖，只用 Node.js 内置模块（Node 18+）。

import fs from 'node:fs';

const PERIODS = ['daily', 'weekly', 'monthly'];
const ERROR_KEY = 'MCP服务调用失败';
const ERROR_GUIDE = '请检查 github-trending MCP Server 是否正常启动，确认MCP配置后重试';
const REQUIRED_COLUMNS = [
  ['name', '仓库名称'],
  ['delta', 'Star 增量'],
  ['total', '总 Star 数量'],
  ['desc', '仓库简介'],
  ['link', '仓库链接'],
];

const stripTags = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

// 去掉所有空白，用于容错地比对中文文案
const squash = (s) => String(s).replace(/\s+/g, '');

// 表头语义归类：按语义而不是按字面顺序，顺序上先排除更具体的词
function classifyHeader(text) {
  const t = text.trim();
  if (!t) return null;
  if (/链接|地址|link|url/i.test(t)) return 'link';
  if (/简介|描述|description/i.test(t)) return 'desc';
  if (/增量|新增|日增|周增|月增|today|this\s*week|this\s*month|period|new\s*stars?/i.test(t)) return 'delta';
  if (/总|累计|total/i.test(t)) return 'total';
  if (/^stars?$/i.test(t)) return 'total';
  if (/仓库名称|项目名称|repository|repo\b|仓库/i.test(t)) return 'name';
  return null;
}

function checkHtml(html, opts = {}) {
  const issues = [];
  const warns = [];

  if (!html || !html.trim()) {
    issues.push('产物是空的');
    return { issues, warns, rows: 0, isErrorPage: false };
  }

  const flat = squash(html);
  const isErrorPage = flat.includes(squash(ERROR_KEY));

  // 1. 文档骨架
  if (!/<!DOCTYPE\s+html>/i.test(html)) issues.push('缺少 <!DOCTYPE html>');
  if (!/<html\b/i.test(html)) issues.push('缺少 <html> 开标签');
  if (!/<\/html\s*>/i.test(html)) issues.push('缺少 </html> 闭标签');

  // 2. 不得夹带 markdown
  if (html.includes('```')) issues.push('包含 ``` 围栏 —— 输出必须是裸 HTML');

  // 3. </html> 之后不得有正文
  const closeIdx = html.toLowerCase().lastIndexOf('</html');
  if (closeIdx >= 0) {
    const tail = html.slice(closeIdx).replace(/<\/html\s*>/i, '');
    if (tail.trim()) issues.push('</html> 之后还有多余内容：' + JSON.stringify(tail.trim().slice(0, 60)));
  }

  // 4. 标题必须标注 GitHub Trending 与周期
  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '');
  if (!title) {
    issues.push('缺少 <title>');
  } else {
    if (!/github\s*trending/i.test(title)) issues.push('标题未标注 GitHub Trending：' + title);
    if (opts.period) {
      if (!new RegExp(opts.period, 'i').test(title)) {
        issues.push(`标题未标注当前周期 ${opts.period}：${title}`);
      }
    } else if (!PERIODS.some((p) => new RegExp(p, 'i').test(title))) {
      issues.push('标题未标注周期（daily / weekly / monthly 之一）：' + title);
    }
  }

  // 5. 自包含
  if (!/<style[\s>]/i.test(html)) issues.push('缺少内联 <style>（页面必须自包含）');
  if (/<link[^>]+rel=["']?stylesheet/i.test(html)) warns.push('引用了外部样式表，页面不自包含');
  if (/<script[^>]+src=/i.test(html)) warns.push('引用了外部脚本，页面不自包含');

  // 6. 错误页 / 榜单页分支
  let rows = 0;
  if (isErrorPage) {
    if (!flat.includes(squash(ERROR_GUIDE))) {
      issues.push('错误页缺少规定的提示文案：' + ERROR_GUIDE);
    }
    if (/<table[\s>]/i.test(html)) issues.push('错误页不应包含表格（会让人误以为榜单为空）');
  } else {
    const table = /<table[\s\S]*?<\/table>/i.exec(html)?.[0];
    if (!table) {
      issues.push('没有找到 <table>');
    } else {
      const ths = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => stripTags(m[1]));
      if (!ths.length) {
        issues.push('表格没有 <th> 表头');
      } else {
        const cats = ths.map(classifyHeader);
        const found = new Set(cats.filter(Boolean));
        for (const [key, label] of REQUIRED_COLUMNS) {
          if (!found.has(key)) issues.push(`表头缺少「${label}」列（当前表头：${ths.join(' / ')}）`);
        }
        const dupes = [...new Set(cats.filter((c, i) => c && cats.indexOf(c) !== i))];
        if (dupes.length) issues.push('表头语义重复：' + dupes.join(', '));
      }
    }

    const tbody = /<tbody[\s\S]*?<\/tbody>/i.exec(html)?.[0];
    if (!tbody && /<table[\s\S]*?<\/table>/i.test(html)) {
      issues.push('表格缺少 <tbody>');
    } else if (tbody) {
      rows = [...tbody.matchAll(/<tr\b/gi)].length;
      if (opts.expectRows != null && rows !== opts.expectRows) {
        issues.push(`条目数不符：期望 ${opts.expectRows}，实际 ${rows}`);
      }
    }
  }

  // 7. 链接
  const hrefs = [...html.matchAll(/<a\b[^>]*href=["']([^"']*)["']/gi)].map((m) => m[1]);
  if (!isErrorPage && !hrefs.length) issues.push('没有任何 <a href> 链接');
  for (const h of hrefs) {
    if (!/^https?:\/\//i.test(h)) issues.push('链接缺少 http(s) 协议：' + h);
  }
  if (!isErrorPage && hrefs.length && !hrefs.some((h) => /github\.com/i.test(h))) {
    warns.push('没有任何指向 github.com 的链接');
  }

  // 8. markdown 表格残留
  if (/^\s*\|?[\s:-]*-{3,}/m.test(html)) warns.push('疑似 markdown 表格残留');

  // 9. 字段映射失败的填充物
  const bad = html.match(/\b(undefined|NaN|\[object Object\])\b/g);
  if (bad) issues.push('页面出现 ' + [...new Set(bad)].join(', ') + ' —— 字段映射写错了');

  return { issues, warns, rows, isErrorPage };
}

// ---------------- 自检 ----------------

function buildSample(period = 'daily', rowCount = 2) {
  const rows = Array.from({ length: rowCount }, (_, i) => `
        <tr>
          <td>owner/repo-${i + 1}</td>
          <td class="num delta">+${100 + i}</td>
          <td class="num">${4000 + i}</td>
          <td class="desc">来自 MCP 返回的简介原文 ${i + 1}</td>
          <td><a href="https://github.com/owner/repo-${i + 1}" target="_blank" rel="noopener">github.com/owner/repo-${i + 1}</a></td>
        </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>GitHub Trending - ${period}</title>
<style>body{background:#0d1117;color:#e6edf3}</style>
</head>
<body>
<div class="wrap">
  <h1>GitHub Trending - ${period}</h1>
  <p class="meta">周期：${period} · 数据来源：github_trending MCP · 共 ${rowCount} 个仓库</p>
  <table>
    <thead><tr><th>仓库名称</th><th>Star 增量</th><th>总 Star 数量</th><th>仓库简介</th><th>仓库链接</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>
</div>
</body>
</html>`;
}

function buildErrorPage(period = 'daily') {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>GitHub Trending - ${period}</title>
<style>body{background:#0d1117;color:#e6edf3}</style>
</head>
<body>
  <div class="card">
    <h1>MCP服务调用失败</h1>
    <p>${ERROR_GUIDE}</p>
    <p>周期：${period}</p>
  </div>
</body>
</html>`;
}

function selftest() {
  const cases = [];
  const add = (name, html, opts, shouldFail) => cases.push({ name, html, opts, shouldFail });

  add('合规榜单页', buildSample(), {}, false);
  add('合规错误页', buildErrorPage(), { period: 'daily' }, false);
  add('夹带 markdown 围栏', '```html\n' + buildSample() + '\n```', {}, true);
  add('html 之后有中文说明', buildSample() + '\n以下是本周榜单：', {}, true);
  add('缺 DOCTYPE', buildSample().replace('<!DOCTYPE html>', ''), {}, true);
  add('缺 </html>', buildSample().replace('</html>', ''), {}, true);
  add('标题没写周期', buildSample().replace(/- daily/g, ''), {}, true);
  add('标题周期与本次不符', buildSample('daily'), { period: 'weekly' }, true);
  add('少一列（无链接列）', buildSample().replace('<th>仓库链接</th>', ''), {}, true);
  add('列名换成别的语义', buildSample().replace('<th>总 Star 数量</th>', '<th>收藏数</th>'), {}, true);
  add('缺整个表格', buildSample().replace(/<table[\s\S]*?<\/table>/, ''), {}, true);
  add('链接没协议', buildSample().replace('https://github.com/owner/repo-1', 'github.com/owner/repo-1'), {}, true);
  add('条目数不符', buildSample(), { expectRows: 5 }, true);
  add('填充了 undefined', buildSample().replace('来自 MCP 返回的简介原文 1', 'undefined'), {}, true);
  add('错误页缺提示文案', buildErrorPage().replace(ERROR_GUIDE, '出错了'), {}, true);
  add('错误页带空表格', buildErrorPage().replace('<body>', '<body><table></table>'), {}, true);
  add('空产物', '', {}, true);

  let failed = 0;
  for (const c of cases) {
    const { issues } = checkHtml(c.html, c.opts);
    const bad = issues.length > 0;
    const pass = bad === c.shouldFail;
    if (!pass) failed++;
    console.log(
      (pass ? '[OK]   ' : '[FAIL] ') +
        c.name +
        (pass ? '' : `  —— 期望${c.shouldFail ? '报错' : '通过'}，实际${bad ? '报错' : '通过'}`) +
        (bad ? ' :: ' + issues.join(' | ') : '')
    );
  }
  console.log('');
  console.log(failed === 0 ? `✓ 自检通过（${cases.length} 例）` : `✗ 自检失败（${failed}/${cases.length} 例）`);
  process.exit(failed === 0 ? 0 : 1);
}

// ---------------- CLI ----------------

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const argv = process.argv.slice(2);
  let file = null;
  let useStdin = false;
  let period = null;
  let expectRows = null;
  let doSelftest = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--selftest') doSelftest = true;
    else if (a === '--stdin') useStdin = true;
    else if (a === '--period') period = argv[++i];
    else if (a.startsWith('--period=')) period = a.slice('--period='.length);
    else if (a === '--expect-rows') expectRows = parseInt(argv[++i], 10);
    else if (a.startsWith('--expect-rows=')) expectRows = parseInt(a.slice('--expect-rows='.length), 10);
    else if (a.startsWith('-')) {
      console.error('未知参数：' + a);
      console.error('用法: node scripts/validate.mjs <file.html> [--period daily|weekly|monthly] [--expect-rows N]');
      process.exit(2);
    } else file = a;
  }

  if (doSelftest) return selftest();

  if (period && !PERIODS.includes(period)) {
    console.error(`--period 只能是 ${PERIODS.join(' / ')}，收到：${period}`);
    process.exit(2);
  }
  if (expectRows != null && !Number.isFinite(expectRows)) {
    console.error('--expect-rows 必须是数字');
    process.exit(2);
  }
  if (!useStdin && !file) {
    console.error('用法: node scripts/validate.mjs <file.html> [--period ...] [--expect-rows N]');
    console.error('      node scripts/validate.mjs --stdin [--period ...]');
    console.error('      node scripts/validate.mjs --selftest');
    process.exit(2);
  }

  let html;
  if (useStdin) {
    html = readStdin();
  } else {
    if (!fs.existsSync(file)) {
      console.error('文件不存在：' + file);
      process.exit(2);
    }
    html = fs.readFileSync(file, 'utf8');
  }
  if (html.charCodeAt(0) === 0xfeff) html = html.slice(1);

  const { issues, warns, rows, isErrorPage } = checkHtml(html, { period, expectRows });

  console.log('校验：' + (useStdin ? '<stdin>' : file));
  console.log('');
  for (const w of warns) console.error('[WARN] ' + w);
  for (const i of issues) console.error('[FAIL] ' + i);
  if (!issues.length) {
    console.log('[OK]   产物形态合规' + (isErrorPage ? '（错误页）' : `（${rows} 条目）`));
    console.log('');
    console.log('✓ 全部检查通过');
    process.exit(0);
  }
  console.error('');
  console.error(`✗ ${issues.length} 项不合规`);
  process.exit(1);
}

main();

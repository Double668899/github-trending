# 输出模板

页面**必须**自包含：内联 CSS、无外部资源、浏览器直接打开即用。
下面是骨架与样式基调，DOM 层级和 CSS 方案可以自己调整，但**表格五列与标题周期标注不能变**。

## 榜单页骨架

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHub Trending - daily</title>
<style>
  /* 内联样式，无外部依赖 */
  :root { color-scheme: light dark; }
  body { margin:0; padding:32px 20px; background:#0d1117; color:#e6edf3;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",
                     "Microsoft YaHei",sans-serif; }
  .wrap { max-width:1100px; margin:0 auto; }
  h1 { margin:0 0 6px; font-size:26px; letter-spacing:.5px; }
  .meta { color:#8b949e; font-size:13px; margin-bottom:22px; }
  .table-wrap { overflow-x:auto; border:1px solid #30363d; border-radius:10px; }
  /* fixed 布局：让 colgroup 的列宽真的生效，auto 布局下长 URL 会把简介列挤没 */
  table { width:100%; min-width:840px; table-layout:fixed; border-collapse:collapse;
          background:#161b22; }
  th, td { padding:12px 14px; text-align:left; border-bottom:1px solid #21262d;
           font-size:14px; vertical-align:top; overflow-wrap:anywhere; }
  /* 表头不折行：真实数据下 "Star 增量" 会被挤成两行 */
  th { background:#1c2128; color:#8b949e; font-weight:600; font-size:12px;
       letter-spacing:.3px; white-space:nowrap; }
  tr:last-child td { border-bottom:none; }
  td.num { font-variant-numeric:tabular-nums; white-space:nowrap; }
  .delta { color:#3fb950; font-weight:600; }
  a { color:#58a6ff; text-decoration:none; }
  a:hover { text-decoration:underline; }
  .desc { color:#8b949e; }
</style>
</head>
<body>
<div class="wrap">
  <h1>GitHub Trending - daily</h1>
  <p class="meta">周期：daily · 数据来源：github_trending MCP · 共 N 个仓库</p>
  <div class="table-wrap">
  <table>
    <colgroup>
      <col style="width:23%"><col style="width:11%"><col style="width:13%">
      <col style="width:34%"><col style="width:19%">
    </colgroup>
    <thead>
      <tr>
        <th>仓库名称</th>
        <th>Star 增量</th>
        <th>总 Star 数量</th>
        <th>仓库简介</th>
        <th>仓库链接</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>owner/repo</td>
        <td class="num delta">+128</td>
        <td class="num">4,210</td>
        <td class="desc">来自 MCP 返回的简介原文</td>
        <td><a href="https://github.com/owner/repo" target="_blank" rel="noopener">github.com/owner/repo</a></td>
      </tr>
    </tbody>
  </table>
  </div>
</div>
</body>
</html>
```

替换点只有四处：`<title>` 的周期、`.meta` 里的周期与条数、`<tbody>` 里的真实条目。

## 错误页骨架

MCP 调用失败时输出这个（**不要**留空表格）：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHub Trending - daily</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center;
         justify-content:center; background:#0d1117; color:#e6edf3;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",
                     "Microsoft YaHei",sans-serif; }
  .card { max-width:560px; padding:32px; background:#161b22; border:1px solid #30363d;
          border-left:4px solid #f85149; border-radius:10px; }
  h1 { margin:0 0 10px; font-size:20px; }
  p { margin:0 0 8px; color:#8b949e; font-size:14px; line-height:1.7; }
  code { background:#21262d; padding:2px 6px; border-radius:4px; color:#e6edf3; }
</style>
</head>
<body>
  <div class="card">
    <h1>MCP服务调用失败</h1>
    <p>MCP服务调用失败，请检查 github-trending MCP Server 是否正常启动，确认MCP配置后重试。</p>
    <p>周期：daily · 工具：<code>github_trending</code></p>
  </div>
</body>
</html>
```

## 常见违规反例

| 违规 | 后果 |
|---|---|
| HTML 前面加"以下是本周 GitHub Trending 榜单：" | 破坏「只输出 HTML」，复制保存后页面里多一段话 |
| 用 ```html 围栏包住 | 同上，且复制出来带围栏 |
| 输出 Markdown 表格 | 违反输出形态，用户拿不到网页 |
| 表头写成「名称 / 新增 / 总数 / 描述 / 地址」 | 语义对但校验器按五列名定位，改用标准列头 |
| 增量列填总 Star | 数据系统性错误，用户无法察觉 |
| MCP 没返回也照着旧榜单写满表格 | 编造数据——本 skill 最严重的违规 |
| 错误页留一个空 `<table>` | 用户会以为"今天榜单是空的"，而不是"调用失败了" |
| `<a href>` 写成 `github.com/owner/repo`（无协议） | 链接不可点 |

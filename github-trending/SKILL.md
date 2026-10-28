---
name: github-trending
description: |
  GitHub Trending 上升项目查询助手，绑定 MCP 工具 github_trending（server 名 github-trending）。
  固定三步：先确定周期（用户没给就问，绝不替用户猜）→ 调用 github_trending 取真实榜单 →
  只输出一份自包含 HTML 榜单（表格五列：仓库名称 / Star 增量 / 总 Star 数量 / 仓库简介 / 仓库链接）。
  Use this skill when the user asks for GitHub Trending、GitHub 趋势榜、GitHub 热门开源项目、
  本周涨星最快的项目、GitHub 上升榜, or wants the GitHub trending leaderboard rendered as an HTML page.
  Triggers on phrases like "GitHub Trending"、"GitHub 趋势"、"GitHub 热门项目"、"GitHub 涨星榜"、
  "最近哪些 GitHub 项目火了"、"查一下 GitHub 周榜"、"GitHub 上有什么新项目在涨"。
  Do NOT use for: 查某一个具体仓库的详情、GitHub 代码搜索或按关键词找仓库、
  与 Trending 无关的 star 数/贡献者统计、或用户明确说只要一个链接不要榜单表格。
---

# GitHub Trending

本 skill 只做一件事：**按固定流程取 GitHub Trending 榜单，产出一份纯 HTML 榜单页。**

| 职责 | 归属 |
|---|---|
| 问周期、调 MCP、排 HTML | 本 skill |
| MCP 怎么连、工具怎么发现、HTML 具体长相 | 宿主 agent |

前置依赖：宿主必须已配置名为 `github-trending` 的 MCP Server，其中提供工具 `github_trending`。
没配置或连不上 → 走「异常处理」输出错误页，**不要**退化成自己抓网页，更不要凭空编榜单。

| 项 | 说明 |
|---|---|
| 工具名 | `github_trending` |
| 周期入参名 | **按工具 schema 里的真实名字**（实测公开包 `github-trending-mcp` 是 `range`；有的 server 是 `period`） |
| 周期取值 | `daily` / `weekly` / `monthly` |
| 语言入参 | 实测有 `language`，可选 |

## 步骤 1 先确定周期

用户表达了要查 GitHub Trending 上升项目时，第一件事是**确定周期**——不要直接调工具，也不要替用户默认 daily。

**1a. 用户请求里已经写了周期**（「今天」「今日」「daily」「本周」「weekly」「这周」「本月」「monthly」）——
那就是用户的答案：归一化后直接用掉，**不要重复问一遍**。重复提问是骚扰，不是严谨。

**1b. 用户请求里没写周期** → 必须问。用宿主的结构化提问能力（Mavis 里是 `ask_user`）：

> 请问你想要查询哪个周期的 GitHub Trending？可选：daily（每日）、weekly（每周）、monthly（每月）
> 是否需要限定编程语言？（可选）

- 周期**必答**；语言**可选**，用户不答就用全语言。
- 宿主没有结构化提问能力时，用一句普通问句等回复——**绝不能自己选一个继续**。
- 为什么必须问：daily / weekly / monthly 的「Star 增量」含义完全不同（今日新增 / 本周新增 / 本月新增）。
  猜错会让整张表第二列变成系统性错误，而用户多半不会去逐行核对。

## 步骤 2 校验周期并调用 MCP

拿到用户回答后：

1. **归一化**：转小写、去空格与首尾标点；`每日/daily/天/今天`→`daily`，`每周/weekly/周/本周`→`weekly`，`每月/monthly/月/本月`→`monthly`。
2. **校验**结果必须落在 `daily` / `weekly` / `monthly` 三者之一。
   - 不在其中 → **重新问一次**让用户重新选，不要擅自映射（例如把"最近"当成 weekly）。
   - 用户始终没选 → 保持待回答状态等用户，不要自己定。
3. **调用** MCP 工具 `github_trending`，把周期传进去。工具名照抄，入参名**按工具 schema 里的真实名字**
   （实测公开包 `github-trending-mcp` 用的是 `range`；有的 server 叫 `period`）——**不要臆造参数名**。
4. **核对回显**：返回里通常有一个字段回显**实际生效**的周期（实测是 `range`）。
   它必须等于你请求的周期；**不等就是没传进去**，按「异常处理」重试，不要把错误周期的数据交出去。
   > ⚠️ 这是最阴的一类错误：入参名写错**不会报错**，服务器会静默用默认值（`daily`），
   > 然后你交出一份周期完全不对、但看起来毫无破绽的榜单。

调用方式随宿主而变：
- MCP 工具已作为原生工具注入当前会话 → 直接调用。
- 需要发现（Mavis：先 `tool_search` 搜 `github_trending` 拿到确切 tool_name 与入参 schema，再用 `mcp_invoke` 传 arguments）→ 按拿到的 schema 传参，不要臆造参数名。
- 宿主既没注入、也没提供发现通道时 → 走「异常处理」输出错误页。**不要**改用自己抓网页顶替。

**可选的补救路径**：宿主已经有 MCP 客户端（例如 `mcporter`）时，可以用它以 ad-hoc stdio 的方式
拉起公开包 `github-trending-mcp`，调用**同一个工具名** `github_trending`。
这是**真调用真工具**，不是编数据；而且它拿到的字段结构（`full_name` / `stargazers_add` /
`stargazers_count` / `newRepositories` / `seenRepositories`）和宿主自带的 server 是同一套。

> ⚠️ 它会往临时目录装 npm 包，属于对用户机器的改动——**先问用户能不能装**。
> 用户不答或不允许 → 直接走「异常处理」输出错误页，别自作主张。

如果走的是这条路径，在页面的 meta 行里注明「经由 `github-trending-mcp` 本地拉起调用」，
让用户知道数据是哪儿来的。

语言过滤（可选）：用户点名语言时，先看工具 schema 里有没有对应入参（实测有 `language`）；
有才传；没有就**不要臆造参数**，改为在页面顶部注明「本次未按语言过滤」。

## 步骤 3 产出 HTML

先读 [`references/field-mapping.md`](references/field-mapping.md) 把 MCP 返回映射成五个字段，
再按 [`references/output-template.md`](references/output-template.md) 出页面。

**硬约束（每一条用户都直接看得见）**

1. 回复内容是**一整份 HTML**：从 `<!DOCTYPE html>` 开始，到 `</html>` 结束。
   HTML 前后不加中文说明、不加解释、不加 ``` 围栏、不加"以下是"这类引导语。
2. 页面**自包含**：CSS 内联在 `<style>` 里；不引外部样式表、不引 CDN、不引外部字体。
3. 表格固定五列：**仓库名称 / Star 增量 / 总 Star 数量 / 仓库简介 / 仓库链接**。
4. 仓库链接用 `<a href="https://github.com/...">`，可点击，带 `target="_blank" rel="noopener"`。
5. 页面标题标注周期：`GitHub Trending - daily`（跟着用户选的周期走，不要写死）。
6. 表格里每一条都来自 MCP 返回。**禁止编造仓库名、star 数、简介。**
   返回里找不到的字段写 `—`，不要拿别的字段顶替——尤其别把「总 Star」当成「增量」，
   也别把「增量」当成「总 Star」，这是最容易出的错。
   返回分成「新上榜 / 已连续上榜」两组时，**两组都要进表**（新面孔在前），只取一组榜单就是残的。
7. 不输出 Markdown 表格、不输出纯文本榜单、不在 HTML 之外补"榜单如下"这类说明。

## 异常处理

MCP 调用报错 / 连接失败 / 返回为空 / 拿不到任何榜单条目时，**仍然输出一份 HTML 页面**，正文写：

> MCP服务调用失败，请检查 github-trending MCP Server 是否正常启动，确认MCP配置后重试。

- 报错信息也放在 HTML 里，**不要输出纯文本报错**。
- 错误页同样要有完整 HTML 骨架 + 内联 CSS，标题仍标注用户选的周期。
- 错误页**不放空表格**（会让人误以为"今天榜单是空的"），改成醒目的错误卡片。
- 为什么这样：用户拿到的是一页能直接打开的东西，而不是一段需要自己翻译的日志。

## 产物自检

这份规范最容易翻车的是「只输出 HTML」和「五列齐全」，所以配了校验器：

```powershell
node scripts/validate.mjs <你的html文件>          # 校验一份产物
node scripts/validate.mjs --stdin < 你的html      # 从管道读
node scripts/validate.mjs --selftest              # 用规范自己的正反例验证校验器
```

它检查：无 markdown 围栏、文档骨架完整、`</html>` 之后没有多余字符、标题含 GitHub Trending 与周期、
表格五个列头齐全且各归其位、链接是合法 http(s)、条目数与 `--expect-rows N` 一致、
没有 `undefined`/`NaN` 之类填充失败物、以及错误页是否带了规定的提示文案。

落盘跑校验时，**回复里依然只给 HTML**，不要提文件名、不要加说明。

## Windows (win32) 平台说明

- 写文件显式 UTF-8：PowerShell 的 `>` 重定向会写 UTF-16/ANSI，中文直接变乱码。
  用 Node `fs.writeFileSync(p, html, 'utf8')` 或文件写入工具落盘。
- 路径统一正斜杠：`node scripts/validate.mjs out.html`。
- 管道喂 stdin 在 Windows PowerShell 5.1 会按 ANSI 编码丢中文，优先落盘再校验。

## References

- [`references/output-template.md`](references/output-template.md) — HTML 骨架、内联 CSS、错误页模板
- [`references/field-mapping.md`](references/field-mapping.md) — MCP 返回字段 → 五个表格列的语义映射

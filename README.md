# github-trending

> **不猜周期、不编数据、只出 HTML。**

一个给 AI Agent 用的 **GitHub Trending 上升项目查询规范**。

它解决的是一件很小、但每次都会错的事:让 Agent 查 GitHub Trending。
这件事的三个翻车点几乎从没缺席过——

| 翻车点 | 具体表现 |
|---|---|
| **周期猜错** | `daily` / `weekly` / `monthly` 的「Star 增量」含义完全不同(今日新增 / 本周新增 / 本月新增)。Agent 顺手默认一个,整张表第二列就系统性错了,而用户不会去逐行核对 |
| **数据是编的** | MCP 没连通时,Agent 很容易"凭印象"写一份看起来很像的榜单——仓库名像真的,star 数像真的,但**没有一个数字来自 GitHub** |
| **输出形态不对** | 给了 Markdown 表格、或者用 ``` 围栏包着 HTML、或者前后加一段"以下是本周榜单:",用户复制不出来,还得自己清理 |

这个 skill 把三件事钉死:**周期必须由用户定**、**数据必须来自 MCP**、**输出必须是能直接存的 HTML**。

---

## 三步固定流程

| 步骤 | 做什么 | 为什么 |
|---|---|---|
| **1. 先确定周期** | 用户请求里写了周期就用;没写就**主动问**(daily / weekly / monthly) | 周期错了整张表就错了,而错误是**看不出来的**那种 |
| **2. 校验并调 MCP** | 周期归一化后必须落在 `daily`/`weekly`/`monthly`;不落在就重新问。调 `github_trending`,**入参名按工具 schema 的真实名字**,调用后**核对返回里回显的周期** | 入参名写错**不会报错**,服务器会静默用默认值 —— 这是最阴的一类错误 |
| **3. 出 HTML** | 一整份自包含 HTML,表格固定五列 | 用户要的是能直接打开的一页,不是一段需要翻译的日志 |

**问周期时的原话**(skill 里就是这句):

> 请问你想要查询哪个周期的 GitHub Trending?可选:daily(每日)、weekly(每周)、monthly(每月)
> 是否需要限定编程语言?(可选)

用户请求里已经写了"本周""today""weekly"这类词,那就是用户的答案——**不再重复问一遍**。

---

## 输出长什么样

表格固定五列:**仓库名称 / Star 增量 / 总 Star 数量 / 仓库简介 / 仓库链接**,链接用 `<a href>` 可点。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>GitHub Trending - weekly</title>
<style>/* 内联样式,页面自包含,不引任何外部资源 */</style>
</head>
<body>
<div class="wrap">
  <h1>GitHub Trending - weekly</h1>
  <p class="meta">周期:weekly · 数据来源:github_trending MCP · 共 N 个仓库</p>
  <div class="table-wrap">
  <table>
    <colgroup>
      <col style="width:23%"><col style="width:11%"><col style="width:13%">
      <col style="width:34%"><col style="width:19%">
    </colgroup>
    <thead><tr>
      <th>仓库名称</th><th>Star 增量</th><th>总 Star 数量</th>
      <th>仓库简介</th><th>仓库链接</th>
    </tr></thead>
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

**回复里只有这份 HTML。** 没有 ``` 围栏,没有"以下是",没有前后中文说明——复制出来存成 `.html` 双击就能开。

---

## MCP 调用失败时

**仍然输出一份 HTML 页面**,正文写死这句:

> MCP服务调用失败,请检查 github-trending MCP Server 是否正常启动,确认MCP配置后重试。

报错信息也放在 HTML 里,不输出纯文本报错;错误页**不放空表格**(那会让人误以为"今天榜单是空的"),而是错误卡片。标题仍然标注用户选的周期。

**关键设计:不降级。** MCP 连不上时,这个 skill **不允许** Agent 改用自己抓网页、自己搜、自己凭记忆写——
因为那样用户拿到的东西就不再是"来自 MCP 的榜单"了。要一份真的榜单,正确做法是把 MCP server 配好。

> **唯一的例外**:宿主已经有 MCP 客户端(比如 `mcporter`)时,可以用它以 ad-hoc stdio 的方式拉起公开包
> `github-trending-mcp`,调用**同一个工具名** `github_trending`——这是**真调用真工具**,不是编数据。
> 但它会往临时目录装 npm 包,属于对用户机器的改动,**先问用户能不能装**;用户不允许就老实出错误页。

---

## 前置依赖:github-trending MCP Server

本 skill 绑定的是一个 **MCP 工具**,不是抓取脚本。宿主需要已配置:

| 项 | 值 |
|---|---|
| MCP Server 名 | `github-trending` |
| 工具名 | `github_trending` |
| 周期入参名 | **按工具 schema 里的真实名字**——实测公开包 `github-trending-mcp` 用的是 `range`;有的 server 叫 `period` |
| 周期取值 | `daily` / `weekly` / `monthly` |
| 语言入参 | `language`(可选) |

公开包的配置骨架:

```json
{
  "mcpServers": {
    "github-trending": {
      "command": "npx",
      "args": ["-y", "github-trending-mcp"]
    }
  }
}
```

### ⚠️ 入参名写错不会报错(实测)

`github-trending-mcp` 的真实签名是:

```ts
function github_trending(language?: string, range?: "daily" | "weekly" | "monthly");
```

传 `--args '{"period":"weekly"}'` **不会报任何错**——服务器直接忽略未知字段,回落到默认值 `daily`,
然后安安静静返回一份**日榜**。返回结构完全正常,肉眼看不出任何异常。

所以 skill 里有两条硬规则:

1. **入参名按 schema 来**,不按记忆,更不臆造;
2. **调用后核对返回里回显的周期**(实测字段是 `range`),它必须等于你请求的周期。不等就是没传进去,
   按异常处理重试——**绝不能把日榜当周榜交出去**。

### 返回的真实结构(实测)

```jsonc
{
  "language": null,          // 回显语言过滤
  "range": "daily",          // 回显实际生效的周期 ← 必须核对
  "count": 11,
  "newRepositories": {       // 近 3 天没上过榜的「新面孔」
    "count": 11, "note": "…", "repositories": [ /* … */ ]
  },
  "seenRepositories": {      // 近 3 天已经在榜上的
    "count": 0, "note": "…", "repositories": [ /* … */ ]
  },
  "trendAnalysis": { "hasSufficientData": false, "analysisNote": "…" }
}
```

单条记录:

```jsonc
{
  "full_name": "elayadesign/ai-design-skills",  // → 仓库名称
  "description": "",                            // → 仓库简介(空就写 —)
  "language": "",
  "stargazers_count": 10139,                    // → 总 Star 数量
  "forks_count": 734,
  "stargazers_add": 1395,                       // → Star 增量(随 range 变)
  "users": [ { "avatar": "…", "href": "/elayadesign" }, … ]
}
```

三个必须知道的细节:

- **返回里没有 `url` / `html_url`。** 链接只能从 `full_name` 推导:`https://github.com/{full_name}`。
  这是**确定性推导**不是编造——GitHub 的仓库 URL 就是这个形状,点进去必然对得上。
  (`users[].href` 是贡献者头像路径,**不是**仓库地址,别拿它当链接。)
- **`newRepositories` 和 `seenRepositories` 两组都要进表**,新面孔在前。一个是新上榜,
  一个是连续上榜的老面孔,合起来才是完整榜单;只取一组,榜单就是残的。
- **`stargazers_add` 是增量、`stargazers_count` 是累计**,两者取自页面不同位置(前者来自页脚
  "N stars today",后者来自仓库链接区的星标数)。**30 秒自检**:数一数"增量 == 总数"的行数,
  正常应该是 0 行;要有一整列相等,就是两个字段被映射错了。
  另一个交叉验证法:换个周期再调一次,增量列量级应该明显变大,总数列不动。

**没配 MCP 会怎样**:skill 会输出上面那张错误页,而不是编一份榜单。这是设计,不是故障。

---

## 安装

把 `github-trending/` 整个目录放进你的 Agent 读取的 skills 目录:

| Agent | 路径 |
|---|---|
| Mavis | `~/.minimax/skills/github-trending/` |
| Claude Code | `~/.claude/skills/github-trending/` |
| Codex / Gemini CLI / Copilot / OpenCode | `~/.agents/skills/github-trending/` |

**零依赖。** 没有 npm 包,没有 `npm install`,不需要 API Key。
唯一的硬依赖是上面那个 MCP Server。

---

## 产出后自检:校验器

规范里最容易被忽略、但一错就废掉的两条——「只输出 HTML」和「五列齐全」——过去只能靠人肉核对。
现在 skill 自带一个零依赖校验器:

```bash
node github-trending/scripts/validate.mjs <你的html文件>            # 校验产物
node github-trending/scripts/validate.mjs --stdin < 你的html        # 从管道读
node github-trending/scripts/validate.mjs --selftest                 # 用规范自己的正反例验证校验器
```

它检查:

1. 完整 HTML 骨架(`<!DOCTYPE html>` / `<html>` / `</html>`)
2. **没有 ``` 围栏**,`</html>` 之后**没有多余字符**(抓"前后加中文说明")
3. 标题含 `GitHub Trending` 且标注了周期(可用 `--period weekly` 卡死核对)
4. 表格五个列头齐全且各归其位(按语义匹配,不只认字面)
5. 每个链接是合法 `http(s)`,条目数与 `--expect-rows N` 一致
6. 页面里没有 `undefined` / `NaN` / `[object Object]` 这类**字段映射失败的填充物**
7. 错误页带了规定的提示文案、且**没有**空表格

`--selftest` 用规范自己的正例和 16 类反例跑一遍校验器 —— **规范和校验器不会各说各话**。

校验器**不联网、不抓取**,只查产物。

---

## 冷启动实测:别人下载后到底什么效果

派了**从没见过的 Agent** 当冷启动测试:只给它 `SKILL.md` 和 `references/`,自己读、自己跑,
不提供任何额外指导。同一个题目跑两组——**带 skill** 和**不带 skill**。

测试环境里 `github-trending` MCP Server **没有注册**(`tool_search` 目录为空、
`mcp_invoke` 报 `Unknown tool_name`、`mcp.json` 里没有这个 server),
所以两组都会撞上"工具调不通"——正好用来测**失败路径**。

| 指标 | 带 skill | 不带 skill(基线) |
|---|---|---|
| 周期来源 | 写出原话**主动问**;拿不到回答就显式标注为假设 | **自己默认了 daily**,末尾才补一句"要周榜说一声" |
| MCP 失败后 | 走错误页,或按用户许可拉起真 server | **自己降级抓 GitHub Trending 页面**,解析后用 API 交叉校验 |
| 数据来源 | `github_trending` MCP 工具(**真调用**) | 抓页面 + GitHub API 复核(也是真的) |
| 输出形态 | **纯 HTML**,五列固定顺序,无围栏无前后说明 | 题目要"榜单"时给的是 **Markdown 表格 + 中文解读**;题目要"网页"时才给 HTML |
| 校验器 | `--period daily --expect-rows 11` → **全部检查通过** | 不适用(不是 HTML) |

**结论:基线在"能不能搞到数据"上不吃亏,带 skill 的那组在"产物是不是你要的东西"上稳赢。**

这说明这个 skill 的价值**不在"能不能搞到数据"**——MCP 通路正常时两者一样,
不通时基线反而更能扛。它价值在**约束产物**:

- 周期有据可查,不是 agent 顺手定的
- 榜单里的每个数字都来自 MCP,不是"看起来很像"
- 输出是一份能直接打开的 HTML,而不是需要用户二次加工的 Markdown

冷启动还挖出四个真问题,已全部修掉:

| 冷启动暴露的问题 | 修法 |
|---|---|
| 用户请求里已经写了"weekly",skill 却要求"必须问",Agent 只能绕过 | 步骤 1 改成「**先确定周期**」:请求里给了就用,没给才问 |
| **入参名 `period` 被服务器静默忽略**,回落默认值 `daily`,交出一份周期完全不对的榜单 | 改成「按 schema 传参」+ **核对返回里回显的周期**,不等就按异常处理重试 |
| 返回**没有 url 字段**,原规则要求"不许拼 URL",会把整列链接逼成 `—` | 允许从 `full_name` 确定性推导 `https://github.com/{full_name}` |
| 真实数据渲染时表头"Star 增量"被挤成两行;`text-transform:uppercase` 把字段名改成了"STAR" | 模板加 `white-space:nowrap` + `table-layout:fixed` + `overflow-wrap:anywhere`,并去掉 uppercase |

> 顺带一提:冷启动的 Agent 自己读了一遍 `github-trending-mcp` 的 `dist/index.js`,
> 确认了 `stargazers_count`(仓库链接区星标数=累计)和 `stargazers_add`(页脚 "N stars today"=增量)
> **取自页面不同位置**,又用换周期实测交叉验证了一遍。这套"读源码 + 换周期对撞"的验法已写进
> [`field-mapping.md`](github-trending/references/field-mapping.md)。

---

## 目录结构

```
github-trending-repo/
├── README.md                        # 本文件
├── LICENSE                          # MIT
└── github-trending/                 # ← 这才是 skill 本体,整个目录拷进 skills 目录
    ├── SKILL.md                     # 三步流程 + 输出硬约束 + 异常处理 + 产物自检
    ├── scripts/
    │   └── validate.mjs             # 产物校验器(零依赖,不联网,只查产物对不对)
    └── references/
        ├── output-template.md       # HTML 骨架 + 内联 CSS + 错误页模板 + 违规反例
        └── field-mapping.md         # MCP 返回字段 → 五列的语义映射 + 真实返回样例
```

---

## 一点说明

这个 skill 追求的是「**每一步都可追溯**」,不是「信息最全」。

它会明确告诉你周期是谁定的、数据来自哪里、失败时错在哪一步,
而不是给你一份看起来很满、实际混着编造数字的榜单。

**把"不骗人"放在"好看"前面,是因为榜单的可信度取决于它的下限,不是它的上限。**

---

## 许可

MIT,见 [LICENSE](LICENSE)。

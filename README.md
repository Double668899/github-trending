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
| **2. 校验并调 MCP** | 周期归一化后必须落在 `daily`/`weekly`/`monthly`;不落在就重新问。然后调 `github_trending`,参数 `period` | 工具名和入参名照抄,不自造;返回里没有的字段写 `—`,不拿别的字段顶替 |
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
  <table>
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

---

## 前置依赖:github-trending MCP Server

本 skill 绑定的是一个 **MCP 工具**,不是抓取脚本。宿主需要已配置:

| 项 | 值 |
|---|---|
| MCP Server 名 | `github-trending` |
| 工具名 | `github_trending` |
| 入参 | `period`,取值 `daily` / `weekly` / `monthly` |

配置骨架:

```json
{
  "mcpServers": {
    "github-trending": {
      "command": "npx",
      "args": ["-y", "<该 MCP Server 的包名>"]
    }
  }
}
```

> **不同 server 的工具名和入参名可能不一样。** 例如公开的
> `@npm_xiyuan/mcp-github-trending` 暴露的是 `get_trending_repos`,周期参数叫 `since`,
> 返回里只有 `name` / `url` / `description` / `stars`(且 `stars` 是 `"1,234 stars today"`
> 这种**带格式的字符串**,没有累计星标)。
> skill 的规则是**按语义映射、不认死字段名**,所以换 server 仍然适用——
> 但工具名和入参名要按你自己 server 的 schema 来,别照抄。

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

派了一个**从没见过这个 skill 的 Agent** 当冷启动测试:只给它 `SKILL.md` 和 `references/`,
自己读、自己跑,不提供任何额外指导。同一个题目跑两组——**带 skill** 和**不带 skill**。

测试环境里 `github-trending` MCP Server **没有注册**(`tool_search` 目录为空、
`mcp_invoke` 报 `Unknown tool_name`、`mcp.json` 里没有这个 server),
所以两组都会撞上"工具调不通"——正好用来测**失败路径**。

| 指标 | 带 skill | 不带 skill(基线) |
|---|---|---|
| 周期来源 | 用户请求原文 | **Agent 自己默认了 daily**,末尾才补一句"要周榜说一声" |
| MCP 失败后 | 走错误页 | **自己降级抓 GitHub Trending 页面**,解析 11 条并用 API 交叉校验 |
| 数据真伪 | 无数据,明说失败 | 数据**是真的**(11/11 条 API 复核一致) |
| 输出形态 | **纯 HTML**,无围栏无前后说明,校验器 0 违规 | **Markdown 表格** + 中文解读 + 4 条观察 |
| 校验器违规项 | **0** | 不适用(不是 HTML) |

**结论:基线拿到了更好的数据,带 skill 的那组拿到了更合规的产物。**

这说明这个 skill 的价值**不在"能不能搞到数据"**——MCP 通路正常时两者一样,
不通时基线反而更能扛。它价值在**约束产物**:

- 周期有据可查,不是 agent 顺手定的
- 榜单里的每个数字都来自 MCP,不是"看起来很像"
- 输出是一份能直接打开的 HTML,而不是需要用户二次加工的 Markdown

冷启动还挖出两个真问题,已修:

| 冷启动暴露的问题 | 修法 |
|---|---|
| 用户请求里已经写了"weekly",skill 却要求"必须问",Agent 只能绕过 | 步骤 1 改成「**先确定周期**」:请求里给了就用,没给才问 |
| 真实数据渲染时表头"Star 增量"被挤成两行;`text-transform:uppercase` 把字段名改成了"STAR" | 模板加 `white-space:nowrap` + `table-layout:fixed` + `overflow-wrap:anywhere`,并去掉 uppercase |

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

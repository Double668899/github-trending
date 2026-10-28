# 字段映射:MCP 返回 → 表格五列

MCP Server 的返回结构**不保证字段名固定**。先看一次真实返回,再按下表做**语义**映射,
不要按字段名硬套,也不要因为字段名不认识就跳过整个表。

> 下面的"真实返回"一节是**实测**出来的(2026-10-28,`github-trending-mcp` npm 包),不是猜的。
> 换 server 时以你那边的实际返回为准,但**映射规则**不变。

## 五个语义列

| 表格列 | 语义 | 常见候选字段名 |
|---|---|---|
| 仓库名称 | 仓库的 owner/name 展示名 | `full_name`, `repo`, `repository`, `name`, `repo_name` |
| Star 增量 | **该周期内新增**的 star | `stargazers_add`, `stars_today`, `stars_this_week`, `stars_this_month`, `period_stars`, `new_stars` |
| 总 Star 数量 | 仓库累计 star | `stargazers_count`, `total_stars`, `stars_total`, `total_stargazers` |
| 仓库简介 | 一句话描述 | `description`, `desc`, `summary` |
| 仓库链接 | 仓库主页 URL | `url`, `html_url`, `link`, `repo_url`(**可能根本没有**——见下) |

## 映射规则

1. **先 dump 返回结构,再映射。** 看清楚数组在顶层还是 `repos` / `data` / `items` / `results` 下面,
   一条记录是对象还是数组。结构没看清就写映射,一定会错位。
2. **按语义挑字段,不按名字挑。** `stars` 这种中性名字要看它随周期变不变:
   - `range=weekly` 时它明显变大 → 它是**增量**
   - 同一字段数量级和累计 star 相当 → 它是**总 Star**
   判断不了就当没有这个字段,写 `—`,别硬塞。
3. **增量与总数是两回事,绝不互相顶替。** 把累计星标当"本周新增"是本页最严重的错,
   因为它看起来完全合理,不核对数字根本发现不了。
4. **仓库链接:能取 URL 就用 URL;取不到就从 `full_name` 推导。**
   `full_name` 是 `owner/repo` 形态时,`https://github.com/{full_name}` 是**确定性推导**,
   不是编的——GitHub 的仓库 URL 就是这个形状,点进去必然对得上。
   > ⚠️ 只有当 `full_name` **确实是 `owner/repo` 形态**时才这么拼。
   > 如果那个字段不是这个形状(比如是纯仓库名、或者带路径前缀),**不要拼**,写 `—`。
5. **缺字段就写 `—`。** 五列都必须存在,值可以是 `—`;但**列不能少、也不能多**。
6. **不要"顺手补全"。** 返回里没写简介就留空(`—`),不要根据仓库名猜它做什么——
   猜出来的那句简介会混进榜单,看起来像真数据。

---

## 真实返回(实测,`github-trending-mcp`)

顶层结构是**两组仓库**,不是一个扁平数组:

```jsonc
{
  "language": null,          // 回显你传的语言过滤
  "range": "daily",          // 回显**实际生效**的周期 ← 必须核对
  "count": 11,
  "newRepositories": {       // 近 3 天没上过 trending 的「新面孔」
    "count": 11,
    "note": "These repos have NOT appeared in trending within the last 3 days...",
    "repositories": [ /* … */ ]
  },
  "seenRepositories": {      // 近 3 天已经在榜上的
    "count": 0,
    "note": "These repos have appeared in trending within the last 3 days...",
    "repositories": [ /* … */ ]
  },
  "trendAnalysis": { "hasSufficientData": false, "analysisNote": "…" }
}
```

单条记录:

```jsonc
{
  "full_name": "elayadesign/ai-design-skills",  // → 仓库名称
  "description": "",                            // → 仓库简介(空就是空,写 —)
  "language": "",                               // 编程语言
  "stargazers_count": 10139,                    // → 总 Star 数量
  "forks_count": 734,
  "stargazers_add": 1395,                       // → Star 增量(随 range 变)
  "users": [ { "avatar": "…", "href": "/elayadesign" }, … ]
}
```

### 三个必须注意的点

1. **返回里没有 `url` / `html_url`。** 链接只能从 `full_name` 推导(见映射规则第 4 条)。
   别去 `users[].href` 里找——那是贡献者头像的路径,不是仓库地址。
2. **`newRepositories` 和 `seenRepositories` 两组都要用。**
   一个是"新面孔",一个是"连续上榜的老面孔",**合起来才是完整榜单**。
   只取一组,榜单就是残的。而且这两组是**缓存判定**的(3 天窗口),
   同一个仓库在两次调用之间可能从 `new` 挪到 `seen`——这是正常的,别当成数据错误。
   排序:先 `new` 后 `seen`(新面孔在前),组内按服务器给的顺序。
3. **`range` 字段是回显,必须核对。** 它告诉你服务器**实际用了哪个周期**。
   你要 `weekly` 而回显是 `daily`,说明周期没传进去(入参名不对,详见 SKILL.md 步骤 2)——
   **按异常处理重试,绝不能把 daily 的数据当 weekly 交出去。**
   > 这是最阴的一类错误:参数名写错不会报错,服务器会**静默用默认值**,
   > 然后你交出一份周期完全不对、但看起来毫无破绽的榜单。
4. **`stargazers_add` 是增量,`stargazers_count` 是累计——两者取自页面的不同位置。**
   实测(server 源码):`stargazers_count` 取自仓库链接区的星标数(总量,永远不变),
   `stargazers_add` 取自页脚那句 "N stars today"(周期增量,随 `range` 变)。
   > **30 秒自检**:把同一份数据里"增量 == 总数"的行数数一遍。
   > 正常应该是 **0 行**;如果有一整列都相等,说明两个字段被映射错了(或者被同一个字段填了两列)。
   > 另一个交叉验证法:同一工具再调一次别的周期,增量列的量级应该明显变大(weekly > daily),而总数列不动。

---

## 字段语义的实测方法

拿不准某个数字是增量还是累计时,别猜,验:

1. **读 server 源码**(公开包在 `dist/index.js`):看它是从页面的哪个位置取的数。
2. **换周期再调一次**:同一工具,`range` 换另一个值。
   - 跟着变的那个 = **增量**
   - 不动的那个 = **累计**
   实测:daily 11 条 / weekly 13 条,仓库集合完全不同;daily 的增量量级(617~2830)
   明显小于 weekly(873~16388),而总数列基本不动。
3. **对撞检查**:增量列和总数列有没有整列相等的行?有就是映射错了。

---

## 值怎么写

| 值 | 写法 |
|---|---|
| Star 增量 | 原始数字即可,`128`;页面 CSS 负责加号与配色 |
| 总 Star | 原始数字即可,`4,210`(千分位纯展示,不改数值) |
| 简介 | 原样;过长用 CSS 截断,不要改写措辞;空 → `—` |
| 缺失 | `—`(em dash),不要写 `null` / `undefined` / 空字符串 |

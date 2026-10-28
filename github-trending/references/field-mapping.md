# 字段映射：MCP 返回 → 表格五列

MCP Server 的返回结构**不保证字段名固定**。先看一次真实返回，再按下表做**语义**映射，
不要按字段名硬套，也不要因为字段名不认识就跳过整个表。

## 五个语义列

| 表格列 | 语义 | 常见候选字段名 |
|---|---|---|
| 仓库名称 | 仓库的 owner/name 展示名 | `repo`, `repository`, `name`, `full_name`, `repo_name`, `project` |
| Star 增量 | **该周期内新增**的 star | `stars_today`, `stars_this_week`, `stars_this_month`, `period_stars`, `stars_period`, `new_stars`, `stars`（当它只随周期变化时） |
| 总 Star 数量 | 仓库累计 star | `total_stars`, `stargazers_count`, `stars_total`, `total_stargazers`, `stars_count` |
| 仓库简介 | 一句话描述 | `description`, `desc`, `summary`, `about` |
| 仓库链接 | 仓库主页 URL | `url`, `html_url`, `link`, `repo_url`, `repository_url` |

## 映射规则

1. **先 dump 返回结构，再映射。** 看清楚数组在顶层还是 `repos` / `data` / `items` / `results` 下面，
   一条记录是对象还是数组。结构没看清就写映射，一定会错位。
2. **按语义挑字段，不按名字挑。** `stars` 这种中性名字要看它随 `period` 变不变：
   - `period=weekly` 时它明显变大 → 它是**增量**
   - 同一字段数量级和累计 star 相当 → 它是**总 Star**
   判断不了就当没有这个字段，写 `—`，别硬塞。
3. **增量与总数是两回事，绝不互相顶替。** 把累计星标当"本周新增"是本页最严重的错，
   因为它看起来完全合理，不核对数字根本发现不了。
4. **仓库名与链接要对得上。** 链接来自 `url`/`html_url`；链接里的路径段应与仓库名一致。
   对不上时以链接为准并在页面注明，或干脆标 `—`，不要拼一个假的。
5. **缺字段就写 `—`。** 五个列都必须存在，值可以是 `—`；但**列不能少、也不能多**。
6. **不要"顺手补全"。** 返回里没写简介就留空，不要根据仓库名猜它做什么——
   猜出来的那句简介会混进榜单，看起来像真数据。

## 常见返回形态

```jsonc
// 形态 A：顶层数组
[{ "repo": "owner/name", "stars_today": 128, "total_stars": 4210,
   "description": "…", "url": "https://github.com/owner/name" }]

// 形态 B：对象包裹
{ "repos": [{ "name": "owner/name", "stars": 128, "stargazers_count": 4210, … }] }

// 形态 C：带周期提示
{ "period": "weekly", "items": [{ "full_name": "owner/name",
   "period_stars": 512, "total_stars": 9800, "html_url": "…", "description": "…" }] }
```

形态 B 里的 `stars`（128）对应形态 A 的 `stars_today`——**同一个中性名字在不同 server 里含义可能不同**，
所以第 2 条规则（看它随周期变不变）比字段名可靠。

## 真实返回样例（公开 MCP server 的常见形态）

有些 server 直接把 GitHub 页面上的文案搬过来，`stars` 是**带格式的字符串**而不是数字：

```json
[{ "name": "owner/repo-name",
   "url": "https://github.com/owner/repo-name",
   "description": "Repository description",
   "stars": "1,234 stars today" }]
```

这种返回要特别注意三件事：

1. **`stars` 是该周期的增量，不是累计星标。** 字符串里带 `today` / `this week` / `this month`
   就是周期增量，取数字部分（`1,234` → `1234`）填进「Star 增量」列。
2. **它不是总 Star。** 同一个 server 往往**只透出增量、不透出累计星标**——GitHub Trending 页面本身
   是同时有累计 star 和周期增量的（页面星标图标旁那个数就是累计值），但 server 未必把两个数都带出来。
   这时「总 Star 数量」列写 `—`，**不要**拿增量顶替，也不要去猜一个数。
   > 用户看到一整列 `—` 是诚实的；看到一列被填错的累计星标，用户无从察觉。
3. **周期词要和本次周期对上。** 返回里写着 `stars today` 而用户要的是 monthly，
   说明拿到的不是他要的周期——按异常处理重试或如实标注，不要当成 monthly 的数填进去。

## 各列没数据时的写法

| 列 | 拿不到就写 | 不要写成 |
|---|---|---|
| Star 增量 | `—` | 总 star、猜的数 |
| 总 Star 数量 | `—` | 周期增量 |
| 仓库简介 | `—` | 根据仓库名编一句 |
| 仓库链接 | `—` | 拼一个 `https://github.com/` + 名字猜的 URL |

## 值怎么写

| 值 | 写法 |
|---|---|
| Star 增量 | 原始数字即可，`128`；页面 CSS 负责加号与配色 |
| 总 Star | 原始数字即可，`4,210`（千分位纯展示，不改数值） |
| 简介 | 原样；过长用 CSS 截断，不要改写措辞 |
| 缺失 | `—`（em dash），不要写 `null` / `undefined` / 空字符串 |

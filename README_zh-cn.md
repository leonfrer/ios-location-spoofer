# iOS Location Spoofer

用代理软件的 HTTPS 解密（MITM）功能，把 Apple 地图定位骗到世界任何角落 —— 无需越狱、无需电脑、无需开发者账号。

[English](README.md) | **中文**

## 这是什么

iPhone 看 Wi-Fi 信号和基站信号，拿着 BSSID 列表去问 Apple 这些设备在什么位置。Apple 回一份坐标清单，iOS 根据这些坐标算出自己在哪里。

这个项目做的事情很简单：**在 Apple 发回坐标的路上拦截下来，全部改成你想要的数字**。iPhone 拿到改造过的坐标，算出来就是你指定的地方。

它以五个代理软件的即导即用模块形式发布，免编译、免开发者账号。

## 原理

```
iPhone  ──(BSSID 列表)──►  Apple gs-loc  ──(坐标)──►  [ 脚本在这里改写坐标 ]  ──►  iPhone
```

脚本拦截 Apple 定位服务器 `.../clls/wloc` 的回应，把 WiFi 热点、蜂窝基站坐标（以及运动状态字段）替换为你的目标值，并自动兼容 Apple 使用的封装格式（ARPC / synthetic / marker / bare）。

## 支持哪些软件

| 软件 | 文件 | 导入方法 | 状态 |
|------|------|---------|------|
| Shadowrocket（小火箭） | [`scripts/ios-location-spoofer.sgmodule`](scripts/ios-location-spoofer.sgmodule) | 配置 → 右上角 + | ✅ 实测通过 |
| Surge | [`scripts/ios-location-spoofer-surge.sgmodule`](scripts/ios-location-spoofer-surge.sgmodule) | 首页 → 模块 → 安装新模块 | ✅ 实测通过 |
| Loon | [`scripts/ios-location-spoofer.lnplugin`](scripts/ios-location-spoofer.lnplugin) | 设置 → 插件 → 添加插件 | ✅ 实测通过 |
| Quantumult X | [`scripts/ios-location-spoofer.snippet`](scripts/ios-location-spoofer.snippet) | 设置 → 重写 → 添加 | 🟡 待测试 |
| Stash | [`scripts/ios-location-spoofer.stoverride`](scripts/ios-location-spoofer.stoverride) | 覆写 → 安装覆写 | ✅ 实测通过 |

## 小白保姆级教程（Shadowrocket 小火箭）

本教程教你用 **Shadowrocket（小火箭）** 把 iPhone 的定位改到世界任何地方，**无需越狱、无需电脑、无需开发者账号**。其他软件思路一致：开 MITM → 信任证书 → 导入模块 → 改坐标 → 逼定位刷新。

> 此方法适用于包括 **iOS 27 beta** 在内的各系统版本。

### 第一步：导入模块

1. 打开 **Shadowrocket** → 底部 **「配置」**
2. 找到 **「模块」** → 点右上角 **「+」** → **「来自 URL」**，粘贴：
   ```
   https://raw.githubusercontent.com/hoicau/ios-location-spoofer/main/scripts/ios-location-spoofer.sgmodule
   ```
3. 保存。确认 **「iOS Location Spoofer」** 这条是勾选/启用（右侧有 ✓）状态。

### 第二步：打开 HTTPS 解密

1. 进入 **「HTTPS 解密」** 页面。不同版本入口不同 —— Shadowrocket iOS 2.2.88(3308) 实测：**配置** → 点当前配置右侧 **「ⓘ」** → **「HTTPS 解密」**；旧版：底部 **设置** → **HTTPS 解密**。
2. 把开关打开（变蓝）。若这里只有**一个**开关，那是正常的，它本身就是中间人解密。
3. 确认 **「域名」** 列表包含这四个（导入模块后通常会自动出现）：
   ```
   gs-loc.apple.com
   gs-loc-cn.apple.com
   bluedot.is.autonavi.com
   bluedot.is.autonavi.com.gds.alibabadns.com
   ```
   如果没有，点绿色 **「+」** 用逗号分隔粘进去，再点右上角 ✓ 保存。

### 第三步：安装并信任证书（90% 的人漏这步）

1. 还在 HTTPS 解密页面，点 **「证书」** → **「生成新的 CA 证书」** → **「安装证书」**。
2. iPhone **设置 → 通用 → VPN 与设备管理** → Shadowrocket 的描述文件 → **「安装」**（输锁屏密码）。
3. ⚠️ **设置 → 通用 → 关于本机 → 证书信任设置** → 把 **Shadowrocket 证书的开关打开**（完全信任）。这个开关不开，解密就不工作。

### 第四步：开启代理

回到 Shadowrocket **首页**，把顶部**总开关打开**（变绿 / 显示"已连接"），第一次弹"是否允许添加 VPN 配置"点 **允许**。

### 第五步：设置你想去的坐标

默认是**苹果总部（库比提诺）**。改法：**配置 → 模块 → iOS Location Spoofer**，改 `argument=` 里的：

- `latitude=` → 你的**纬度**
- `longitude=` → 你的**经度**

常用坐标：

| 地点 | latitude（纬度） | longitude（经度） |
|------|------------------|-------------------|
| 北京天安门 | 39.9087 | 116.3975 |
| 上海外滩 | 31.2397 | 121.4900 |
| 广州塔 | 23.1066 | 113.3245 |
| 东京塔 | 35.6586 | 139.7454 |

> **怎么查坐标**：打开 Google / 高德地图，找到目标，右键或长按 → 复制坐标（纬度在前、经度在后）。

**顺手把海拔也调一下**（别只改经纬度）：海拔停在默认 530 米、人却"在"上海（近海平面）就会明显露馅。免费查真实海拔：
```
https://api.open-meteo.com/v1/elevation?latitude=31.2397&longitude=121.4900
```
返回里的 `elevation` 就是海拔（米）。其余可调参数见下方[改坐标](#改坐标参数)表。

### 第六步：让定位生效

苹果对定位有缓存，改完不会立刻生效，需要"逼" iPhone 重新请求：

1. **设置 → 隐私与安全性 → 定位服务** → **整个关掉，等 10 秒以上，再打开**。
2. 打开 **地图** 或 **天气** App 查看。
3. **没变就重复关/开几次**，多试几遍就会命中。生效后通常会稳定保持。

## 改坐标（参数）

在模块 `argument=`（Shadowrocket/Surge/Stash）或 Loon 插件 UI 里设置：

| 名字 | 默认值 | 说明 |
|------|--------|------|
| `latitude` | 37.3349 | 目标纬度 |
| `longitude` | -122.00902 | 目标经度 |
| `address` | （空） | 地址搜索（Loon 插件 UI 填写，联网解析，优先于手动经纬度） |
| `altitude` | 530 | 海拔（米，支持负数） |
| `horizontalAccuracy` | 39 | 水平精度（越小越"精准"，5~15 更像 GPS） |
| `verticalAccuracy` | 1000 | 垂直精度（配了真实海拔后可调到 10~30） |
| `failOpen` | true | 出错放行原数据 |
| `debug` | false | 调试日志 |

## Loon 额外说明

1. 导入 `scripts/ios-location-spoofer.lnplugin` 后，在 **设置 → 插件** 里打开插件配置页。
2. 可直接填 **纬度 / 经度**；**地址搜索** 由每 5 分钟的定时任务联网解析并缓存（首次请直接填经纬度，或保存地址后等一轮 cron）。
3. 必须开启 Loon 的 **MITM** 并信任证书，且插件内 `[mitm]` 四个域名生效。
4. 插件含 **Prepare** 请求脚本（设置 `Accept-Encoding: identity`，避免 `zip decompress error` / 脚本超时）。
5. 改坐标后关开定位；打开 **调试日志**，在 Loon 日志搜 `Location spoofer`。

> 日志出现 `Evaluate script timeout` 或 `zip decompress error:-3`：更新插件并重载 Loon，确认三条脚本（Prepare / Response / Geocode cron）均已启用。

## 进阶：网页地图选点（Cloudflare Worker）

经常换定位、懒得手动改数字？**本仓库根目录本身就是一个 Cloudflare Worker**：点地图即定位、海拔按地形自动填、精度可调，还有一键 **恢复真实定位** 开关，免 VPS、自带 HTTPS，Loon / Shadowrocket 通过 `configUrl` 读取。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hoicau/ios-location-spoofer)

### 接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/?token=` | GET | 地图选点网页（**必须带正确 token**） |
| `/loc.json?token=` | GET | 读取坐标 JSON |
| `/set?token=` | POST | 保存坐标（并开启伪造） |
| `/enable` | POST | 切换伪造 / 恢复真实定位（无需 token，`{enabled:false}` 放行原始数据） |
| `/health` | GET | 健康检查（无需 token） |

### 部署方式 A：一键部署（在浏览器里完成，无需命令行）

1. 点上方的 **Deploy to Cloudflare** 按钮，登录（或注册）你的 Cloudflare 账号。
2. Cloudflare 会读取 `wrangler.jsonc`，**自动创建 `LOC_KV` 命名空间并写入其 ID**，把仓库克隆到你自己的 GitHub，然后构建、部署 Worker。核对它列出的资源、保持默认、等构建完成即可。
3. **设置访问口令** —— 必须，否则读取/保存接口一律拒绝。在控制台：**Workers & Pages → 你的 Worker → Settings → Variables and Secrets → Add**，类型选 **Secret**，名字填 `TOKEN`，值填一串长随机字符串（例如 `openssl rand -hex 24` 生成），然后 **Deploy**。
4. 若地图页能打开但保存失败，去 **Settings → Bindings** 看有没有名为 `LOC_KV` 的 **KV namespace** 绑定，没有就加一个。
5. 复制你的 Worker 地址（`https://<名字>.<账号>.workers.dev`），继续看 [接到代理软件](#接到代理软件)。

> 之后往你的 GitHub 副本推送提交，会通过 Workers Builds 自动重新部署。

### 部署方式 B：粘贴到 Cloudflare 控制台（无需命令行、无需 GitHub）

不想连 GitHub？整个 Worker 是一个自包含的单文件，直接粘进控制台编辑器即可：

1. **Workers & Pages → Create → Create Worker**，起个名字，**Deploy** 默认模板。
2. **Edit code**，删掉模板，把 [`src/index.js`](src/index.js) 的全部内容粘进去，**Deploy**。
3. **Settings → Bindings → Add → KV namespace**：变量名填 `LOC_KV`，新建或选择一个命名空间。
4. **Settings → Variables and Secrets → Add → Secret**：名字填 `TOKEN`，值填一串长随机字符串（例如 `openssl rand -hex 24`），再 **Deploy** 一次。
5. 打开 `https://<名字>.<账号>.workers.dev/?token=你的TOKEN`，能看到地图即成功。继续看 [接到代理软件](#接到代理软件)。

### 部署方式 C：用 Wrangler 命令行

```bash
# 1. 安装依赖（在仓库根目录）
npm install

# 2. 设置访问口令（建议用 openssl rand -hex 24 生成）
npx wrangler secret put TOKEN

# 3. 部署 —— 首次运行会自动创建 LOC_KV 命名空间，
#    并把 id 写回 wrangler.jsonc
npm run deploy
```

想自己管理命名空间？先创建，把输出的 `id`（和 `preview_id`）填进 `wrangler.jsonc` 里 `LOC_KV` 绑定，再部署：

```bash
npx wrangler kv namespace create LOC_KV
npx wrangler kv namespace create LOC_KV --preview
```

本地开发：复制 `.dev.vars.example` 为 `.dev.vars` 并填 `TOKEN=...`，再 `npm run dev`。

### 接到代理软件

**Loon** → 设置 → 插件 → iOS Location Spoofer → **远程配置 URL**：
```
https://你的worker.你的账号.workers.dev/loc.json?token=你的TOKEN
```

**Shadowrocket** → 模块 `argument=` 末尾追加：
```
&configUrl=https://你的worker.你的账号.workers.dev/loc.json?token=你的TOKEN
```

然后在 iPhone 浏览器打开 `https://你的worker.你的账号.workers.dev/?token=你的TOKEN`，点地图 → **保存**（或点 **恢复真实定位** 让脚本放行），关开定位服务生效（Loon 约 60 秒内刷新缓存）。

自定义域名：Cloudflare Dashboard → Workers → 你的 Worker → Settings → Domains。

> 数据存在 Workers **KV**（非本地文件），秒级最终一致，保存后最多约 60 秒生效；HTTPS 无需自己管理。

## 常见问题

**定位一直不变？** 按顺序查：
1. **证书信任设置里的开关**有没有真的打开（第三步，最常见）。
2. 模块是否在「模块」里且**已启用**（右侧 ✓）。
3. HTTPS 解密是否打开、四个苹果域名是否都在。
4. **有没有多试几次关/开定位**（苹果缓存重，往往要重复几遍）。
5. 把 `debug=false` 改成 `debug=true`，看日志有没有拦到 `wloc` 请求 —— 能看到就说明拦截成功。

**导入后域名没自动出现？** 在 HTTPS 解密页面手动加那四个域名并保存。

**可以恢复真实定位吗？** 可以。关掉模块（取消 ✓）或关代理总开关，再按第4步刷新一次即可。

**Apple News / 依赖区域的服务还判定我在原位置？** 部分应用还依赖 iOS 系统服务。打开 **设置 → 隐私与安全性 → 定位服务 → 系统服务**，把里面开关全部打开（尤其「基于位置的 Apple 广告」「重要地点」「iPhone 分析」「路由与流量」「提升地图准确性」），再关开一次定位。

## 目录结构

```
.                              # 仓库根目录 = Cloudflare Worker（网页地图选点）
├── src/
│   └── index.js               # Worker：API + 内联的地图选点网页（自包含单文件）
├── wrangler.jsonc             # Worker + KV 配置
├── package.json
├── .dev.vars.example          # 复制为 .dev.vars 供本地开发
└── scripts/                   # 各代理软件的定位修改模块
    ├── location-spoofer.js                 # 核心脚本（四平台共用）
    ├── location-spoofer-qx.js              # Quantumult X 专用
    ├── location-spoofer-config.json        # 配置样板
    ├── ios-location-spoofer.sgmodule       # Shadowrocket
    ├── ios-location-spoofer-surge.sgmodule # Surge（参数化 UI）
    ├── ios-location-spoofer.lnplugin       # Loon
    ├── ios-location-spoofer.snippet        # Quantumult X
    └── ios-location-spoofer.stoverride     # Stash
```

## 参考项目与许可

本项目基于 [acheong08/ios-location-spoofer](https://github.com/acheong08/ios-location-spoofer) 的核心研究（原版是 Go 写的独立 iOS App，自建 VPN + MITM）。本仓库将其移植为 JavaScript，适配五个代理平台，并新增：多平台支持、蜂窝基站坐标修改（字段 22/24，不止 WiFi）、多响应格式兼容、运动状态伪造。

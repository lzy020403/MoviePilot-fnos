# MoviePilot fnOS Native Pack (`fnos/`)

飞牛原生 FPK 打包层。上游 MoviePilot 源码保持不动；本目录只放 manifest / 生命周期脚本 / UI 入口 / 网关与免登适配。

## 版本号

- **本体**（`version.py`）：与上游发布一致，如 `v3.2.13`。
- **飞牛 FPK**（`fnos/manifest`）：`{上游去掉 v}-{迭代}`  
  - 对齐新上游后首包：`3.2.13-1`  
  - 只改本目录再打：`3.2.13-2`…  
  - 下次对齐 `v3.2.14`：重置为 `3.2.14-1`
- 打包脚本 `scripts/bump-version.js` 只递增 `-` 后的迭代号。
- 历史 `0.2.x` 为早期自研序号，已废弃。

当前目标上游：**v3.2.13**；当前 FPK：**3.2.13-1**。

## 我们做了什么

把 MoviePilot 做成**原生 Native FPK**（不是 Docker 模板），并接到飞牛统一网关：

| 能力 | 说明 |
| --- | --- |
| 统一网关入口 | `/app/moviepilot` → `app.sock`；业务 Web/API 只听 `127.0.0.1` |
| 飞牛免登（A1） | 网关注入 `X-Trim-Userid` / `X-Trim-Username` / `X-Trim-Isadmin`，签发 MoviePilot JWT |
| 继承管理员 | `X-Trim-Isadmin=true` → MoviePilot `is_superuser`（头像显示「管理员」）；普通飞牛用户为「普通用户」 |
| 普通用户默认可订阅 | SSO 建号时写入 `discovery/search/subscribe` 等权限；避免「接口有订阅、页面看不到」 |
| SSO 会话同步 | `index.html` bootstrap 每次刷新 `localStorage` 的 `auth` **和** `user`（含 permissions） |
| 插件依赖可用 | 预打包把 `uv` 放进 `venv/bin`，安装即用，不必再找系统 uv |
| 自带运行时 | 包内 Python 3.14 + 预装 deps/frontend/resources/cloakbrowser |

相关代码主要在：

- `overlays/fnos_gateway.py` — `/api/v1/fnos/gateway-session`
- `app/gateway/server.js` — sock 反代、透传 Trim Header
- `scripts/apply-fnos-gateway.sh` — 注入前端免登 bootstrap
- `scripts/prepack-deps.sh` — 预装依赖并烘焙 `uv`
- `cmd/main` — 启停 loopback MP + gateway

> 头像里的「普通用户 / 管理员」只表示是否超管，不等于有没有订阅权限。普通用户在修好权限后应能看到**自己的**订阅；超管可看全部。

### 使用提示（国内网络）

- TMDB 默认域名在部分网络下很慢；可在 `app.env` 设 `TMDB_API_DOMAIN=api.tmdb.org`，或配置代理。
- CustomHosts 改 `/etc/hosts` 需要 root；原生应用以 `moviepilot` 用户运行时通常写不了系统 hosts，优先改 API 域名/代理，不必依赖该插件。

## 运行时

包内自带 **Python 3.14**（astral `python-build-standalone`，linux x86_64），**不依赖**飞牛应用中心的 `python314`。

构建时由 `scripts/fetch-python-runtime.js` 下载到 `fnos/app/runtime/python/`（gitignore，不进仓库）。

## 构建

在仓库根目录（`moviepilot-fnos/`）：

```powershell
.\scripts\deploy-fnos.ps1
```

或用工作区 helper：`tool/ssh-helper/deploy-fpk-moviepilot.js`（飞牛机 `fnpack --nosign`，构建根目录默认 `/vol1/1000/moviepilot-fpk-build`）。

每次打包会自动把 `fnos/manifest` 的 **`-x` 迭代 +1**（可用 `-SkipVersionBump` / `SKIP_VERSION_BUMP=1` 跳过）。对齐新上游后请先手写成 `{upstream}-1`。

产物：

- `releases/moviepilot-<ver>.fpk`（版本化，如 `moviepilot-3.2.13-1.fpk`）
- `moviepilot.fpk`（最新副本，方便安装）

流程：版本自增 → 拉 Python 运行时 → 组装 `fnos/app/server` → SSH 上传 → 飞牛机 **预装 deps/frontend/resources/cloakbrowser** → `fnpack --nosign` → 写入 `releases/`。

预打包会显著增大 FPK、拉长打包时间，但安装后可直接启动，无需再等首启 `uv sync`。调试可用 `SKIP_PREPACK=1` 跳过预装。

预打包缓存落在项目目录（gitignore，跨次打包复用，避免每次重下 Chromium）：

- `moviepilot-fnos/.cache/cloakbrowser`
- `moviepilot-fnos/.cache/uv`

预打包默认走国内镜像加速：

- PyPI：默认清华 `https://pypi.tuna.tsinghua.edu.cn/simple`（失败会再试阿里云；可用 `PIP_PROXY` 覆盖）
- npm：`https://registry.npmmirror.com`（可用 `NPM_REGISTRY` 覆盖）

## 访问

- 桌面入口：统一网关 `/app/moviepilot`（`app.sock`）；内部 Web/API 仅监听 `127.0.0.1`
- 登录：继承飞牛会话；`X-Trim-Isadmin=true` → MoviePilot 超管
- 配置：`data-share moviepilot/config`
- 浏览器内核缓存：`data-share moviepilot/core`

## 分支约定

- `v3`：仅对齐上游，不提交本目录
- `main`：本打包层所在分支（默认分支）；合并上游时保留 `fnos/`

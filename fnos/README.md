# MoviePilot fnOS Native Pack (`fnos/`)

飞牛原生 FPK 打包层。上游 MoviePilot 源码保持不动；本目录只放 manifest / 生命周期脚本 / UI 入口。

## 构建

在仓库根目录（`moviepilot-fnos/`）：

```powershell
.\scripts\deploy-fnos.ps1
```

流程：本机 `scripts/build-payload.js` 组装 `fnos/app/server` → SSH 上传 → 飞牛机 `fnpack --nosign`。

## 安装依赖

- `python314`（manifest `install_dep_apps`）
- 安装回调会用官方 `moviepilot install deps|frontend`（需外网拉依赖/前端）

## 访问

- 桌面入口：端口 `3000`
- 配置：`data-share moviepilot/config`
- 浏览器内核缓存：`data-share moviepilot/core`

## 分支约定

- `v3`：仅对齐上游，不提交本目录
- `main`：本打包层所在分支（默认分支）

# MoviePilot fnOS Native Pack (`fnos/`)

飞牛原生 FPK 打包层。上游 MoviePilot 源码保持不动；本目录只放 manifest / 生命周期脚本 / UI 入口。

## 运行时

包内自带 **Python 3.14**（astral `python-build-standalone`，linux x86_64），**不依赖**飞牛应用中心的 `python314`。

构建时由 `scripts/fetch-python-runtime.js` 下载到 `fnos/app/runtime/python/`（gitignore，不进仓库）。

## 构建

在仓库根目录（`moviepilot-fnos/`）：

```powershell
.\scripts\deploy-fnos.ps1
```

流程：拉 Python 运行时 → 组装 `fnos/app/server` → SSH 上传 → 飞牛机 `fnpack --nosign`。

## 访问

- 桌面入口：端口 `3000`
- 配置：`data-share moviepilot/config`
- 浏览器内核缓存：`data-share moviepilot/core`

## 分支约定

- `v3`：仅对齐上游，不提交本目录
- `main`：本打包层所在分支（默认分支）

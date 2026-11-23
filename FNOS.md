# fnOS 原生适配说明

本仓库的 **`v3` 分支只用于对齐上游 MoviePilot**，不提交飞牛适配。

适配代码全部在 **`main` 分支** 的 [`fnos/`](fnos/) 目录（及 `scripts/build-payload.js`、`scripts/fetch-python-runtime.js`、`scripts/deploy-fnos.ps1`）。

运行时：**包内捆绑 Python 3.14**（不依赖飞牛 `python314` 应用）。

详细打包与部署见 [fnos/README.md](fnos/README.md)。

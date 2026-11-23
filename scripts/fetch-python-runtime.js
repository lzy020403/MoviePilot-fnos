/**
 * Fetch Linux x86_64 CPython 3.14 standalone into the pack.
 *
 * On Windows (esp. SMB): only stage the .tar.gz as
 *   fnos/app/runtime/python.tgz
 * Extraction of Linux symlinks happens on fnOS before fnpack.
 *
 * Env:
 *   SKIP_PYTHON_FETCH=1
 *   FORCE_PYTHON_FETCH=1
 *   PYTHON_STANDALONE_URL=
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const runtimeRoot = path.join(root, "fnos", "app", "runtime");
const stagedTar = path.join(runtimeRoot, "python.tgz");
const cacheDir = path.join(root, ".runtime-cache");
const cacheTar = path.join(cacheDir, "cpython-3.14-linux-x86_64.tar.gz");

const DEFAULT_URL =
  "https://github.com/astral-sh/python-build-standalone/releases/download/20251202/cpython-3.14.1%2B20251202-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz";

function downloadWithCurl(url, dest) {
  const curl = process.platform === "win32" ? "curl.exe" : "curl";
  const args = ["-fsSL", "--retry", "3", "-o", dest, url];
  if (process.platform === "win32") args.splice(1, 0, "--ssl-no-revoke");
  const r = spawnSync(curl, args, { stdio: "inherit", shell: false });
  if (r.status !== 0) {
    throw new Error(`${curl} download failed with exit ${r.status}`);
  }
}

function main() {
  const minBytes = 5 * 1024 * 1024;
  if (
    process.env.SKIP_PYTHON_FETCH === "1" &&
    fs.existsSync(stagedTar) &&
    fs.statSync(stagedTar).size >= minBytes
  ) {
    console.log("==> SKIP_PYTHON_FETCH=1, reuse", stagedTar);
    return;
  }

  const url = process.env.PYTHON_STANDALONE_URL || DEFAULT_URL;
  fs.mkdirSync(cacheDir, { recursive: true });

  const cachedOk =
    fs.existsSync(cacheTar) && fs.statSync(cacheTar).size >= minBytes;
  if (!cachedOk || process.env.FORCE_PYTHON_FETCH === "1") {
    console.log("==> download", url);
    if (fs.existsSync(cacheTar)) fs.rmSync(cacheTar);
    downloadWithCurl(url, cacheTar);
  } else {
    console.log("==> reuse cache", cacheTar);
  }

  const tarSize = fs.statSync(cacheTar).size;
  console.log(`tar size: ${tarSize} bytes`);
  if (tarSize < minBytes) {
    throw new Error(`python tarball too small (${tarSize}); download failed`);
  }

  fs.mkdirSync(runtimeRoot, { recursive: true });
  // Drop any half-extracted tree from previous attempts.
  const extracted = path.join(runtimeRoot, "python");
  if (fs.existsSync(extracted)) {
    fs.rmSync(extracted, { recursive: true, force: true });
  }
  fs.copyFileSync(cacheTar, stagedTar);
  fs.writeFileSync(
    path.join(runtimeRoot, "VERSION.txt"),
    `source=${url}\nstaged=${stagedTar}\nfetched_at=${new Date().toISOString()}\n`
  );
  console.log("==> staged for fnOS extract:", stagedTar);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}

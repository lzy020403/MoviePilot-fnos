/**
 * Prepare fnos/app/server payload from the MoviePilot source tree,
 * and ensure bundled Linux Python 3.14 is under fnos/app/runtime.
 * Does not run fnpack (pack on fnOS via deploy-fnos.ps1).
 *
 * Env:
 *   SKIP_VERSION_BUMP=1  keep manifest version
 *   SKIP_PYTHON_FETCH=1  reuse existing bundled runtime
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const packDir = path.join(root, "fnos");
const serverDir = path.join(packDir, "app", "server");
const manifestPath = path.join(packDir, "manifest");
const stagedPythonTar = path.join(packDir, "app", "runtime", "python.tgz");

const INCLUDE = [
  "app",
  "config",
  "database",
  "docs",
  "frontend-dist",
  "native",
  "scripts",
  "skills",
  "moviepilot",
  "pyproject.toml",
  "uv.lock",
  "version.py",
  "LICENSE",
  "README.md",
  "mypy.ini",
  "pytest.ini"
];

const EXCLUDE_DIR_NAMES = new Set([
  ".git",
  ".venv",
  "venv",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  "fnos",
  "tests",
  "docker",
  ".idea",
  ".vscode",
  ".claude",
  "htmlcov",
  "cython_cache",
  "build",
  "dist",
  ".runtime",
  ".artifacts",
  ".verify_tmp"
]);

function bumpManifest() {
  if (process.env.SKIP_VERSION_BUMP === "1") {
    console.log("==> SKIP_VERSION_BUMP=1");
    return;
  }
  const text = fs.readFileSync(manifestPath, "utf8");
  const m = text.match(/^version=(.+)$/m);
  if (!m) throw new Error("manifest version not found");
  const parts = m[1].trim().split(".").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`bad version: ${m[1]}`);
  }
  parts[2] += 1;
  const next = parts.join(".");
  fs.writeFileSync(manifestPath, text.replace(/^version=.*$/m, `version=${next}`));
  console.log(`==> manifest version -> ${next}`);
}

function shouldSkip(src) {
  const rel = path.relative(root, src);
  if (!rel || rel.startsWith("..")) return false;
  const segs = rel.split(path.sep);
  return segs.some((s) => EXCLUDE_DIR_NAMES.has(s));
}

function emptyDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyFiltered(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      const from = path.join(src, name);
      if (shouldSkip(from)) continue;
      copyFiltered(from, path.join(dest, name));
    }
    return;
  }
  fs.copyFileSync(src, dest);
}

console.log("==> bump manifest");
bumpManifest();

console.log("==> stage bundled Python 3.14 tarball (extract on fnOS)");
try {
  execSync("node scripts/fetch-python-runtime.js", {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env
  });
} catch (err) {
  console.warn(
    "==> local python stage failed; deploy will download on fnOS before fnpack"
  );
  console.warn(String(err && err.message ? err.message : err));
}
if (!fs.existsSync(stagedPythonTar)) {
  console.warn("==> python.tgz not staged yet:", stagedPythonTar);
}

console.log("==> assemble fnos/app/server");
emptyDir(serverDir);

for (const name of INCLUDE) {
  const from = path.join(root, name);
  if (!fs.existsSync(from)) {
    console.warn(`skip missing: ${name}`);
    continue;
  }
  const to = path.join(serverDir, name);
  console.log(`  copy ${name}`);
  copyFiltered(from, to);
}

// Ensure CLI is executable bit is set later on Linux; keep a marker for empty frontend-dist.
const feKeep = path.join(serverDir, "frontend-dist", ".gitkeep");
fs.mkdirSync(path.dirname(feKeep), { recursive: true });
if (!fs.existsSync(feKeep)) fs.writeFileSync(feKeep, "");

const required = ["moviepilot", "pyproject.toml", "uv.lock", "app"];
for (const name of required) {
  if (!fs.existsSync(path.join(serverDir, name))) {
    throw new Error(`payload missing required: ${name}`);
  }
}

console.log("==> payload ready:", serverDir);

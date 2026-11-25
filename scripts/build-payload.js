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
  // Delegate to bump-version.js ({upstream}-{iter} scheme).
  require("./bump-version").bump();
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

function stripCrInPlace(filePath) {
  const buf = fs.readFileSync(filePath);
  if (!buf.includes(0x0d)) return false;
  fs.writeFileSync(filePath, Buffer.from(buf.filter((b) => b !== 0x0d)));
  return true;
}

function stripCrTree(dir) {
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "venv" || ent.name === "node_modules") continue;
      n += stripCrTree(p);
      continue;
    }
    const lower = ent.name.toLowerCase();
    const looksShell =
      lower === "moviepilot" ||
      lower.endsWith(".sh") ||
      lower.endsWith(".bash") ||
      (!lower.includes(".") && ent.name === "moviepilot");
    if (!looksShell) continue;
    // Only rewrite if file starts with shebang
    const fd = fs.openSync(p, "r");
    const head = Buffer.alloc(2);
    fs.readSync(fd, head, 0, 2, 0);
    fs.closeSync(fd);
    if (head.toString("utf8") !== "#!") continue;
    if (stripCrInPlace(p)) n += 1;
  }
  return n;
}

console.log("==> strip CRLF from shell scripts in payload");
const stripped = stripCrTree(serverDir);
console.log(`  stripped ${stripped} files`);

// Also ensure pack lifecycle scripts are LF (Windows checkout may reintroduce CR).
const cmdDir = path.join(packDir, "cmd");
if (fs.existsSync(cmdDir)) {
  for (const name of fs.readdirSync(cmdDir)) {
    const p = path.join(cmdDir, name);
    if (fs.statSync(p).isFile() && stripCrInPlace(p)) {
      console.log(`  stripped cmd/${name}`);
    }
  }
}

console.log("==> payload ready:", serverDir);

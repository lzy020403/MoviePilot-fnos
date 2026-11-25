/**
 * 打包前升高飞牛 FPK 自迭代号。
 *
 * 格式：{上游版本}-{迭代}，例如 3.2.13-1 -> 3.2.13-2
 * 对齐新上游后应手动设为 {新上游}-1，不要用本脚本改上游段。
 *
 * SKIP_VERSION_BUMP=1 可跳过。
 */
const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "fnos", "manifest");

function readVersion() {
  const text = fs.readFileSync(manifestPath, "utf8");
  const match = text.match(/^version\s*=\s*([^\r\n]+)/m);
  if (!match) throw new Error(`version field not found in ${manifestPath}`);
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function parseFpkVersion(current) {
  const m = String(current).trim().match(/^(\d+\.\d+\.\d+)-(\d+)$/);
  if (!m) {
    throw new Error(
      `unsupported FPK version "${current}"; expected {upstream}-{iter} like 3.2.13-1 (align upstream first)`
    );
  }
  return { upstream: m[1], iter: Number(m[2]) };
}

function bump() {
  if (process.env.SKIP_VERSION_BUMP === "1") {
    const current = readVersion();
    console.log("SKIP_VERSION_BUMP=1");
    return { current, next: current };
  }

  let text = fs.readFileSync(manifestPath, "utf8");
  const match = text.match(/^version\s*=\s*([^\r\n]+)/m);
  if (!match) {
    throw new Error(`version field not found in ${manifestPath}`);
  }

  const current = match[1].trim().replace(/^["']|["']$/g, "");
  const { upstream, iter } = parseFpkVersion(current);
  const next = `${upstream}-${iter + 1}`;
  text = text.replace(/^version\s*=\s*[^\r\n]+/m, `version=${next}`);
  fs.writeFileSync(manifestPath, text);
  console.log(`version: ${current} -> ${next}`);
  return { current, next };
}

if (require.main === module) {
  bump();
}

module.exports = { bump, readVersion, parseFpkVersion };

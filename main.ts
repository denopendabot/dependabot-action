/*/ 2> /dev/null
set -e
bun_version='1.0.8'
case $RUNNER_ARCH in
  X86) arch=ia32 ;;
  X64) arch=x64 ;;
  ARM) arch=arm ;;
  ARM64) arch=arm64 ;;
esac
bun_install="$RUNNER_TOOL_CACHE/bun/$version/$arch"
if [ ! -d "$bun_install" ]; then
  if ! o=$(curl -fsSL https://bun.sh/install | BUN_INSTALL="$bun_install" bash -s "bun-v$bun_version" 2>&1); then
    echo "$o" >&2
    exit 1
  fi
fi
exec "$bun_install/bin/bun" "$0" "$@"
# */

import * as core from "@actions/core";
import * as github from "@actions/github";
import * as tc from "@actions/tool-cache";
import { $ } from "execa";

const version = "1.39.0+1";
let found = tc.find("denopendabot+dependabot", version);
if (!found) {
  const file = {
    "darwin,arm64": `dependabot-v${version}-darwin-arm64.tar.gz`,
    "darwin,x64": `dependabot-v${version}-darwin-amd64.tar.gz`,
    "win32,x64": `dependabot-v${version}-windows-amd64.zip`,
    "linux,x64": `dependabot-v${version}-linux-amd64.tar.gz`,
  }[[process.platform, process.arch].toString()]!;
  let extracted: string;
  if (file.endsWith(".zip")) {
    const zip = await tc.downloadTool(
      `https://github.com/denopendabot/cli/releases/download/v${version}/${file}`
    );
    extracted = await tc.extractZip(zip);
  } else {
    const tar = await tc.downloadTool(
      `https://github.com/denopendabot/cli/releases/download/v${version}/${file}`
    );
    extracted = await tc.extractTar(tar);
  }
  found = await tc.cacheDir(extracted, "denopendabot+dependabot", version);
}
await $({ stdio: "inherit" })`tree ${found}`;
// const dependabot = `${found}/dependabot`;

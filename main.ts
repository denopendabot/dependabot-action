/*/ 2> /dev/null
set -e
deno_version='1.38.0'
case $RUNNER_ARCH in
  X86) arch=ia32 ;;
  X64) arch=x64 ;;
  ARM) arch=arm ;;
  ARM64) arch=arm64 ;;
esac
deno_install="$RUNNER_TOOL_CACHE/deno/$version/$arch"
if [ ! -d "$deno_install" ]; then
  if ! o=$(curl -fsSL https://deno.land/x/install/install.sh | DENO_INSTALL="$deno_install" sh -s "v$deno_version" 2>&1); then
    echo "$o" >&2
    exit 1
  fi
fi
exec "$deno_install/bin/deno" run -A "$0" "$@"
# */

import * as core from "npm:@actions/core";
import * as github from "npm:@actions/github";
import * as tc from "npm:@actions/tool-cache";
import { $ } from "npm:execa";
import process from "node:process";

// Hack to get 'http.globalAgent' to work in @actions/http-client
// https://github.com/denoland/deno/issues/18312
// https://github.com/denoland/deno/issues/21080
import http from "node:http";
import https from "node:https";
http.globalAgent = https.globalAgent;

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

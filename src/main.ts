import * as core from "@actions/core";
import * as github from "@actions/github";
import * as tc from "@actions/tool-cache";
import { $ } from "execa";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// const version = "1.39.0+1";
const version = "1.39.0";
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
      // `https://github.com/denopendabot/cli/releases/download/v${version}/${file}`
      `https://github.com/dependabot/cli/releases/download/v${version}/${file}`
    );
    extracted = await tc.extractZip(zip);
  } else {
    const tar = await tc.downloadTool(
      // `https://github.com/denopendabot/cli/releases/download/v${version}/${file}`
      `https://github.com/dependabot/cli/releases/download/v${version}/${file}`
    );
    extracted = await tc.extractTar(tar);
  }
  found = await tc.cacheDir(extracted, "denopendabot+dependabot", version);
}
const dependabot = `${found}/dependabot`;

const jobPath = join(process.env.RUNNER_TEMP!, "job.yaml");
const job = `\
# job.yaml
job:
  package-manager: npm_and_yarn
  allowed-updates:
    - update-type: all
  source:
    provider: github
    repo: ${github.context.repo.owner}/${github.context.repo.repo}
    directory: /test/
    commit: ${github.context.sha}
`;
await writeFile(jobPath, job);

const $i = $({ stdio: "inherit" });

await $i`${dependabot} --version`;
await $i`${dependabot} update --file ${jobPath}`;

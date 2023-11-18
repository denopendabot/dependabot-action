import * as core from "@actions/core";
import * as github from "@actions/github";
import * as tc from "@actions/tool-cache";
import { $ } from "execa";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as YAML from "yaml";
import dedent from "./dedent.js";

const $i = $({ stdio: "inherit" });
const token = core.getInput("token");
const repository = core.getInput("repository");
const sha = core.getInput("sha");
process.env.GITHUB_TOKEN = token; // gh
process.env.LOCAL_GITHUB_ACCESS_TOKEN = token; // dependabot

const workspace = join(process.env.RUNNER_TEMP!, "denopendabot-workspace");
await mkdir(workspace, { recursive: true });
process.chdir(workspace);

const dependabot = (async () => {
  const version = "1.40.0";
  let found = tc.find("denopendabot_cli", version);
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
    found = await tc.cacheDir(extracted, "denopendabot_cli", version);
  }
  const dependabot = join(found, "dependabot");
  await $i`${dependabot} --version`;
  return dependabot;
})();

await $i`gh auth setup-git`;
await $i`git clone https://github.com/${repository}.git .`;
await $i`git checkout ${github.context.sha}`;

const yaml = (strings, ...inserts) =>
  YAML.parse(dedent(strings, ...inserts.map((x) => JSON.stringify(x))));

async function loadDenopendabot() {
  const denopendabot = YAML.parse(await readFile(".github/denopendabot.yml"));
  // assert()
  return denopendabot;
}

function createJob(denopendabot: any) {
  return yaml`
    job:
      package-manager: deno
      allowed-updates:
        - update-type: all
      source:
        provider: github
        repo: ${repository}
        commit: ${sha}
        directory: ${denopendabot?.updates?.[0]?.directory ?? "/"}
  `;
}

async function runJob(job: any) {
  const jobPath = join(process.env.RUNNER_TEMP!, "job.yaml");
  await writeFile(jobPath, YAML.stringify(job));

  const outputPath = join(process.env.RUNNER_TEMP!, "output.yaml");
  await $i`${dependabot} update --file ${jobPath} --output ${outputPath}`;

  const { input, output } = YAML.parse(await readFile(outputPath, "utf8"));
  return output;
}

const output = (async () => {
  const denopendabot = await loadDenopendabot();
  const job = createJob(denopendabot);
  return await runJob(job);
})();

async function createPullRequest(data: any) {
  for (const item of data["updated-dependency-files"]) {
    core.info(`processing ${item.operation}`);
    switch (item.operation) {
      case "update":
        await writeFile(
          join(".", item.directory, item.name),
          item.content,
          item.content_encoding
        );
      default:
        core.warning(`${item.operation} not known`);
    }
  }

  const { stdout: before } = await $`git rev-parse HEAD`;

  const branch = `denopendabot/${Math.random().toString(36).slice(2)}`;
  await $i`git checkout -b ${branch}`;

  await $i`git add --all`;

  process.env.GIT_AUTHOR_NAME = "github-actions[bot]";
  process.env.GIT_AUTHOR_EMAIL = "github-actions[bot]@users.noreply.github.com";
  process.env.GIT_COMMITTER_NAME = "github-actions[bot]";
  process.env.GIT_COMMITTER_EMAIL =
    "github-actions[bot]@users.noreply.github.com";
  await $i`git commit --message ${pullrequest.expect.data["commit-message"]}`;

  await $i`git push origin HEAD:${branch} --force --set-upstream`;

  await $i`git checkout ${before}`;
}

for (const thing of output) {
  core.info(`processing ${thing.type}`);
  switch (thing.type) {
    case "create_pull_request":
      await createPullRequest(thing.expect.data);
      break;
    default:
      core.warning(`${thing.type} not known`);
      break;
  }
}

import * as core from "@actions/core";
import * as github from "@actions/github";
import * as tc from "@actions/tool-cache";
import { $ } from "execa";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as YAML from "yaml";

const version = "1.40.0+1";
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
const dependabot = `${found}/dependabot`;

process.env.LOCAL_GITHUB_ACCESS_TOKEN = core.getInput("token");
process.env.GITHUB_TOKEN = core.getInput("token");
const $i = $({ stdio: "inherit" });

const tempdir = join(process.env.RUNNER_TEMP!, "denopendabot");
await mkdir(tempdir, { recursive: true });
process.chdir(tempdir);
await $i`gh auth setup-git`;
await $i`gh repo clone ${github.context.repo.owner}/${github.context.repo.repo} .`;
await $i`git checkout ${github.context.sha}`;

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
    directory: /test-npm
    commit: ${github.context.sha}
`;
await writeFile(jobPath, job);

const outputPath = join(process.env.RUNNER_TEMP!, "output.yaml");

await $i`${dependabot} --version`;
await $i`${dependabot} update --file ${jobPath} --output ${outputPath}`;

const outputyaml = YAML.parse(await readFile(outputPath, "utf8"));
console.log(YAML.stringify(outputyaml));

/* Example of output.yml:

input:
    job:
        package-manager: npm_and_yarn
        allowed-updates:
            - update-type: all
        ignore-conditions:
            - dependency-name: typescript
              source: /workspaces/dependabot-action/test-npm/output.yaml
              version-requirement: '>5.2.2'
        source:
            provider: github
            repo: denopendabot/dependabot-action
            directory: /test-npm
            commit: b9d2fa27273b8d79bba2c30933827cb416704eb8
output:
    - type: update_dependency_list
      expect:
        data:
            dependencies:
                - name: typescript
                  requirements:
                    - file: package.json
                      groups:
                        - dependencies
                      requirement: ^1.0.0
                      source:
                        type: registry
                        url: https://registry.npmjs.org
                  version: 1.8.10
            dependency_files:
                - /test-npm/package.json
                - /test-npm/package-lock.json
    - type: create_pull_request
      expect:
        data:
            base-commit-sha: b9d2fa27273b8d79bba2c30933827cb416704eb8
            dependencies:
                - name: typescript
                  previous-requirements:
                    - file: package.json
                      groups:
                        - dependencies
                      requirement: ^1.0.0
                      source:
                        type: registry
                        url: https://registry.npmjs.org
                  previous-version: 1.8.10
                  requirements:
                    - file: package.json
                      groups:
                        - dependencies
                      requirement: ^5.2.2
                      source:
                        type: registry
                        url: https://registry.npmjs.org
                  version: 5.2.2
            updated-dependency-files:
                - content: |
                    {
                      "dependencies": {
                        "typescript": "^5.2.2"
                      }
                    }
                  content_encoding: utf-8
                  deleted: false
                  directory: /test-npm
                  name: package.json
                  operation: update
                  support_file: false
                  type: file
                - content: |
                    {
                      "name": "test-npm",
                      "lockfileVersion": 3,
                      "requires": true,
                      "packages": {
                        "": {
                          "dependencies": {
                            "typescript": "^5.2.2"
                          }
                        },
                        "node_modules/typescript": {
                          "version": "5.2.2",
                          "resolved": "https://registry.npmjs.org/typescript/-/typescript-5.2.2.tgz",
                          "integrity": "sha512-mI4WrpHsbCIcwT9cF4FZvr80QUeKvsUsUvKDoR+X/7XHQH98xYD8YHZg7ANtz2GtZt/CBq2QJ0thkGJMHfqc1w==",
                          "bin": {
                            "tsc": "bin/tsc",
                            "tsserver": "bin/tsserver"
                          },
                          "engines": {
                            "node": ">=14.17"
                          }
                        }
                      }
                    }
                  content_encoding: utf-8
                  deleted: false
                  directory: /test-npm
                  name: package-lock.json
                  operation: update
                  support_file: false
                  type: file
            pr-title: Bump typescript from 1.8.10 to 5.2.2 in /test-npm
            pr-body: |
                Bumps [typescript](https://github.com/Microsoft/TypeScript) from 1.8.10 to 5.2.2.
                <details>
                <summary>Release notes</summary>
                <p><em>Sourced from <a href="https://github.com/Microsoft/TypeScript/releases">typescript's releases</a>.</em></p>
                <blockquote>
                <h2>TypeScript 5.2</h2>
                <p>For release notes, check out the <a href="https://devblogs.microsoft.com/typescript/announcing-typescript-5-2/">release announcement</a>.</p>
                <p>For the complete list of fixed issues, check out the</p>
                <ul>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.2.0%22+is%3Aclosed+">fixed issues query for Typescript 5.2.0 (Beta)</a>.</li>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.2.1%22+is%3Aclosed+">fixed issues query for Typescript 5.2.1 (RC)</a>.</li>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.2.2%22+is%3Aclosed+">fixed issues query for Typescript 5.2.2 (Stable)</a>.</li>
                </ul>
                <p>Downloads are available on:</p>
                <ul>
                <li><a href="https://www.nuget.org/packages/Microsoft.TypeScript.MSBuild">NuGet package</a></li>
                </ul>
                <h2>TypeScript 5.2 RC</h2>
                <p>For release notes, check out the <a href="https://devblogs.microsoft.com/typescript/announcing-typescript-5-2-rc/">release announcement</a>.</p>
                <p>For the complete list of fixed issues, check out the</p>
                <ul>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.2.0%22+is%3Aclosed+">fixed issues query for Typescript 5.2.0 (Beta)</a>.</li>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.2.1%22+is%3Aclosed+">fixed issues query for Typescript 5.2.1 (RC)</a>.</li>
                </ul>
                <p>Downloads are available on:</p>
                <ul>
                <li><a href="https://www.nuget.org/packages/Microsoft.TypeScript.MSBuild">NuGet package</a></li>
                </ul>
                <h2>TypeScript 5.2 Beta</h2>
                <p>For release notes, check out the <a href="https://devblogs.microsoft.com/typescript/announcing-typescript-5-2-beta/">release announcement</a>.</p>
                <p>For the complete list of fixed issues, check out the</p>
                <ul>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.2.0%22+is%3Aclosed+">fixed issues query for Typescript v5.2.0 (Beta)</a>.</li>
                </ul>
                <p>Downloads are available on <a href="https://www.npmjs.com/package/typescript">npm</a>.</p>
                <h2>TypeScript 5.1.6</h2>
                <p>For release notes, check out the <a href="https://devblogs.microsoft.com/typescript/announcing-typescript-5-1/">release announcement</a>.</p>
                <p>For the complete list of fixed issues, check out the</p>
                <ul>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.1.0%22+is%3Aclosed+">fixed issues query for Typescript v5.1.0 (Beta)</a>.</li>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.1.1%22+is%3Aclosed+">fixed issues query for Typescript v5.1.1 (RC)</a>.</li>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.1.2%22+is%3Aclosed+">fixed issues query for Typescript v5.1.2 (Stable)</a>.</li>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.1.3%22+is%3Aclosed+">fixed issues query for Typescript v5.1.3 (Stable)</a>.</li>
                <li>(5.1.4 <a href="https://redirect.github.com/microsoft/TypeScript/issues/53031#issuecomment-1610038922">intentionally skipped</a>)</li>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.1.5%22+is%3Aclosed+">fixed issues query for Typescript v5.1.5 (Stable)</a>.</li>
                <li><a href="https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+5.1.6%22+is%3Aclosed+">fixed issues query for Typescript v5.1.6 (Stable)</a>.</li>
                </ul>
                <p>Downloads are available on <a href="https://www.npmjs.com/package/typescript">npm</a></p>
                <h2>TypeScript 5.1.5</h2>
                <!-- raw HTML omitted -->
                </blockquote>
                <p>... (truncated)</p>
                </details>
                <details>
                <summary>Commits</summary>
                <ul>
                <li><a href="https://github.com/microsoft/TypeScript/commit/9684ba6b0d73c37546ada901e5d0a5324de7fc1d"><code>9684ba6</code></a> Cherry-pick fix for cross-file inlay hints (<a href="https://redirect.github.com/Microsoft/TypeScript/issues/55476">#55476</a>) to <code>release-5.2</code> and LKG ...</li>
                <li><a href="https://github.com/microsoft/TypeScript/commit/555ef99d037547da48b8f7e4c629f571b706d1d5"><code>555ef99</code></a> Bump version to 5.2.2 and LKG</li>
                <li><a href="https://github.com/microsoft/TypeScript/commit/6074b9d12b70757fe68ab2b4da059ea363c4df04"><code>6074b9d</code></a> Update LKG for 5.2.1 RC.</li>
                <li><a href="https://github.com/microsoft/TypeScript/commit/b778ed1d8fb9ad3c23c191b78be4835437173de2"><code>b778ed1</code></a> Merge commit 'e936eb13d2900f21d79553c32a704307c7ad03dd' into release-5.2</li>
                <li><a href="https://github.com/microsoft/TypeScript/commit/10b9962915de5136de972188046a429b02bfed55"><code>10b9962</code></a> Bump version to 5.2.1-rc and LKG</li>
                <li><a href="https://github.com/microsoft/TypeScript/commit/e936eb13d2900f21d79553c32a704307c7ad03dd"><code>e936eb1</code></a> Update package-lock.json</li>
                <li><a href="https://github.com/microsoft/TypeScript/commit/e36cd5768aa46ed2ce9487cce768222d8ee05a4d"><code>e36cd57</code></a> Update package-lock.json</li>
                <li><a href="https://github.com/microsoft/TypeScript/commit/581fba1f6f85116116a5838e44521b4a99de6bad"><code>581fba1</code></a> Update package-lock.json</li>
                <li><a href="https://github.com/microsoft/TypeScript/commit/8fc8c95830fa826eae2441aaa1e83bd2e06c1705"><code>8fc8c95</code></a> Decorators normative updates (<a href="https://redirect.github.com/Microsoft/TypeScript/issues/55276">#55276</a>)</li>
                <li><a href="https://github.com/microsoft/TypeScript/commit/b1c4dc475cc0419747c6bec43d12f8e6f64e714c"><code>b1c4dc4</code></a> Fix class name references (<a href="https://redirect.github.com/Microsoft/TypeScript/issues/55262">#55262</a>)</li>
                <li>Additional commits viewable in <a href="https://github.com/Microsoft/TypeScript/compare/v1.8.10...v5.2.2">compare view</a></li>
                </ul>
                </details>
                <details>
                <summary>Maintainer changes</summary>
                <p>This version was pushed to npm by <a href="https://www.npmjs.com/~typescript-bot">typescript-bot</a>, a new releaser for typescript since your current version.</p>
                </details>
                <br />
            commit-message: |-
                Bump typescript from 1.8.10 to 5.2.2 in /test-npm

                Bumps [typescript](https://github.com/Microsoft/TypeScript) from 1.8.10 to 5.2.2.
                - [Release notes](https://github.com/Microsoft/TypeScript/releases)
                - [Commits](https://github.com/Microsoft/TypeScript/compare/v1.8.10...v5.2.2)
    - type: mark_as_processed
      expect:
        data:
            base-commit-sha: b9d2fa27273b8d79bba2c30933827cb416704eb8

*/

// Now we need to apply that to the tree.

const output = outputyaml.output as {
  type: string;
  expect: {
    data: {
      dependencies: {
        name: string;
        requirements: {
          file: string;
          groups: string[];
          requirement: string;
          source: {
            type: string;
            url: string;
          };
        }[];
        version: string;
      }[];
      dependency_files: {
        content: string;
        content_encoding: string;
        deleted: boolean;
        directory: string;
        name: string;
        operation: string;
        support_file: boolean;
        type: string;
      }[];
      "pr-title": string;
      "pr-body": string;
      "commit-message": string;
    };
  };
}[];

const pullrequest = output.find((o) => o.type === "create_pull_request")!;

for (const file of pullrequest.expect.data["updated-dependency-files"]) {
  if (file.operation === "update") {
    await writeFile(
      join(".", file.directory, file.name),
      file.content,
      file.content_encoding
    );
  }
}

process.env.GIT_AUTHOR_NAME = "github-actions[bot]";
process.env.GIT_AUTHOR_EMAIL = "github-actions[bot]@users.noreply.github.com";
process.env.GIT_COMMITTER_NAME = "github-actions[bot]";
process.env.GIT_COMMITTER_EMAIL =
  "github-actions[bot]@users.noreply.github.com";
const branch = `denopendabot/${Math.random().toString(36).slice(2)}`;
await $i`git checkout -b ${branch}`;
await $i`git add --all`;
await $i`git commit -m ${pullrequest.expect.data["commit-message"]}`;
await $i`git push origin HEAD:${branch} --force --set-upstream`;

console.log(branch);
console.log(
  `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/tree/${branch}`
);

// let { "pr-title": title, "pr-body": body } = pullrequest.expect.data;
// try {
//   const it =
//     await $`gh pr create --title ${title} --body ${body} --head ${branch} --base main`;
//   console.log(it.stdout);
//   console.error(it.stderr);
// } catch (error) {
//   // if unauthorized due to bad token config, try to create an issue instead
//   if (/unauthorized|403|pull request create failed/i.test(error.stderr)) {
//     console.error(
//       "looks like token is bad or something. did you remember to let github actions bot create prs in settings? attempting to create an issue instead."
//     );
//     console.error(error.stdout);
//     console.error(error.stderr);

//     body =
//       "🛑 could not create pull request\n" +
//       `branch is https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/tree/${branch}\n` +
//       `quick create pr link: ${`https://github.com/${
//         github.context.repo.owner
//       }/${
//         github.context.repo.repo
//       }/compare/main...${branch}?quick_pull=1&title=${title}&body=${encodeURIComponent(
//         body
//       )}`}\n\n`;
//     body;
//     await $i`gh issue create --title ${title} --body ${body}`;
//   } else {
//     throw error;
//   }
// }

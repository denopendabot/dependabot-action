# Dependabot Workflow Action

This action allows one to run a dependabot version update in a workflow. It can be used for a large monorepo that has too many updates to run in the Github UI version or it can be used to run in a self hosted runner that needs access to a VPC that is not available in the Github managed Dependabot.

## Example Usage

``` yaml
name: Dependabot

on:
  workflow_dispatch:
  # Runs on Tuesday at 1:00 AM weekly
  schedule:
    - cron: "0 1 * * 2"

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{!(github.event_name == 'push' && github.ref_name == 'main') }}

jobs:
  dependabot:
    # Replace with your own runner labels
    runs-on: ['self-hosted', 'my-cool-runner']
    # Change this as you see fit but it does take a while
    # for it run through large amounts of dependencies
    timeout-minutes: 240 
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Checkout repo
        uses: actions/checkout@v3

      - name: "Update versions"
        uses: gavinmeiersonos/dependabot-action@v1
        with:
          repo-name: 'GavinMeierSonos/my-outdated-repo'
          github-token: ${{ secrets.MY_GITHUB_WRITE_TOKEN }}
          directory: "./" # can be left blank, defaults to "./"
          branch: "main" # can be left blank, defaults to "main"
          registry: "npm.pkg.github.com" # can be left blank, defaults to "npm.pkg.github.com"
          registry-token: ${{ secrets.MY_GITHUB_WRITE_TOKEN }} # is the same as the github one, if the registry is a github registry
          # If you only need one you can leave this out
          additional-registries: "[{ \"type\": \"npm_registry\", \"registry\": \"my-private.registry.com\", \"token\": \"${{secrets.MY_PRIVATE_REGISTRY_TOKEN}}\",\"replaces_base\": true }]"

```
FROM node:18.16.0-buster AS base

COPY node-helpers .
RUN npm install
RUN DEPENDABOT_NATIVE_HELPERS_PATH=dist ./build

FROM ruby:3.1.4-bullseye AS RUNNER

WORKDIR /usr/action

COPY Gemfile Gemfile
COPY Gemfile.lock Gemfile.lock
COPY src .
COPY --from=base ./dist/ ./native-helpers
COPY --from=base /usr/local/bin/node /usr/local/bin/node

RUN bundle install

ARG REPO_NAME
ARG GITHUB_TOKEN
ARG DIRECTORY="./"
ARG BRANCH="main"
ARG REGISTRY="npm.pkg.github.com"
ARG REGISTRY_TOKEN

ENV REPO_NAME=${REPO_NAME}
ENV GITHUB_TOKEN=${GITHUB_TOKEN}
ENV DIRECTORY=${DIRECTORY}
ENV BRANCH=${BRANCH}
ENV REGISTRY=${REGISTRY}
ENV REGISTRY_TOKEN=${REGISTRY_TOKEN}

CMD ["bundle", "exec", "ruby", "./update-script.rb"]
FROM node:18.16.0-buster AS base

COPY node-helpers .
RUN npm install
RUN DEPENDABOT_NATIVE_HELPERS_PATH=dist ./build

FROM ruby:3.1.4-bullseye AS RUNNER

COPY Gemfile Gemfile.lock ./

# RUN gem install bundler && bundle install

RUN gem install dependabot-omnibus -v 0.228.0


COPY ./src/update-script.rb ./update-script.rb
COPY --from=base ./dist/ ./native-helpers
COPY --from=base /usr/local/bin/node /usr/local/bin/node

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

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

# CMD ["bundle", "exec", "ruby", "./update-script.rb"]
# CMD ["ruby", "./update-script.rb"]
ENTRYPOINT [ "/entrypoint.sh" ]
require "dependabot/file_fetchers"
require "dependabot/file_parsers"
require "dependabot/update_checkers"
require "dependabot/file_updaters"
require "dependabot/pull_request_creator"
require "dependabot/npm_and_yarn"
require "json"
require "dependabot/file_fetchers"

ENV['DEPENDABOT_NATIVE_HELPERS_PATH'] = Dir.pwd + '/native-helpers'

puts ENV.fetch("DEPENDABOT_NATIVE_HELPERS_PATH", nil)

puts "Setting up constants for runner"

repo_name = ENV['REPO_NAME']
directory = ENV['DIRECTORY'] ? ENV['DIRECTORY'] : "./"
branch = ENV['BRANCH'] ? ENV['BRANCH']: "main"
package_manager = "npm_and_yarn"
registry = ENV['REGISTRY'] ? ENV['REGISTRY']: "npm.pkg.github.com"
credentials = [
  {
    "type" => "git_source",
    "host" => "github.com",
    "username" => "x-access-token",
    "password" => ENV["GITHUB_TOKEN"]
  },
  {
    "type" => "npm_registry",
    "registry" => registry,
    "token" => ENV["REGISTRY_TOKEN"],
    "replaces_base" => true
  }
]

maybe_more_creds = ENV['ADDITIONAL_REGISTRIES'] ? ENV['ADDITIONAL_REGISTRIES'] : ""

if maybe_more_creds != ""
    more_creds_to_add = JSON.parse(maybe_more_creds)
    credentials << more_creds_to_add
end


puts "Running with"
puts "REPO_NAME=#{repo_name}"
puts "DIRECTORY=#{directory}"
puts "BRANCH=#{branch}"
puts "PACKAGE_MANAGER=#{package_manager}"
puts "REGISTRY=#{registry}"
puts "ADDITIONAL_REGISTRIES=#{maybe_more_creds}"

puts "Setting up source"
source = Dependabot::Source.new(
  provider: "github",
  repo: repo_name,
  directory: directory,
  branch: branch,
)

always_clone = Dependabot::Utils.always_clone_for_package_manager?(package_manager)

repo_contents_path = File.expand_path(File.join("tmp", repo_name.split("/"))) if always_clone

puts repo_contents_path

puts "Fetching dependency files"
fetcher = Dependabot::FileFetchers.for_package_manager(package_manager).new(
  source: source,
  credentials: credentials,
  repo_contents_path: repo_contents_path
)

files = fetcher.files
commit = fetcher.commit

puts "Parsing dependency information"
parser = Dependabot::FileParsers.for_package_manager(package_manager).new(
  dependency_files: files,
  source: source,
  credentials: credentials,
  repo_contents_path: repo_contents_path
)

dependencies = parser.parse

dependencies.select(&:top_level?).each do |dep|
  begin
    puts "Checking #{dep.name}\n"
    checker = Dependabot::UpdateCheckers.for_package_manager(package_manager).new(
      dependency: dep,
      dependency_files: files,
      credentials: credentials,
      repo_contents_path: repo_contents_path
    )

    next if checker.up_to_date?

    requirements_to_unlock =
      if !checker.requirements_unlocked_or_can_be?
        if checker.can_update?(requirements_to_unlock: :none) then :none
        else :update_not_possible
        end
      elsif checker.can_update?(requirements_to_unlock: :own) then :own
      elsif checker.can_update?(requirements_to_unlock: :all) then :all
      else :update_not_possible
      end

    next if requirements_to_unlock == :update_not_possible

    updated_deps = checker.updated_dependencies(
      requirements_to_unlock: requirements_to_unlock
    )

    puts "Updating #{dep.name}\n"
    updater = Dependabot::FileUpdaters.for_package_manager(package_manager).new(
      dependencies: updated_deps,
      dependency_files: files,
      credentials: credentials,
      repo_contents_path: repo_contents_path
    )


    updated_files = updater.updated_dependency_files
    assignee = ENV["PULL_REQUESTS_ASSIGNEE"]
    assignees = assignee ? [assignee] : assignee
    puts "Creating PR for #{dep.name}"
    pr_creator = Dependabot::PullRequestCreator.new(
      source: source,
      base_commit: commit,
      dependencies: updated_deps,
      files: updated_files,
      credentials: credentials,
      assignees: assignees,
      author_details: { name: "Dependabot", email: "no-reply@github.com" },
      label_language: true,
    )
    
    pull_request = pr_creator.create
    puts "Created PR for #{dep.name}"

    next unless pull_request
  rescue StandardError => e
    puts "Failed to process #{dep.name}: #{e.message}"
  end

end

puts "Done"
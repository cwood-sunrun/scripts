#!/bin/zsh

# Reset a git repository directory and create a new branch from latest changes of default origin branch.
# Note: This is destructive!

args=("$@")

# Clean directory
git reset --hard --quiet
git clean -df

DEFAULT_BRANCH=$(git rev-parse --abbrev-ref origin/HEAD | cut -c8-)

# Branch from latest default branch
git checkout $DEFAULT_BRANCH --quiet
git pull --quiet

git checkout -b "$args[1]"

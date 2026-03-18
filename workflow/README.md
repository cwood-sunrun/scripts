# Workflow

Tiny scripts to support workflow.

## feat

Destructively reset a git repository, pull latest changes from default branch, and checkout new branch from default branch with a given branch name.

## spr (Slack PR Message)

Generate a PR review request message for slack given a description.

Note: Configure the `TARGET_SLACK_GROUP`.

Assumes Mac OS and Github CLI. Uses `pbcopy` to put message into clipboard.

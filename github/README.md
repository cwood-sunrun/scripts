# Github API scripting

## commits-per-pr
Requires the [github cli](https://cli.github.com/) to be installed (`gh`).

Calculates mean and max commits per pr against a particular branch since some date. Useful to help estimate time used by CI, etc. 

Example
```
./commits-per-pr.js 2026-01-01 cwood-sunrun/scripts main 
```

Output 
```
prs, commits, mean, max
5, 28, 5.60, 10
```

## time-until-first-review

Given a text file with repository names and a date, this script uses the github cli to output a csv with reviewed prs and seconds until they were first reviewed.

Output: repo, pr number, seconds

Supports an optional third argument of interval (week, month) to group stats over intervals. 

## time-to-master 

Given a text file with repository names and a date, calculate the time it takes for a change set to reach master branch. This assumes a git flow where changes are merged to a shared develop branch, then changes are collectively merged to master.

Supports an optional third argument of interval (week, month) to group stats over intervals. 


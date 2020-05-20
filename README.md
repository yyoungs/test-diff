
# Test only changed files in your Angular workspace

Even with focused unit tests, in large projects it can take a while for karma to finish processing skipped tests. 

A simple way to speed up the testing process is to update the project's test.ts file to only include the tests you are interested in.

**ng-test-diff** does this for you by using git to find any changed files and then updating the relevant test.ts files in your workspace

No more fiddling with focused tests or tweaking test.ts files.

## Installation

A local git repo is required

```sh
$ npm install -g tailwind-ng-test-diff
```

## Usage

```sh
$ ng-test-diff
```

Or pass in the path of the workspace.

```sh
$ ng-test-diff c:/myworkspace
```

You can also have ng-test-diff watch for changes with the watch flag -w which updates test.ts files after any file changes

```sh
$ ng-test-diff -w -- c:/myworkspace
```

When the *.ts files are reverted or there are no longer any modified files, the test.ts file(s) are changed back to use the standard /\\.spec\\.ts$/ pattern.

## Remember
Do not commit the modified test.ts files!

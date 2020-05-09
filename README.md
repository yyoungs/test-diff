
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

or pass in the path of the workspace

```sh
$ ng-test-diff c:/myworkspace
```

then run your tests. You could even run

```sh
$ ng-test-diff | ng test
```
ng-test-diff can be run multiple times.

## Remember
Do not commit the modified test.ts files!

## Comming Soon
File watching

More file comparison options
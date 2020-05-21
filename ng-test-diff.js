require('colors');
const chokidar = require('chokidar');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const debounce = require('lodash.debounce');

const { getModifiedFiles } = require('./git');
const {
  convertToSpecFiles,
  updateTestFile,
  revertTestFiles,
  getTestFiles,
  createMemoizedGetAngularConfig,
} = require('./ng-files');

/**
 * Finds the correct project for the given specfile and pushes
 * it to the project's specFile array.
 * @param {array} projects
 * @param {string} specFile
 */
function mapSpecFileToProject(projects, specFile) {
  const foundProject = projects.find((project) =>
    path.dirname(specFile).startsWith(path.dirname(project.testFile))
  );
  if (foundProject) {
    foundProject.specFiles.push(specFile);
  }
  return projects;
}

/**
 * Returns an array of project objects with changed spec files
 * @param {array} testFiles angular project test.ts files
 * @param {array} specFiles spec files of changed ts files
 */
function createProjects(testFiles, specFiles) {
  let projects = testFiles.map((testFile) => ({ testFile, specFiles: [] }));
  projects = specFiles
    .reduce(
      (accProjects, file) => mapSpecFileToProject(accProjects, file),
      projects
    )
    .filter((project) => project.specFiles.length);
  return projects;
}

async function main(root, getAngularConfig) {
  const [modifiedFiles, angularConfig] = await Promise.all([
    getModifiedFiles(root),
    getAngularConfig(),
  ]);

  if (modifiedFiles.length === 0) {
    return 'No file changes found'.yellow;
  }

  const testFiles = getTestFiles(angularConfig);
  const modifiedCodeFiles = modifiedFiles.filter(
    (file) => !testFiles.includes(file)
  );

  if (modifiedCodeFiles.length === 0) {
    return revertTestFiles(root, modifiedFiles);
  }

  const specFiles = convertToSpecFiles(modifiedCodeFiles);
  const projects = createProjects(testFiles, specFiles);

  const messagePromises = projects.map((project) =>
    updateTestFile(root, project.testFile, project.specFiles)
  );

  const messages = await Promise.all(messagePromises);
  return messages.join('\n');
}

function runMain(root, getAngularConfig) {
  main(root, getAngularConfig)
    .then((message) => process.stdout.write(`\n${message}\n\n`))
    .catch((err) =>
      process.stderr.write(`\n test-diff Unexpected error: ${err}\n\n`.red)
    );
}

module.exports.ngTestDiff = function ngTestDiff() {
  const root = argv._.length ? argv._[0] : process.cwd();
  const watch = !!argv.w;

  let getAngularConfig = createMemoizedGetAngularConfig(root);

  if (watch) {
    chokidar
      .watch('**/*.ts', {
        cwd: root,
        ignoreInitial: true,
        ignored: ['**/test.ts', '**/node_modules/**', /(^|[/\\])\../], // test.ts, packages, dotfiles
      })
      .on(
        'all',
        debounce(() => runMain(root, getAngularConfig), 500, { trailing: true })
      )
      .on('add', () => {
        // clear memoized config when files are added
        getAngularConfig = createMemoizedGetAngularConfig(root);
      });

    process.stdout.write(`\nWatching dir ${root}\n`.magenta);
  }

  runMain(root, getAngularConfig);
};

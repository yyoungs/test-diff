const fs = require('fs').promises;
const path = require('path');
const { getModifiedFiles } = require('./git');

/**
 * Creates a regular expression to match the passed file names.
 */
function createRegex(files) {
  const escapedFileNames = files
    .map((file) => path.basename(file))
    .map((fileName) => fileName.replace(/[.*+?^${}()/|[\]\\]/g, '\\$&'))
    .join('|');
  return `/(${escapedFileNames})/`;
}

/**
 * Updates the passed files to their corresponding spec file.
 * Existing spec failes are not changed.
 */
function convertToSpecFiles(files) {
  const specFiles = files.map((file) =>
    file.endsWith('.spec.ts') ? file : file.replace('.ts', '.spec.ts')
  );

  return [...new Set(specFiles)];
}

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

/**
 * Updates the regex in the test.ts file uses to create
 * the test context.
 */
async function updateTestFileRegex(testFilePath, regex) {
  let testFileData;

  try {
    testFileData = await fs.readFile(testFilePath, { encoding: 'utf-8' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`can't find file ${testFilePath}`);
    }
  }

  testFileData = testFileData.replace(
    /(require\.context\('\.\/', true,).*(\);)/g,
    `$1 ${regex}$2`
  );

  await fs.writeFile(testFilePath, testFileData);
}

/**
 * Updates the test.ts file of the given project with
 * a new regext to target the projects specFiles.
 * @param {object} project
 * @param {string} root
 */
async function updateTestFile(project, root) {
  const regex = createRegex(project.specFiles);
  const testFilePath = path.join(root, project.testFile);

  try {
    await updateTestFileRegex(testFilePath, regex);
    return `File updated: ${project.testFile}`;
  } catch (error) {
    return `FAILED file update: ${project.testFile} ${error.toString()}`;
  }
}

/**
 * Returns an array of test.ts files from the passed
 * angular config object.
 * @param {object} angularConfig
 */
function getTestFiles(angularConfig) {
  if (!angularConfig.projects) {
    return [];
  }

  return Object.keys(angularConfig.projects).reduce((acc, projectName) => {
    const project = angularConfig.projects[projectName];
    const testFilePath =
      project &&
      project.architect &&
      project.architect.test &&
      project.architect.test.options &&
      project.architect.test.options.main;
    if (testFilePath) {
      acc.push(testFilePath);
    }
    return acc;
  }, []);
}

/**
 * Returns the angular config object found in the root
 * of the passed workspace.
 * @param {string} root
 */
async function getAngularConfig(root) {
  const angularFilePath = path.join(root, 'angular.json');
  try {
    const angularFileData = await fs.readFile(angularFilePath);
    return JSON.parse(angularFileData);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`can't find file ${angularFilePath}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`angular.json file is not valid JSON ${angularFilePath}`);
    }
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const root = args.length ? args[0] : process.cwd();
  let modifiedFiles = await getModifiedFiles(root);

  if (modifiedFiles.length === 0) {
    return 'No file changes found';
  }

  const angularConfig = await getAngularConfig(root);
  const testFiles = getTestFiles(angularConfig);
  modifiedFiles = modifiedFiles.filter((file) => !testFiles.includes(file));
  const specFiles = convertToSpecFiles(modifiedFiles);
  const projects = createProjects(testFiles, specFiles);

  const messagePromises = projects.map((project) =>
    updateTestFile(project, root)
  );

  const messages = await Promise.all(messagePromises);
  return messages.join('\n');
}

module.exports.ngTestDiff = function ngTestDiff() {
  main()
    .then((message) => process.stdout.write(`\n${message}\n\n`))
    .catch((err) =>
      process.stderr.write(`\n test-diff Unexpected error: ${err}\n\n`)
    );
};

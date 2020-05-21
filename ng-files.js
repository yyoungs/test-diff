const fs = require('fs').promises;
const path = require('path');

/**
 * Creates a regular expression to match the passed file names.
 */
function createRegexForMatchingFiles(files) {
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

  const testFileContentsRegex = /(require\.context\('\.\/', true,).*(\);)/g;
  if (testFileData.search(testFileContentsRegex) === 0) {
    throw new Error(`file is in unexpected format ${testFilePath}`);
  }

  testFileData = testFileData.replace(testFileContentsRegex, `$1 ${regex}$2`);

  await fs.writeFile(testFilePath, testFileData);
}

/**
 * Updates the test.ts file of the given project with
 * a new regext to target the projects specFiles.
 */
async function updateTestFile(root, testFile, specFiles) {
  const regex = createRegexForMatchingFiles(specFiles);
  const testFilePath = path.join(root, testFile);

  try {
    await updateTestFileRegex(testFilePath, regex);
    return `File updated: ${testFile}`;
  } catch (error) {
    return `FAILED file update: ${testFile} ${error.toString()}`;
  }
}

/**
 * Updates the test.ts file of the given project with
 * a new regext to target the projects specFiles.
 */
async function revertTestFile(root, testFile) {
  const regex = '/\\.spec\\.ts$/';
  const testFilePath = path.join(root, testFile);

  try {
    await updateTestFileRegex(testFilePath, regex);
    return `File updated (undone): ${testFile}`.green;
  } catch (error) {
    return `FAILED file update: ${testFile} ${error.toString()}`;
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
function createMemoizedGetAngularConfig(root) {
  let config = null;

  return async function getAngularConfig() {
    if (config) {
      return config;
    }

    const angularFilePath = path.join(root, 'angular.json');
    try {
      const angularFileData = await fs.readFile(angularFilePath);
      config = JSON.parse(angularFileData);
      return config;
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`can't find file ${angularFilePath}`);
      }
      if (err instanceof SyntaxError) {
        throw new Error(
          `angular.json file is not valid JSON ${angularFilePath}`
        );
      }
      throw err;
    }
  };
}

/**
 * Reverts the updated test files to use the standard
 * regex to search for spec files. This does not
 * perform a Git revert.
 * @param {array} testFiles
 * @param {string} root
 */
async function revertTestFiles(root, testFiles) {
  const messagePromises = testFiles.map((file) => revertTestFile(root, file));

  const messages = await Promise.all(messagePromises);
  return messages.join('\n');
}

module.exports.convertToSpecFiles = convertToSpecFiles;
module.exports.updateTestFile = updateTestFile;
module.exports.revertTestFiles = revertTestFiles;
module.exports.getTestFiles = getTestFiles;
module.exports.createMemoizedGetAngularConfig = createMemoizedGetAngularConfig;

const { spawn } = require('child_process');

/**
 *  Calls git ls-files -m *.ts
 *  to return an array of modified TypeScript files.
 */
module.exports.getModifiedFiles = function getModifiedFiles(path) {
  return new Promise((resolve, reject) => {
    let fileArray = [];
    const listFiles = spawn('git', [
      '-C',
      path,
      'ls-files',
      '-m',
      '-o',
      '--exclude-standard',
      '*.ts',
    ]);

    listFiles.stdout.on('data', (data) => {
      fileArray = String(data).split('\n');
      if (fileArray.length > 0) {
        fileArray.pop();
      }
    });

    listFiles.stderr.on('data', (err) => {
      reject(new Error(`Git ls-files failed\n\n${err}`));
    });

    listFiles
      .on('error', (err) => {
        if (err.code === 'ENOENT') {
          reject(new Error('Git was not found'));
        }
        reject(err.toString());
      })
      .on('close', () => {
        resolve(fileArray);
      });
  });
};

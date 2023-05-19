const fs = require('fs');
const util = require('util');
const Client = require('ssh2-sftp-client');
const AWS = require('aws-sdk')

const writeFile = util.promisify(fs.writeFile);

const execFile = util.promisify(require('child_process').execFile);
const exec = util.promisify(require('child_process').exec);

const ssmClient = new AWS.SSM();

module.exports.run = async () => {
  const time = new Date();

  // Get private key from SSM Parameter Store
  const parameter = await ssmClient.getParameter({
    Name: 'lambda-ssh-key',
    WithDecryption: true
  }).promise();

  // Generate backup name
  const backupName = 'mysqlbackup-' + time.toISOString() + '.gz';

  // Generate backup script
  let content = `#!/bin/bash -e
                 cd /tmp
                 BACKUPNAME=/tmp/${backupName}
                 export LD_LIBRARY_PATH=${__dirname}/tools/lib:$LD_LIBRARY_PATH
                 export PATH=${__dirname}/tools:$PATH
                 export DYLD_LIBRARY_PATH=${__dirname}/tools/lib:$DYLD_LIBRARY_PATH
                 export LIBRARY_PATH=${__dirname}/tools/lib:$LIBRARY_PATH
                 ${__dirname}/tools/mysqldump --host [DB_ENDPOINT] --port [DB_PORT] --user [DB_USER] --password=[DB_PASS] [DB_NAME] | ${__dirname}/tools/gzip -c > $BACKUPNAME
                `;

  content = content.replace('[DB_ENDPOINT]', process.env.DB_ENDPOINT); //get from lambda environment variables
  content = content.replace('[DB_PORT]', process.env.DB_PORT); //get from lambda environment variables
  content = content.replace('[DB_USER]', process.env.DB_USER); //get from lambda environment variables
  content = content.replace('[DB_PASS]', process.env.DB_PASS); //get from lambda environment variables
  content = content.replace('[DB_NAME]', process.env.DB_NAME); //get from lambda environment variables

  // generate backup script
  await writeFile('/tmp/db_backup.sh', content);
  fs.chmodSync('/tmp/db_backup.sh', '755');

  //run script
  await execFile('/tmp/db_backup.sh');

  // Configure SFTP
  const sftpConfig = {
    host: process.env.SFTP_HOST,
    username: process.env.SFTP_USER,
    privateKey: parameter.Parameter.Value
  };

  const sftp = new Client('upload');

  // Upload backup file to Server
  try {
    // Connect to SFTP
    await sftp.connect(sftpConfig);
    // Create backup directory
    await sftp.mkdir('/tmp/backups', true);
    // check if backups are more than 10
    const backups = await sftp.list('/tmp/backups');
    if (backups.length > 10) {
      // sort backups by date
      backups.sort((a, b) => {
        return new Date(a.modifyTime) - new Date(b.modifyTime);
      });
      // delete oldest backup file
      await sftp.delete(`/tmp/backups/${backups[0].name}`);
      console.log("Deleted oldest backup file", backups[0].name);
    }
    // Upload backup file
    await sftp.put(`/tmp/${backupName}`, `/tmp/backups/${backupName}`);
    // End SFTP connection
    await sftp.end();
  } catch (err) {
    // Handle error
    console.error("Error uploading backup", err.message);
    sftp.end();
    throw err;
  }

  // cleanup local backup (this should cleanup automatically according to lambda lifecycle)
  await exec('rm /tmp/'+backupName);

  console.log(`Your cron function ran at ${time}`);
  return "Success";
};
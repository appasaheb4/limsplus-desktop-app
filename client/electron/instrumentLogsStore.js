const electron = require('electron');
const path = require('path');
const fs = require('fs');

class InstrumentLogsStore {
  constructor(opts) {
    const messageDataPath = (electron.app || electron.remote.app).getPath(
      'userData',
    );
    this.logDirectory = path.join(messageDataPath, opts.configName);

    // Ensure the log directory exists
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory);
    }

    this.logFilePath = path.join(this.logDirectory, 'instrument-logs.txt');

    // Ensure the log file exists
    if (!fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, '');
    }
  }

  appendLog(lines) {
    if (!Array.isArray(lines)) {
      throw new Error('appendLog expects an array of strings');
    }
    const logContent = lines.join('\n') + '\n';
    fs.appendFileSync(this.logFilePath, logContent);
  }
}

module.exports = InstrumentLogsStore;

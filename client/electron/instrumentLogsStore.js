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

    this.createLogFile();
  }

  createLogFile() {
    // Create a new log file with a timestamp in the name
    const dateTime = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(
      this.logDirectory,
      `instrument-logs-${dateTime}.txt`,
    );
    fs.writeFileSync(this.logFilePath, '');
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

const fs = require('fs');
const path = require('path');

let logStream = null;

try {
  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Get the current date for log file naming
  const getLogFilename = () => {
    const date = new Date();
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.log`;
  };

  // Create a write stream for the log file
  const logFile = path.join(logsDir, getLogFilename());
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
} catch (err) {
  console.error('Error setting up log directory or file:', err);
}

// Logger function that writes to both console and file (if available)
const logger = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    
    // Always log to console
    console.log(logMessage);
    
    // Log to file if stream is available
    if (logStream) {
      try {
        logStream.write(logMessage + '\n');
      } catch (err) {
        console.error('Error writing to log file:', err);
      }
    }
  },
  
  error: (message, error = null) => {
    const timestamp = new Date().toISOString();
    const errorData = error ? (typeof error === 'string' ? error : JSON.stringify(error, Object.getOwnPropertyNames(error), 2)) : '';
    const logMessage = `[${timestamp}] ERROR: ${message}${errorData ? '\n' + errorData : ''}`;
    
    // Always log to console
    console.error(logMessage);
    
    // Log to file if stream is available
    if (logStream) {
      try {
        logStream.write(logMessage + '\n');
      } catch (err) {
        console.error('Error writing to log file:', err);
      }
    }
  },

  debug: (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] DEBUG: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    
    // Always log to console
    console.debug(logMessage);
    
    // Log to file if stream is available
    if (logStream) {
      try {
        logStream.write(logMessage + '\n');
      } catch (err) {
        console.error('Error writing to log file:', err);
      }
    }
  },
  
  // Method to write directly to the log file (no console output)
  writeToFile: (content) => {
    // Write to file if stream is available
    if (logStream) {
      try {
        logStream.write(content + '\n');
      } catch (err) {
        console.error('Error writing to log file:', err);
      }
    }
  }
};

// Handle process exit to close log stream if it exists
process.on('exit', () => {
  if (logStream) {
    try {
      logStream.end();
    } catch (err) {
      console.error('Error closing log stream:', err);
    }
  }
});

module.exports = logger; 
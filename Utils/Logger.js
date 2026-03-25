const winston = require("winston");
const path = require("path");
const fs = require("fs");
const saveLogToDB = require("./Dblogger");

// Ensure Logs directory exists
const logDir = path.join(__dirname, "../Logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

// Create logger
const logger = winston.createLogger({
  level: "info",
  format: logFormat,
  transports: [
    // Save logs to file
    new winston.transports.File({
      filename: path.join(logDir, "app.log"),
    }),

    // Save errors separately
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
  ],
});

// Override console.log and console.error to use winston
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const getIsProduction = () => process.env.NODE_ENV === "production";

console.log = (...args) => {
  const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg)).join(" ");
  logger.info(message);
  saveLogToDB("info", message);
  if (!getIsProduction()) {
    originalLog(...args);
  }
};

console.error = (...args) => {
  const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg)).join(" ");
  logger.error(message);
  saveLogToDB("error", message);
  if (!getIsProduction()) {
    originalError(...args);
  }
};

console.warn = (...args) => {
  const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg)).join(" ");
  logger.warn(message);
  saveLogToDB("warn", message);
  if (!getIsProduction()) {
    originalWarn(...args);
  }
};

module.exports = logger;
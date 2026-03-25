const logger = require("./logger");
const saveLogToDB = require("./Dblogger");

const log = async (level, message, meta = {}) => {
  // File logging
  logger.log({ level, message });

  // DB logging (async, non-blocking)
  saveLogToDB(level, message, meta);
};

module.exports = {
  info: (msg, meta) => log("info", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
};
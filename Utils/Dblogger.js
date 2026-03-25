const Log = require("../Models/Log");

const saveLogToDB = async (level, message, meta = {}) => {
  try {
    await Log.create({
      level,
      message,
      meta,
    });
  } catch (err) {
    // avoid infinite loop
    console.error("DB Logging Failed:", err.message);
  }
};

module.exports = saveLogToDB;
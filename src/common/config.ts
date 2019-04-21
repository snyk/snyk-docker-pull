import SnykConfig = require("snyk-config");

const config = SnykConfig(__dirname + "/../..", {
  secretConfig: process.env.CONFIG_SECRET_FILE
});

// allow env to overwrite configured log level (good for travis etc.)
config.LOGGING.level = process.env.LOG_LEVEL || config.LOGGING.level;

export = config;

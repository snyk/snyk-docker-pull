import * as SourceMapSupport from "source-map-support";
import * as config from "../common/config";
import { Logger } from "../common/logger";
import { app } from "./app";

const logger = Logger("main");
SourceMapSupport.install();

const processStartTime = Date.now();

process.on("uncaughtException", err => {
  try {
    // try to report through the proper channels
    logger.error(err, "UNCAUGHT EXCEPTION!");
  } catch (err) {
    // logger wasn't instantiated yet? Nevermind, proceed with stdout
  }

  // also push to stdout and flush, so that if we die too soon for the proper
  // channels to handle the log, it still exists
  // tslint:disable no-console
  console.log("UNCAUGHT EXCEPTION!", err);

  // die immediately
  return process.exit(1);
});

app.on("error", err => logger.error({ err }, "Server error"));

app
  .listen(config.PORT, () => {
    logger.info(
      {
        port: config.PORT,
        startupDurationMs: Date.now() - processStartTime
      },
      "Server started"
    );
  })
  .setTimeout(config.SERVER_CONN_TIMEOUT);

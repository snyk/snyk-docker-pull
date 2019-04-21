import config = require("./config");
let Raven;

if (!config.SENTRY_DSN) {
  // fake Raven to prevent it messing with NodeJS default uncaughtException
  // handling, and silence its noisy warnings
  const passThroughMiddleware = (req, res, next) => next();
  Raven = {
    captureException() {
      /* no-op */
    },
    captureMessage() {
      /* no-op */
    },
    errorHandler() {
      return passThroughMiddleware;
    },
    requestHandler() {
      return passThroughMiddleware;
    },
  };
} else {
  // tslint:disable-next-line:no-var-requires
  Raven = require("raven");
  Raven.config(config.SENTRY_DSN, {
    autoBreadcrumbs: true,
    captureUnhandledRejections: true,
    environment: process.env.SERVICE_ENV || "local",
    tags: {
      gitSha: config.GIT_COMMIT_SHA || "none",
      pid: process.pid,
    },
    transport: new Raven.transports.HTTPSTransport({
      rejectUnauthorized: true,
    }),
    release: config.GIT_COMMIT_SHA || "none",
  }).install();
}

export = Raven;
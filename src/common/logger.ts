import * as log from "@snyk/log";
import * as config from "./config";
import * as sentry from "./sentry";

export const Logger = log(config.LOGGING, sentry);
export const logger = Logger("docker-registry-agent");

export function replyLog(logContext: any): void {
  if (logContext.code === 200) {
    logger.info(logContext, "Reply sent");
  } else if (logContext.code < 500) {
    logger.warn(logContext, "Reply sent");
  } else {
    logger.error(logContext, "Reply sent");
  }
}
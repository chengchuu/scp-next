import { ConfigurationError } from "../errors/index.js";
import type { ScpNextConfig, TransferJob } from "../types/index.js";

export function selectJob(config: ScpNextConfig, jobName: string): TransferJob {
  const job = config.jobs?.[jobName];
  if (!job) {
    throw new ConfigurationError(`Unknown job: ${jobName}`, {
      context: { job: jobName }
    });
  }
  return job;
}

export const PING_JOB_NAME = "ping";

export interface PingJobResult {
  pong: true;
  respondedAt: string;
}

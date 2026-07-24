export interface ExecutionMetric {
  agentName: string;
  toolName?: string;
  durationMs: number;
  tokensUsed?: number;
  costUsd?: number;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  timestamp: string;
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  log(message: string, ...meta: unknown[]) {
    console.log(`[${new Date().toISOString()}] [INFO] [${this.context}] ${message}`, ...meta);
  }

  warn(message: string, ...meta: unknown[]) {
    console.warn(`[${new Date().toISOString()}] [WARN] [${this.context}] ${message}`, ...meta);
  }

  error(message: string, error?: unknown) {
    console.error(`[${new Date().toISOString()}] [ERROR] [${this.context}] ${message}`, error ?? '');
  }

  metric(metric: ExecutionMetric) {
    console.log(
      `[METRIC] [${metric.agentName}] ${metric.toolName ?? 'AGENT_RUN'} | ${metric.durationMs}ms | ${metric.status}`
    );
  }
}

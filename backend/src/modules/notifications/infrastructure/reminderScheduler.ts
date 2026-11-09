import type { ErrorReporter } from '../../../shared/eventBus.js';

export interface ScheduledJob {
  execute(): Promise<unknown>;
}

export interface ReminderSchedulerDeps {
  job: ScheduledJob;
  errors: ErrorReporter;
  intervalMs: number;
}

/** Ejecuta el barrido de recordatorios cada `intervalMs`. */
export class ReminderScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  public constructor(private readonly deps: ReminderSchedulerDeps) {}

  public start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.deps.intervalMs);
    this.timer.unref?.();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runOnce(): Promise<void> {
    try {
      await this.deps.job.execute();
    } catch (error: unknown) {
      this.deps.errors.report('reminder-scheduler', error);
    }
  }
}

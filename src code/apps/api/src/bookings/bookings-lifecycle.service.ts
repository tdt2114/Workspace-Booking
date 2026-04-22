import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';

const DEFAULT_LIFECYCLE_INTERVAL_MS = 60_000;

@Injectable()
export class BookingsLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingsLifecycleService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly bookingsService: BookingsService) {}

  onModuleInit() {
    if (!this.isLifecycleEnabled()) {
      this.logger.log(
        'Automatic booking lifecycle scheduler is disabled. Set BOOKINGS_LIFECYCLE_ENABLED=true to enable it.',
      );
      return;
    }

    const intervalMs = this.getIntervalMs();
    const runOnStart = this.shouldRunOnStart();

    this.logger.log(
      `Automatic booking lifecycle scheduler is enabled. Interval: ${intervalMs}ms. Run on start: ${runOnStart}.`,
    );

    if (runOnStart) {
      void this.runLifecycleCycle('startup');
    }

    this.intervalId = setInterval(() => {
      void this.runLifecycleCycle('interval');
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private isLifecycleEnabled() {
    return (
      process.env.BOOKINGS_LIFECYCLE_ENABLED?.trim().toLowerCase() === 'true'
    );
  }

  private shouldRunOnStart() {
    return (
      process.env.BOOKINGS_LIFECYCLE_RUN_ON_START?.trim().toLowerCase() ===
      'true'
    );
  }

  private getIntervalMs() {
    const rawValue = process.env.BOOKINGS_LIFECYCLE_INTERVAL_MS;
    const parsed = Number(rawValue);

    if (!rawValue) {
      return DEFAULT_LIFECYCLE_INTERVAL_MS;
    }

    if (!Number.isFinite(parsed) || parsed < 1_000) {
      this.logger.warn(
        `Invalid BOOKINGS_LIFECYCLE_INTERVAL_MS value "${rawValue}". Falling back to ${DEFAULT_LIFECYCLE_INTERVAL_MS}ms.`,
      );
      return DEFAULT_LIFECYCLE_INTERVAL_MS;
    }

    return parsed;
  }

  private async runLifecycleCycle(trigger: 'startup' | 'interval') {
    if (this.isRunning) {
      this.logger.warn(
        `Skipped booking lifecycle run triggered by ${trigger} because a previous cycle is still running.`,
      );
      return;
    }

    this.isRunning = true;
    const effectiveAt = new Date().toISOString();

    try {
      const noShowResult = await this.bookingsService.runNoShow({
        effectiveAt,
      });
      const completedResult = await this.bookingsService.runCompleted({
        effectiveAt,
      });

      this.logger.log(
        `Booking lifecycle run (${trigger}) finished at ${effectiveAt}. no_show=${noShowResult.count}, completed=${completedResult.count}.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? (error.stack ?? error.message) : String(error);

      this.logger.error(
        `Booking lifecycle run (${trigger}) failed at ${effectiveAt}. ${message}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}

import { buildContainer } from './container.js';
import { createApp } from './http/app.js';
import { ReminderScheduler } from './modules/notifications/infrastructure/reminderScheduler.js';
import { seed } from './seed.js';

const PORT = Number(process.env.PORT ?? 3000);
const SEED = (process.env.SEED ?? 'true') === 'true';
const REMINDER_INTERVAL_MS = Number(process.env.REMINDER_INTERVAL_MS ?? 60_000);

async function main(): Promise<void> {
  const container = buildContainer({
    timeZone: process.env.DISPLAY_TIME_ZONE ?? 'America/Hermosillo',
    reminderLeadMinutes: Number(process.env.REMINDER_LEAD_MINUTES ?? 24 * 60),
  });
  if (SEED) {
    await seed(container);
  }

  const scheduler = new ReminderScheduler({
    job: container.notifications.sendReminders,
    errors: container.errors,
    intervalMs: REMINDER_INTERVAL_MS,
  });
  scheduler.start();

  const server = createApp(container).listen(PORT, () => {
    console.info(`VetSync API escuchando en http://localhost:${PORT}/api`);
  });

  const shutdown = (): void => {
    scheduler.stop();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error('No se pudo iniciar VetSync:', error);
  process.exit(1);
});

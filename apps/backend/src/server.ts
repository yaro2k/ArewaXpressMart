import { createApp } from './app.js';
import { env } from './config/env.js';

const server = createApp().listen(env.PORT, () => console.info(`API listening on port ${env.PORT}`));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close(() => process.exit(0)));

import dotenv from 'dotenv';
dotenv.config();

import { createApp, startServer } from './server/config/app';
import { logFatal } from './server/utils/logger';

const app = createApp();

startServer(app).catch(err => {
  logFatal('Erro fatal ao iniciar servidor', err);
  process.exit(1);
});

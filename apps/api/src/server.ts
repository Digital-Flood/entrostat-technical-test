import process from 'node:process';

import { createApp } from './app.js';

const fallbackPort = 4000;
const port = Number(process.env.PORT ?? process.env.API_PORT ?? fallbackPort);
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

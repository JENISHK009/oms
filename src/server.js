import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { CronJob } from 'cron'; // Import CronJob from cron package
import { migrationFunction } from './config/index.js';
import { sellerRoutes } from './manageRoutes/index.js';
import { webhookRoutes } from './routes/index.js';
import {
  encryptResponse,
  decryptRequest,
  blockIps,
  rateLimiter,
} from './middleware/index.js';
import { scrapeMeeshoOrders } from './utils/index.js';
const app = express();
dotenv.config();

async function startServer() {
  await scrapeMeeshoOrders();
  await migrationFunction();

  app.use((req, res, next) => {
    if (req.originalUrl === '/webhook/stripe') {
      next();
    } else {
      bodyParser.json()(req, res, next);
    }
  });

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cors());

  app.use(rateLimiter);
  app.use(blockIps);
  app.use(
    '/webhook',
    bodyParser.raw({ type: 'application/json' }),
    webhookRoutes
  );
  app.use(decryptRequest);
  app.use(encryptResponse);

  app.use('/seller', sellerRoutes);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

const job = new CronJob('*/1 * * * *', async () => {
  try {
    console.log('Meesho scrapping start at', new Date());
    await scrapeMeeshoOrders();
    console.log('Meesho scrapping end', new Date());
  } catch (error) {
    console.log('error', error);
  }
});

startServer().catch((error) => {
  console.error('Error starting server:', error);
});

import express from 'express';
import { webhookController } from '../controller/index.js';

const router = express.Router();

router.post('/stripe', webhookController.stripeWebhookForPaymentStatus);

export default router;

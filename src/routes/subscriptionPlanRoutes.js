import express from 'express';
import { subscriptionPlanController } from '../controller/index.js';

const router = express.Router();

router.get('/getPlans', subscriptionPlanController.getPlans);
router.post('/purchasePlan', subscriptionPlanController.purchasePlan);
router.get('/getActivePlan', subscriptionPlanController.getActivePlan);
router.get(
  '/getPurchaseHistory',
  subscriptionPlanController.getPurchaseHistory
);
router.get(
  '/getPlanById',
  subscriptionPlanController.getPlanById
);

export default router;

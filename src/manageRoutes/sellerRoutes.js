import express from 'express';
import bodyParser from 'body-parser';
import {
  loginRoutes,
  authRoutes,
  userRoutes,
  roleRoutes,
  accessContoleRoutes,
  changeAuthRoutes,
  signupRoutes,
  userStoreAssociationsRoutes,
  storeCategoriesRoutes,
  storeRoutes,
  subscriptionPlanRoutes,
  actionRoutes,
  todoRoutes,
  firebaseNotificationRoutes,
  webhookRoutes
} from '../routes/index.js';
import {
  sellerAuthanticateJWT,
  logRequestAndResponse,
} from '../middleware/index.js';

const router = express.Router();

router.use('/login', logRequestAndResponse, loginRoutes);
router.use('/signup', logRequestAndResponse, signupRoutes);
router.use('/changeAuth', logRequestAndResponse, changeAuthRoutes);

router.use(sellerAuthanticateJWT);
router.use(logRequestAndResponse);

router.use('/auth', authRoutes);
router.use('/action', actionRoutes);
router.use('/user', userRoutes);
router.use('/role', roleRoutes);
router.use('/accessContole', accessContoleRoutes);
router.use('/userStoreAssociation', userStoreAssociationsRoutes);
router.use('/store', storeRoutes);
router.use('/subscriptionPlan', subscriptionPlanRoutes);
router.use('/storeCategories', storeCategoriesRoutes);
router.use('/todo', todoRoutes);
router.use('/firebaseNotification', firebaseNotificationRoutes);

export default router;

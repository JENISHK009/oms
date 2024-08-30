import express from 'express';
import { userStoreAssociationsController } from '../controller/index.js';

const router = express.Router();

router.post(
  '/createUserStoreAssociation',
  userStoreAssociationsController.createUserStoreAssociation
);
router.post(
  '/getUserStoreAssociations',
  userStoreAssociationsController.getUserStoreAssociations
);
router.post(
  '/addStoreCredentials',
  userStoreAssociationsController.addStoreCredentials
);

export default router;

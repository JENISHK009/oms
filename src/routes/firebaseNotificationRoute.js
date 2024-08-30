import express from 'express';
import { firebaseNotificationController } from '../controller/index.js';

const router = express.Router();

router.get('/getAllMessages', firebaseNotificationController.getAllNotificationsForUser);
router.get('/getMessageDetailById', firebaseNotificationController.getNotificationDetailById);
router.get('/getAllTopics', firebaseNotificationController.getFirebaseTopics);
router.post('/subscribeTopics', firebaseNotificationController.subscribeFirebaseTopics);

export default router;

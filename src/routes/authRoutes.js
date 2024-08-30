import express from 'express';
import { authController } from '../controller/index.js';

const router = express.Router();

router
  .patch('/resetPassword', authController.resetPassword)
  .post('/updatePassword', authController.updatePassword)
  .patch('/updateProfile', authController.updateProfile)
  .patch('/verifyOtpAndUpdateProfile', authController.verifyOtpAndUpdateProfile)
  .patch('/resendOtp', authController.resendOtp)
  .get('/loginBackToDelegate', authController.loginBackToDelegate);
export default router;

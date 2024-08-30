import express from 'express';
import { changeAuthContoller } from '../controller/index.js';
const router = express.Router();

router
  .post('/forgotPasswordReq', changeAuthContoller.forgotPasswordReq)
  .post('/verifyPassword', changeAuthContoller.verifyPassword)
  .post('/resendOtp', changeAuthContoller.resendOtp);

export default router;

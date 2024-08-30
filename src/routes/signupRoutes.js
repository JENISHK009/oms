import express from 'express';
import { signupContoller } from '../controller/index.js';
import { decryptRequest } from '../middleware/index.js';
const router = express.Router();

router
  .post('/', signupContoller.signup)
  .post('/verifySignupOtp', signupContoller.verifySignupOtp)
  .post('/resendOtp', signupContoller.resendOtp);

export default router;

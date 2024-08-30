import express from 'express';
import { userContoller } from '../controller/index.js';
import { decryptRequest, sellerAuthanticateJWT } from '../middleware/index.js';

const router = express.Router();

router
  .post('/createUser', userContoller.createUser)
  .get('/getAllUsers', userContoller.getAllUsers)
  .get('/getUserById', userContoller.getUserById)
  .get('/getLoggedInUser', userContoller.getLoggedInUser)
  .delete('/deleteUser', userContoller.deleteUser)
  .patch('/updateUser', userContoller.updateUser)
  .get('/getFilterRoles', userContoller.getFilterRoles)
  .patch('/updateUserStatus', userContoller.updateUserStatus)
  .get('/createTokenForUser', userContoller.createTokenForUser);
export default router;

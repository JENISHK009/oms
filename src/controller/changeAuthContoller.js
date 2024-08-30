import { pool } from '../config/index.js';
import bcrypt from 'bcrypt';
import {
  generateOTP,
  encrypt,
  sendSuccess,
  generateJwtToken,
  decrypt,
  replacePlaceholders,
  sendEmail,
} from '../utils/index.js';
import jwt from 'jsonwebtoken';

const forgotPasswordReq = async (req, res) => {
  try {
    let { email } = req.body;
    email = email.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const query = `
    SELECT u.*, r."name" AS "roleName", r."isSystemRole"
    FROM OMS."users" u
    LEFT JOIN OMS."roles" r ON u."roleId" = r."id"
    WHERE u."email" = $1 and u."deletedAt" is null
  `;
    const userResult = await pool.query(query, [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    const hasValidRole = userResult.rows.some(
      (row) =>
        !row.isSystemRole || (row.isSystemRole && row.roleName === 'SELLER')
    );

    if (!hasValidRole) {
      return res
        .status(403)
        .json({ error: 'User does not have a valid role for password reset.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 120000);

    const token = generateJwtToken(
      { id: user.id, email: user.email },
      { expiresIn: '1h' }
    );

    await pool.query(`UPDATE OMS."users" SET otp = $1 WHERE id = $2`, [
      { code: otp.toString(), expiresAt },
      user.id,
    ]);

    const encryptToken = encrypt(token);

    const templatePath = 'src/emailTemplates/otpSend.html';
    const emailBody = replacePlaceholders(templatePath, { OTP: otp });

    sendEmail(email, emailBody, 'Your OTP for Password Reset');

    sendSuccess(res, 'OTP sent to your Email.', encryptToken);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const verifyPassword = async (req, res) => {
  try {
    const { otp, newPassword, token } = req.body;

    if (!otp || !newPassword) {
      return res
        .status(400)
        .json({ error: 'OTP and new password are required.' });
    }

    if (!token) {
      return res.status(400).json({ error: 'At least one token is required' });
    }

    let decodedToken = null;
    let decryptToken = decrypt(token);
    if (decryptToken) {
      try {
        decodedToken = jwt.verify(decryptToken, process.env.SECRET_KEY);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid email token' });
      }
    }

    const userId = decodedToken?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found in tokens' });
    }

    const user = await pool.query(
      `SELECT * FROM OMS."users" WHERE id = $1 and "deletedAt" is null`,
      [userId]
    );

    if (!user.rows[0]) {
      return res.status(400).json({ error: 'User not found' });
    }

    const storedOtp = user.rows[0].otp;

    if (!storedOtp || Number(storedOtp.code) !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (storedOtp.expiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE OMS."users" SET password = $1, otp = $2 WHERE id = $3 and "deletedAt" is null`,
      [hashedPassword, null, userId]
    );

    sendSuccess(res, 'Password updated successfully', null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'At least one token is required' });
    }
    let decodedToken = null;
    if (token) {
      try {
        decodedToken = jwt.verify(token, process.env.SECRET_KEY);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid email token' });
      }
    }

    const userId = decodedToken?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found in tokens' });
    }

    const userQuery = `SELECT * FROM OMS."users" WHERE "id" = $1 and "deletedAt" is null`;
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const OTP = generateOTP();
    const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

    const otpData = {
      otp: OTP,
      expiresAt: otpExpiry,
    };

    const updateOtpQuery = `UPDATE OMS."users" SET otp = $1 WHERE id = $2`;
    await pool.query(updateOtpQuery, [otpData, userId]);

    const templatePath = 'src/emailTemplates/otpSend.html';
    const emailBody = replacePlaceholders(templatePath, { OTP });

    sendEmail(user.email, emailBody, 'Your OTP for Password Reset');

    sendSuccess(res, 'An OTP has been sent to your email.');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  resendOtp,
  forgotPasswordReq,
  verifyPassword,
  resendOtp,
};

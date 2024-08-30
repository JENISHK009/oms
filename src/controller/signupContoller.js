import { pool } from '../config/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  generateOTP,
  sendSuccess,
  generateJwtToken,
  replacePlaceholders,
  sendEmail,
  generateAuthToken,
} from '../utils/index.js';
import { adminRoleName, sellerRoleName } from '../enum/index.js';

const signup = async (req, res) => {
  try {
    let { email, mobileNumber, countryCode } = req.body;
    email = email.toLowerCase();
    if (!email || !mobileNumber || !countryCode) {
      return res
        .status(400)
        .json({ error: 'Email, mobile number, and country code are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const mobileNumberRegex = /^[0-9]{10,20}$/;
    if (!mobileNumberRegex.test(mobileNumber)) {
      return res.status(400).json({ error: 'Invalid mobile number format' });
    }

    const existingUser = await pool.query(
      `
        SELECT * FROM OMS."users" 
        WHERE (email = $1 OR ("mobileNumber" = $2 and "countryCode" = $3)) AND "isVerified" = true and "deletedAt" is null
      `,
      [email, mobileNumber, countryCode]
    );

    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .json({ error: 'Email or mobile number already exists' });
    }

    const otpCode = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const result = await pool.query(
      `
        INSERT INTO OMS."userSignup" (email, "mobileNumber", "countryCode", otp)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        email,
        mobileNumber,
        countryCode,
        JSON.stringify({ code: otpCode, expiresAt: otpExpiry.toISOString() }),
      ]
    );

    const userSignupId = result.rows[0].id;

    const token = generateJwtToken(
      { id: userSignupId, email },
      {
        expiresIn: '1h',
      }
    );

    const templatePath = 'src/emailTemplates/otpSend.html';
    const emailBody = replacePlaceholders(templatePath, { OTP: otpCode });

    sendEmail(email, emailBody, 'Complete Your Signup with This OTP');
    sendSuccess(res, 'Signup successful, OTP sent to email', {
      userSignupId,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const verifySignupOtp = async (req, res) => {
  try {
    console.log('verifySignupOtp');
    let { token, otp, password } = req.body;
    const roleId = adminRoleName['SELLER'];

    if (!token || !otp || !password) {
      return res
        .status(400)
        .json({ error: 'Token, OTP, and password are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.SECRET_KEY);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    let { id, email } = decoded;
    email = email.toLowerCase();

    const userResult = await pool.query(
      `SELECT * FROM OMS."userSignup" WHERE id = $1 AND email = $2`,
      [id, email]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const { code, expiresAt } = user.otp;
    if (code !== otp || new Date(expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertUser = await pool.query(
      `
        INSERT INTO OMS."users" (email, "mobileNumber", "roleId", "countryCode", "password",  "isVerified", active, "isPasswordChange")
        VALUES ($1, $2, $3, $4, $5, $6, true, false)
        RETURNING id
      `,
      [
        email,
        userResult?.rows[0]?.mobileNumber,
        roleId,
        userResult?.rows[0]?.countryCode,
        hashedPassword,
        true,
      ]
    );

    const userData = await pool.query(
      ` SELECT u.*, r.name AS "roleName"
FROM OMS."users" u
INNER JOIN OMS."roles" r ON u."roleId" = r.id
WHERE u.id = $1 and u."deletedAt" is null`,
      [insertUser.rows[0].id]
    );

    const data = await generateAuthToken(userData.rows[0]);
    sendSuccess(res, 'User successfully verified and updated', data.token);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.SECRET_KEY);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    let { id, email } = decoded;

    email = email.toLowerCase();

    const userResult = await pool.query(
      `SELECT * FROM OMS."users" WHERE id = $1 AND email = $2`,
      [id, email]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const otpCode = generateOTP();
    const otpExpiry = new Date(Date.now() + 60 * 1000);

    await pool.query(
      `
        UPDATE OMS."users"
        SET otp = $1
        WHERE id = $2
      `,
      [
        JSON.stringify({ code: otpCode, expiresAt: otpExpiry.toISOString() }),
        id,
      ]
    );

    const templatePath = 'src/emailTemplates/otpSend.html';
    const emailBody = replacePlaceholders(templatePath, { OTP: otpCode });

    sendEmail(email, emailBody, 'Complete Your Signup with This OTP');
    sendSuccess(res, 'New OTP has been sent to your email');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  signup,
  verifySignupOtp,
  resendOtp,
};

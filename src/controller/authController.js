import { pool } from '../config/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  generateOTP,
  sendSuccess,
  generateJwtToken,
  generateAuthToken,
  replacePlaceholders,
  sendEmail,
  generateAdminAuthToken,
} from '../utils/index.js';
import { adminRoleName } from '../enum/index.js';

const resetPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Current password and new password are required.' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        error: 'Current password and new password cannot be the same.',
      });
    }

    const passwordValidation =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordValidation.test(newPassword)) {
      return res.status(400).json({
        error:
          'New password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      });
    }

    const userId = req.currentUser.id;

    const user = await pool.query(
      `SELECT * FROM OMS."users" WHERE id = $1 and "deletedAt" is null`,
      [userId]
    );

    if (!user.rows[0]) {
      return res.status(400).json({ error: 'User not found' });
    }

    const dbPassword = user.rows[0].password;
    const isValidPassword = await bcrypt.compare(currentPassword, dbPassword);

    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE OMS."users" SET password = $1 WHERE id = $2`, [
      hashedNewPassword,
      userId,
    ]);

    sendSuccess(res, 'Password reset successfully');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const currentUser = req.currentUser;
    const updates = {};

    if (req.body.name) updates.name = req.body.name;
    if (req.body.email) updates.email = req.body.email.toLowerCase();
    if (req.body.mobileNumber) updates.mobileNumber = req.body.mobileNumber;
    if (req.body.countryCode) updates.countryCode = req.body.countryCode;
    const { storeName, address, storeIds, storeCategoryIds } = req.body;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const mobileNumberValidation = /^\d{8,12}$/;

    if (
      updates.mobileNumber &&
      !mobileNumberValidation.test(updates.mobileNumber)
    ) {
      return res
        .status(400)
        .json({ error: 'Mobile number must be between 8 to 12 digits' });
    }

    const userQuery = `SELECT * FROM OMS."users" WHERE "id" = $1`;
    const userResult = await pool.query(userQuery, [currentUser.id]);
    const existingUserData = userResult.rows[0];

    const existingUserQuery = `SELECT * FROM OMS."users" WHERE ("email" = $1 AND "isVerified" = true and "deletedAt" is null) OR ("mobileNumber" = $2 AND "countryCode" = $3 AND "isVerified" = true and "deletedAt" is null)`;
    const existingUserValues = [
      updates.email,
      updates.mobileNumber,
      updates.countryCode,
    ];

    const existingUser = await pool.query(
      existingUserQuery,
      existingUserValues
    );

    if (existingUser.rows[0] && existingUser.rows[0].id !== currentUser.id) {
      if (existingUser.rows[0].email.toLowerCase() === updates.email) {
        return res.status(400).json({ error: 'Email already exists' });
      } else {
        return res.status(400).json({ error: 'Mobile number already exists' });
      }
    }

    const isEmailUpdated =
      updates.email && updates.email !== existingUserData.email.toLowerCase();
    const isMobileNumberUpdated =
      (updates.mobileNumber &&
        updates.mobileNumber !== existingUserData.mobileNumber) ||
      (updates.countryCode &&
        updates.countryCode !== existingUserData.countryCode);

    if (isEmailUpdated || isMobileNumberUpdated) {
      let message;

      const emailOtp = isEmailUpdated ? generateOTP() : null;
      const mobileOtp = isMobileNumberUpdated ? generateOTP() : null;
      const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
      const otpData = {
        emailCode: emailOtp,
        mobileCode: mobileOtp,
        expiresAt: otpExpiry,
      };

      const updateOtpQuery = `UPDATE OMS."users" SET otp = $1, name = $2 WHERE id = $3`;
      await pool.query(updateOtpQuery, [otpData, updates.name, currentUser.id]);

      if (isEmailUpdated) {
        const templatePath = 'src/emailTemplates/otpSend.html';
        const emailBody = replacePlaceholders(templatePath, { OTP: emailOtp });

        sendEmail(
          existingUserData.email,
          emailBody,
          'Verify OTP for update email'
        );
      }

      if (isMobileNumberUpdated) {
        const templatePath = 'src/emailTemplates/otpSend.html';
        const emailBody = replacePlaceholders(templatePath, { OTP: mobileOtp });

        sendEmail(
          existingUserData.email,
          emailBody,
          'Verify OTP for update Mobile number'
        );
      }
      if (isEmailUpdated && isMobileNumberUpdated) {
        message = 'An OTP has been sent to your email and mobile number.';
      } else if (isEmailUpdated) {
        message = 'An OTP has been sent to your email.';
      } else if (isMobileNumberUpdated) {
        message = 'An OTP has been sent to your mobile number.';
      }
      const emailToken = isEmailUpdated
        ? generateJwtToken(
            { id: currentUser.id, email: updates.email },
            { expiresIn: '2h' }
          )
        : null;
      const mobileToken = isMobileNumberUpdated
        ? generateJwtToken(
            {
              id: currentUser.id,
              mobileNumber: updates.mobileNumber,
              countryCode: updates.countryCode,
            },
            { expiresIn: '2h' }
          )
        : null;

      if (storeIds.length > 0 || storeCategoryIds.length > 0) {
        const storeAssociationsQuery = `
            INSERT INTO OMS."userStoreAssociations" ("name", "address", "userId", "storeIds", "storeCategoryIds")
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT ("userId") 
            DO UPDATE 
            SET "storeIds" = EXCLUDED."storeIds", 
                "storeCategoryIds" = EXCLUDED."storeCategoryIds", 
                "name" = EXCLUDED."name", 
                "address" = EXCLUDED."address", 
                "updatedAt" = CURRENT_TIMESTAMP
          `;
        await pool.query(storeAssociationsQuery, [
          storeName,
          address,
          currentUser.id,
          storeIds,
          storeCategoryIds,
        ]);
      }
      return sendSuccess(res, message, { emailToken, mobileToken });
    }

    const queryAdminUsers = `UPDATE OMS."users" SET ${Object.keys(updates)
      .map((key, index) => `"${key}" = $${index + 1}`)
      .join(', ')} WHERE id = $${Object.keys(updates).length + 1}`;
    const valuesAdminUsers = [...Object.values(updates), currentUser.id];

    await pool.query(queryAdminUsers, valuesAdminUsers);

    if (storeIds.length > 0 || storeCategoryIds.length > 0) {
      const storeAssociationsQuery = `
        INSERT INTO OMS."userStoreAssociations" ("name", "address", "userId", "storeIds", "storeCategoryIds")
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ("userId") 
        DO UPDATE 
        SET "storeIds" = EXCLUDED."storeIds", 
            "storeCategoryIds" = EXCLUDED."storeCategoryIds", 
            "name" = EXCLUDED."name", 
            "address" = EXCLUDED."address", 
            "updatedAt" = CURRENT_TIMESTAMP
      `;
      await pool.query(storeAssociationsQuery, [
        storeName,
        address,
        currentUser.id,
        storeIds,
        storeCategoryIds,
      ]);
    }
    sendSuccess(res, 'Profile updated successfully');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const verifyOtpAndUpdateProfile = async (req, res) => {
  try {
    const { emailToken, mobileToken, emailOtp, mobileOtp } = req.body;

    let decodedEmailToken = null;
    let decodedMobileToken = null;

    if (emailToken) {
      try {
        decodedEmailToken = jwt.verify(emailToken, process.env.SECRET_KEY);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid email token' });
      }
    }

    if (mobileToken) {
      try {
        decodedMobileToken = jwt.verify(mobileToken, process.env.SECRET_KEY);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid mobile token' });
      }
    }

    const userId = decodedEmailToken?.id || decodedMobileToken?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found in tokens' });
    }

    const userQuery = `SELECT otp FROM OMS."users" WHERE "id" = $1 and "deletedAt" is null`;
    const userResult = await pool.query(userQuery, [userId]);
    const storedOtp = userResult.rows[0]?.otp;

    if (!storedOtp) {
      return res.status(400).json({ error: 'No OTP found' });
    }

    const now = new Date();
    const emailOtpValid =
      emailOtp &&
      storedOtp.emailCode === emailOtp &&
      new Date(storedOtp.expiresAt) >= now;
    const mobileOtpValid =
      mobileOtp &&
      storedOtp.mobileCode === mobileOtp &&
      new Date(storedOtp.expiresAt) >= now;

    if ((emailOtp && !emailOtpValid) || (mobileOtp && !mobileOtpValid)) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const updates = {};
    if (decodedEmailToken && emailOtpValid)
      updates.email = decodedEmailToken.email.toLowerCase();
    if (decodedMobileToken && mobileOtpValid) {
      updates.mobileNumber = decodedMobileToken.mobileNumber;
      updates.countryCode = decodedMobileToken.countryCode;
    }

    if (Object.keys(updates).length > 0) {
      const queryAdminUsers = `UPDATE OMS."users" SET ${Object.keys(updates)
        .map((key, index) => `"${key}" = $${index + 1}`)
        .join(', ')} WHERE id = $${Object.keys(updates).length + 1}`;
      const valuesAdminUsers = [...Object.values(updates), userId];

      await pool.query(queryAdminUsers, valuesAdminUsers);

      const clearOtpQuery = `UPDATE OMS."users" SET otp = NULL WHERE id = $1`;
      await pool.query(clearOtpQuery, [userId]);

      res.status(200).json({ message: 'Profile updated successfully' });
    } else {
      res.status(400).json({ error: 'No valid updates provided' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { emailToken, mobileToken } = req.body;

    if (!emailToken && !mobileToken) {
      return res.status(400).json({ error: 'At least one token is required' });
    }

    let decodedEmailToken = null;
    let decodedMobileToken = null;

    if (emailToken) {
      try {
        decodedEmailToken = jwt.verify(emailToken, process.env.SECRET_KEY);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid email token' });
      }
    }

    if (mobileToken) {
      try {
        decodedMobileToken = jwt.verify(mobileToken, process.env.SECRET_KEY);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid mobile token' });
      }
    }

    const userId = decodedEmailToken?.id || decodedMobileToken?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found in tokens' });
    }

    const userQuery = `SELECT * FROM OMS."users" WHERE "id" = $1 and "deletedAt" is null`;
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const emailOtp = emailToken ? generateOTP() : null;
    const mobileOtp = mobileToken ? generateOTP() : null;
    const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

    const otpData = {
      emailCode: emailOtp,
      mobileCode: mobileOtp,
      expiresAt: otpExpiry,
    };

    const updateOtpQuery = `UPDATE OMS."users" SET otp = $1 WHERE id = $2`;
    await pool.query(updateOtpQuery, [otpData, userId]);

    let message = '';

    if (emailOtp && mobileOtp) {
      message = 'An OTP has been sent to your email and mobile number.';
    } else if (emailOtp) {
      message = 'An OTP has been sent to your email.';
    } else if (mobileOtp) {
      message = 'An OTP has been sent to your mobile number.';
    } else {
      message = 'No OTP sent for verification.';
    }

    if (emailOtp) {
      const templatePath = 'src/emailTemplates/otpSend.html';
      const emailBody = replacePlaceholders(templatePath, { OTP: emailOtp });

      sendEmail(user.email, emailBody, 'Verify OTP for update email');
    }

    if (mobileOtp) {
      const templatePath = 'src/emailTemplates/otpSend.html';
      const emailBody = replacePlaceholders(templatePath, { OTP: mobileOtp });

      sendEmail(user.email, emailBody, 'Verify OTP for update Mobile number');
    }
    sendSuccess(res, message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const updatePassword = async (req, res) => {
  try {
    const userId = req.currentUser.id;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const passwordValidation =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordValidation.test(newPassword)) {
      return res.status(400).json({
        error:
          'Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateQuery = `
      UPDATE OMS."users"
      SET "password" = $1, "isPasswordChange" = false
      WHERE id = $2
    `;
    const updateValues = [hashedPassword, userId];

    await pool.query(updateQuery, updateValues);

    const userData = await pool.query(
      ` SELECT u.*, r.name AS "roleName"
    FROM OMS."users" u
    INNER JOIN OMS."roles" r ON u."roleId" = r.id
    WHERE u.id = $1 and u."deletedAt" is null`,
      [userId]
    );

    const data = await generateAuthToken(userData.rows[0]);

    sendSuccess(res, 'Password updated successfully', data.token);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const loginBackToDelegate = async (req, res) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser.delegateUserId) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    const userResult = await pool.query(
      `SELECT u.* ,  r.name as "roleName", r."isSystemRole" 
        FROM OMS."users" as u
        INNER JOIN OMS."roles" r ON u."roleId" = r.id
        WHERE u."id" = $1 and u."isVerified" = true and u."deletedAt" is null`,
      [currentUser.delegateUserId]
    );

    const userData = userResult.rows[0];

    if (!userData) {
      return res.status(400).json({ error: 'User not found' });
    }

    let userTokenData;
    let isAdminPanel;

    if (userData.isSystemRole && userData.roleId != adminRoleName['SELLER']) {
      console.log('if');
      userTokenData = await generateAdminAuthToken(userData);
      isAdminPanel = true;
    } else {
      console.log('else');
      userTokenData = await generateAuthToken(userData);
      isAdminPanel = false;
    }

    sendSuccess(res, null, { encryptToken: userTokenData.token, isAdminPanel });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
export default {
  resetPassword,
  updateProfile,
  verifyOtpAndUpdateProfile,
  resendOtp,
  updatePassword,
  loginBackToDelegate,
};

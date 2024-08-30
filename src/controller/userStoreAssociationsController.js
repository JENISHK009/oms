import { pool } from '../config/index.js';
import { sendSuccess, generateAuthToken, encrypt } from '../utils/index.js';

const createUserStoreAssociation = async (req, res) => {
  try {
    const { storeIds, storeCategoryIds, address, storeName, userName } =
      req.body;

    if (
      storeIds.length == 0 ||
      storeCategoryIds.length == 0 ||
      !storeName ||
      !userName
    ) {
      return res.status(400).json({ error: 'Please enter valid data' });
    }
    const currentUser = req.currentUser;
    const userId = currentUser.id || req.body.userId;
    if (
      !userId ||
      !Array.isArray(storeIds) ||
      !Array.isArray(storeCategoryIds)
    ) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const query = `
        INSERT INTO OMS."userStoreAssociations" ("userId", "storeIds", "storeCategoryIds","address","name" )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `;
    const values = [userId, storeIds, storeCategoryIds, address, storeName];
    const result = await pool.query(query, values);

    if (userName) {
      const updateUserNameQuery = `
        UPDATE OMS."users"
        SET "name" = $1
        WHERE id = $2
      `;
      await pool.query(updateUserNameQuery, [userName, userId]);
    }

    const userData = await pool.query(
      ` SELECT u.*, r.name AS "roleName"
    FROM OMS."users" u
    INNER JOIN OMS."roles" r ON u."roleId" = r.id
    WHERE u.id = $1 and u."deletedAt" is null`,
      [userId]
    );

    const data = await generateAuthToken(userData.rows[0]);

    sendSuccess(res, null, data.token);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getUserStoreAssociations = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const query = `
      SELECT "userId", "storeIds", "storeCategoryIds"
      FROM OMS."userStoreAssociations"
      WHERE "userId" = $1;
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({ error: 'No associations found for this user' });
    }

    sendSuccess(res, null, result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const addStoreCredentials = async (req, res) => {
  try {
    const { email, password, storeId } = req.body;
    const currentUser = req.currentUser;

    if (!email || !password || !storeId) {
      return res
        .status(400)
        .json({ error: 'Email, password  and store are required' });
    }

    const encryptedEmail = encrypt(email);
    const encryptedPassword = encrypt(password);

    const query = `
      INSERT INTO OMS."userStoreCred" ("storeId", email, password, "userId")
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [storeId, encryptedEmail, encryptedPassword, currentUser.id];

    const result = await pool.query(query, values);

    res.status(200).json({
      message: 'Store credentials added successfully',
    });
  } catch (error) {
    console.error('Error adding store credentials:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export default {
  createUserStoreAssociation,
  getUserStoreAssociations,
  addStoreCredentials,
};

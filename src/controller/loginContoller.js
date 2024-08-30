import { pool } from '../config/index.js';
import bcrypt from 'bcrypt';
import { generateAuthToken, sendNotificationToFirebase, firebaseSubscribeToMultipleTopics } from '../utils/index.js';
import { adminRoles } from '../enum/index.js';

const login = async (req, res) => {
  try {
    let { email, password, firebaseToken } = req.body;
    email = email.toLowerCase();

    const user = await pool.query(
      `SELECT u.*, r.name as "roleName" 
      FROM OMS."users" u
      INNER JOIN OMS."roles" r ON u."roleId" = r.id
      WHERE email = $1  and "isVerified" = true and "deletedAt" is null and r."name" = 'SELLER'`,
      [email]
    );

    if (!user.rows[0]) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const userData = user?.rows[0];

    if (!userData.active) {
      return res
        .status(400)
        .json({ error: 'Account is inactive. Please contact administration.' });
    }

    const hashedPassword = userData.password;
    const isValid = await bcrypt.compare(password, hashedPassword);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    if (firebaseToken) {
      const storeCategories = await pool.query(
        `SELECT array_agg(sc."name") AS categoryNames
      FROM OMS."userStoreAssociations" usa
      LEFT JOIN OMS."storeCategories" sc 
          ON sc.id = ANY(usa."storeCategoryIds"::integer[])
      WHERE usa."userId" = $1;`,
        [user?.rows[0]?.id]
      );

      if (storeCategories?.rows[0]?.categorynames?.length > 0) {
        await firebaseSubscribeToMultipleTopics(firebaseToken, storeCategories?.rows[0]?.categorynames)
      }
      await pool.query(
        `UPDATE OMS."users" 
        SET "firebaseToken" = $1 
        WHERE id = $2`,
        [firebaseToken, userData?.id]
      );

      const response = await sendNotificationToFirebase("hello", "You are logged in successfully", firebaseToken, userData?.id)
      if (!response)
        return res.status(500).json({ error: 'Something went wrong while send Notfication to Firebase' });
    }

    const data = await generateAuthToken(userData);

    res.json({
      token: data?.token,
      adminUserId: userData?.id,
      email: userData?.email,
    });
  } catch (error) {
    console.error("error while login::", error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  login,
};

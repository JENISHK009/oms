import { pool } from '../config/index.js';

const logEmail = async ({ recipient, subject, body, status, errorMessage }) => {
  try {
    const query = `
      INSERT INTO OMS."emailLogs" (recipient, subject, body, status, "errorMessage")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, "createdAt";
    `;
    const values = [recipient, subject, body, status, errorMessage];
    const result = await pool.query(query, values);

    return result.rows[0];
  } catch (error) {
    console.error('Error logging email:', error);
    throw new Error('Failed to log email');
  }
};

export { logEmail };

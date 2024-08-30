import { pool } from '../config/index.js';
import { sendSuccess } from '../utils/index.js';
import { adminRoleName } from '../enum/index.js';

const createTask = async (req, res) => {
  try {
    const { title, description, assignee, status } = req.body;
    const currentUser = req.currentUser;

    if (!title || !description) {
      return res
        .status(400)
        .json({ error: 'Title and Description are required' });
    }

    let assigneeExist = await pool.query(
      `select * from oms.users where id = $1 and "createdBy" = $2`,
      [assignee, currentUser.id]
    );
    if (!assigneeExist.rows[0]) {
      return res.status(400).json({ error: 'Assignee not found' });
    }

    const query = `
      INSERT INTO oms."sellerTodo" (title, description, assignee, status, "createdBy")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, "createdAt", "updatedAt";
    `;
    const values = [title, description, assignee, status, currentUser.id];
    const result = await pool.query(query, values);

    sendSuccess(res, null, result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getTasks = async (req, res) => {
  try {
    const currentUser = req.currentUser;
    let tasks;

    if (currentUser.roleId === adminRoleName['SELLER']) {
      const query = `
        SELECT * FROM oms."sellerTodo"
        WHERE "createdBy" = $1
        ORDER BY "createdAt" DESC;
      `;
      const values = [currentUser.id];
      tasks = await pool.query(query, values);
    } else {
      const query = `
        SELECT * FROM oms."sellerTodo"
        WHERE assignee = $1
        ORDER BY "createdAt" DESC;
      `;
      const values = [currentUser.id];
      tasks = await pool.query(query, values);
    }

    sendSuccess(res, null, tasks.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  createTask,
  getTasks,
};

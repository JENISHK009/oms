import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

import {
  createModulesTable,
  createRoleAccessContoleTable,
  createRoleTable,
  createUserTable,
  createUserAccessControlTable,
  createActionContoleTable,
  createUserStoreAssociationsTabel,
  createSellerActivityLogsTable,
  createUserSubscriptionsTabel,
  createFirebaseNotificationTable,
  createUserSignUpTable,
  createUserTopicTable,
  createUserStoreCredTable,
  createMeeshoOrderTable,
  createMeeshoOrdersPaymentTable,
  createpaymentHistoryTable
} from '../models/index.js';

const pool = new Pool({
  user: 'jenish',
  host: 'localhost',
  database: 'mydatabase',
  password: '123456',
  port: 5432,
});

const schemaName = 'oms';

const migrationFunction = async () => {
  try {
    const schemaExists = await pool.query(
      `SELECT 1 FROM pg_namespace WHERE nspname = '${schemaName}'`
    );
    if (!schemaExists.rows.length) {
      await pool.query(`CREATE SCHEMA ${schemaName};`);
    } else {
      console.log(`Schema '${schemaName}' already exists, skipping creation.`);
    }

    await pool.query(createModulesTable);
    await pool.query(createRoleAccessContoleTable);
    await pool.query(createRoleTable);
    await pool.query(createUserTable);
    await pool.query(createUserAccessControlTable);
    await pool.query(createActionContoleTable);
    await pool.query(createUserStoreAssociationsTabel);
    await pool.query(createSellerActivityLogsTable);
    await pool.query(createUserSubscriptionsTabel);
    await pool.query(createUserSignUpTable);
    await pool.query(createFirebaseNotificationTable);
    await pool.query(createUserTopicTable);
    await pool.query(createUserStoreCredTable);
    await pool.query(createMeeshoOrderTable);
    await pool.query(createMeeshoOrdersPaymentTable);
    await pool.query(createpaymentHistoryTable);

    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
  }
};

export { migrationFunction, pool };

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from '../config/index.js';
import { encrypt } from '../utils/index.js';

dotenv.config();

const generateAuthToken = async (userData, delegateUserId) => {
  const userId = userData.id;
  const baseUrl = process.env.BASE_URL;

  const allModulesQuery = `
    SELECT id AS "moduleId", name AS module
    FROM OMS."modules" WHERE "isSystemModule" = false
  `;
  const allModulesResult = await pool.query(allModulesQuery);
  const allModules = allModulesResult.rows.map(({ moduleId, module }) => ({
    moduleId,
    module,
  }));

  const rolePermissionsQuery = `
    SELECT 
      m.id AS "moduleId",
      m.name AS module,
      rac."id" AS "accessControlId",
      array_agg(a."name") AS "actionNames"
    FROM OMS."modules" m
    LEFT JOIN OMS."roleAccessControl" rac ON m.id = rac."moduleId" AND rac."roleId" = (
      SELECT "roleId" FROM OMS."users" WHERE id = $1 and "deletedAt" is null
    )
    LEFT JOIN LATERAL (
      SELECT a.id, a."name"
      FROM OMS."actions" a
      WHERE a.id = ANY (
        SELECT unnest(
          string_to_array(
            trim(both '{}' from rac."action"::text), ','
          )::int[]
        )
      )
      AND a."isSystemAction" = true
      AND a.status = 'active'
    ) a ON true
    GROUP BY m.id, m.name, rac."id"
  `;
  const rolePermissionsResult = await pool.query(rolePermissionsQuery, [
    userId,
  ]);

  const rolePermissions = rolePermissionsResult?.rows.map(
    ({ moduleId, module, accessControlId, actionNames }) => ({
      moduleId,
      module,
      accessControlId,
      action: (actionNames || []).filter((name) => name !== null),
    })
  );

  const userPermissionsQuery = `
    SELECT 
      m.id AS "moduleId",
      m.name AS module,
      uac."id" AS "accessControlId",
      array_agg(a."name") AS "actionNames"
    FROM OMS."modules" m
    INNER JOIN OMS."userAccessControl" uac ON m.id = uac."moduleId" AND uac."userId" = $1
    LEFT JOIN LATERAL (
      SELECT a.id, a."name"
      FROM OMS."actions" a
      WHERE a.id = ANY (
        SELECT unnest(
          string_to_array(
            trim(both '{}' from uac."action"::text), ','
          )::int[]
        )
      )
      AND a."isSystemAction" = true
      AND a.status = 'active'
    ) a ON true
    GROUP BY m.id, m.name, uac."id"
  `;
  const userPermissionsResult = await pool.query(userPermissionsQuery, [
    userId,
  ]);

  const userPermissions = userPermissionsResult?.rows.map(
    ({ moduleId, module, accessControlId, actionNames }) => ({
      moduleId,
      module,
      accessControlId,
      action: (actionNames || []).filter((name) => name !== null),
    })
  );

  const response = {};
  const mergedPermissions = allModules.reduce((acc, module) => {
    const rolePermission = rolePermissions.find(
      (rp) => rp.moduleId === module.moduleId
    );
    const userPermission = userPermissions.find(
      (up) => up.moduleId === module.moduleId
    );

    const actions = (
      userPermission?.action ||
      rolePermission?.action ||
      []
    ).filter((name) => name !== null);

    response[module.module] = actions;

    return response;
  }, []);

  const storeAssociationsQuery = `
    SELECT 
      id,
      "name",
      "address",
      "storeIds",
      "storeCategoryIds"
    FROM OMS."userStoreAssociations"
    WHERE "userId" = $1
  `;
  const storeAssociationsResult = await pool.query(storeAssociationsQuery, [
    userId,
  ]);
  const storeAssociations = storeAssociationsResult.rows;
  const storeIds = storeAssociations.flatMap((sa) => sa.storeIds || []);
  const storeCategoryIds = storeAssociations.flatMap(
    (sa) => sa.storeCategoryIds || []
  );

  const storeDetailsQuery = `
    SELECT id AS "storeId", name AS "storeName", image AS "storeImage"
    FROM OMS."stores"
    WHERE id = ANY($1::int[])
  `;
  const storeDetailsResult = await pool.query(storeDetailsQuery, [storeIds]);
  const storeDetails = storeDetailsResult.rows.map((store) => ({
    storeId: store.storeId,
    storeName: store.storeName,
    storeImage: store.storeImage
      ? `${baseUrl}/images/${store.storeImage}`
      : null,
  }));

  const storeCategoriesQuery = `
    SELECT id AS "categoryId", name AS "categoryName"
    FROM OMS."storeCategories" WHERE id = ANY($1::int[])
  `;
  const storeCategoriesResult = await pool.query(storeCategoriesQuery, [
    storeCategoryIds,
  ]);
  const storeCategories = storeCategoriesResult.rows;

  const hasStoreAssociations = storeAssociationsResult.rows.length > 0;

  const planExpiryQuery = `
    SELECT 
      us."endDate" AS "planExpiry"
    FROM OMS."userSubscriptions" us
    WHERE us."userId" = $1
      AND us."endDate" >= CURRENT_DATE
      AND us."endDate" <= CURRENT_DATE + INTERVAL '5 days'
      AND us."status" = 'active'
    ORDER BY us."endDate" ASC
    LIMIT 1
  `;
  const planExpiryResult = await pool.query(planExpiryQuery, [userId]);
  const planExpiry = planExpiryResult.rows[0]?.planExpiry || null;

  const recentPurchaseQuery = `
  select
	count(*)
from
	oms."userSubscriptions" us
where
  us."userId" = $1 and 
 	us."endDate" >= current_date
	and us.status = 'active';
  `;
  const recentPurchaseResult = await pool.query(recentPurchaseQuery, [userId]);

  const needToBuyPlan = Number(recentPurchaseResult.rows[0]?.count) == 0;

  const tokenData = {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    mobileNumber: userData.mobileNumber,
    countryCode: userData.countryCode,
    roleId: userData.roleId,
    active: userData.active,
    roleName: userData.roleName,
    isPasswordChange: userData.isPasswordChange,
    permissions: mergedPermissions,
    isSelectStore: !hasStoreAssociations,
    storeCategories,
    store: storeDetails,
    address: storeAssociations[0]?.address ?? null,
    storeName: storeAssociations[0]?.name ?? null,
    planExpiry,
    needToBuyPlan,
    delegateUserId,
  };

  const token = generateJwtToken(tokenData, {
    expiresIn: '1h',
  });

  return { token: encrypt(token), data: tokenData };
};

const generateAdminAuthToken = async (userData, delegateUserId) => {
  const userId = userData.id;

  const allModulesQuery = `
      SELECT id AS "moduleId", name AS module
      FROM OMS."modules" where "isSystemModule" = true
    `;
  const allModulesResult = await pool.query(allModulesQuery);
  const allModules = allModulesResult.rows.map(({ moduleId, module }) => ({
    moduleId,
    module,
  }));

  const rolePermissionsQuery = `
      SELECT 
        m.id AS "moduleId",
        m.name AS module,
        rac."id" AS "accessControlId",
        array_agg(a."name") AS "actionNames"
      FROM OMS."modules" m
      LEFT JOIN OMS."roleAccessControl" rac ON m.id = rac."moduleId" AND rac."roleId" = (
        SELECT "roleId" FROM OMS."users" WHERE id = $1 and "deletedAt" is null
      )
      LEFT JOIN LATERAL (
        SELECT a.id, a."name"
        FROM OMS."actions" a
        WHERE a.id = ANY (
          SELECT unnest(
            string_to_array(
              trim(both '{}' from rac."action"::text), ','
            )::int[]
          )
        )
        AND a."isSystemAction" = true
        AND a.status = 'active'
      ) a ON true
      GROUP BY m.id, m.name, rac."id"
    `;
  const rolePermissionsResult = await pool.query(rolePermissionsQuery, [
    userId,
  ]);

  const rolePermissions = rolePermissionsResult.rows.map(
    ({ moduleId, module, accessControlId, actionNames }) => ({
      moduleId,
      module,
      accessControlId,
      action: (actionNames || []).filter((name) => name !== null),
    })
  );

  const userPermissionsQuery = `
      SELECT 
        m.id AS "moduleId",
        m.name AS module,
        uac."id" AS "accessControlId",
        array_agg(a."name") AS "actionNames"
      FROM OMS."modules" m
      INNER JOIN OMS."userAccessControl" uac ON m.id = uac."moduleId" AND uac."userId" = $1
      LEFT JOIN LATERAL (
        SELECT a.id, a."name"
        FROM OMS."actions" a
        WHERE a.id = ANY (
          SELECT unnest(
            string_to_array(
              trim(both '{}' from uac."action"::text), ','
            )::int[]
          )
        )
        AND a."isSystemAction" = true
        AND a.status = 'active'
      ) a ON true
      GROUP BY m.id, m.name, uac."id"
    `;
  const userPermissionsResult = await pool.query(userPermissionsQuery, [
    userId,
  ]);

  const userPermissions = userPermissionsResult.rows.map(
    ({ moduleId, module, accessControlId, actionNames }) => ({
      moduleId,
      module,
      accessControlId,
      action: (actionNames || []).filter((name) => name !== null),
    })
  );
  let response = {};
  const mergedPermissions = allModules.reduce((acc, module) => {
    const rolePermission = rolePermissions.find(
      (rp) => rp.moduleId === module.moduleId
    );
    const userPermission = userPermissions.find(
      (up) => up.moduleId === module.moduleId
    );

    const actions = (
      userPermission?.action ||
      rolePermission?.action ||
      []
    ).filter((name) => name !== null);

    response[module.module] = actions;

    return response;
  }, []);

  const tokenData = {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    mobileNumber: userData.mobileNumber,
    countryCode: userData.countryCode,
    roleId: userData.roleId,
    active: userData.active,
    roleName: userData.roleName,
    permissions: mergedPermissions,
  };
  const token = generateJwtToken(tokenData, {
    expiresIn: '1h',
  });

  const encryptToken = encrypt(token);

  return { token: encryptToken, data: tokenData };
};

const generateJwtToken = (data, options = {}) => {
  try {
    const token = jwt.sign(data, process.env.SECRET_KEY, options);
    return token;
  } catch (error) {
    console.error('Error generating JWT token:', error);
    throw new Error('Failed to generate JWT token');
  }
};

export { generateJwtToken, generateAuthToken, generateAdminAuthToken };

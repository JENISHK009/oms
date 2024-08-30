import { adminRoles } from '../enum/index.js';

export const createRoleTable = `

CREATE TABLE IF NOT EXISTS OMS."roles" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  "createdBy" INTEGER,  
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(10) DEFAULT 'active' NOT NULL CHECK(status IN ('active', 'inActive')),
  "isSystemRole" BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO OMS."roles" (id, name, "isSystemRole") VALUES
  ${Object.keys(adminRoles)
    .map((id) => `(${id}, '${adminRoles[id]}', TRUE)`)
    .join(', ')}
  ON CONFLICT (id) DO NOTHING;

  
  `;

// ALTER SEQUENCE OMS."roles_id_seq" RESTART WITH ${
//   Object.keys(adminRoles).length + 1
// };

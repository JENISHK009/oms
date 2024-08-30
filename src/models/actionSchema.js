export const createActionContoleTable = `
CREATE TABLE IF NOT EXISTS OMS."actions" (
    id SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSystemAction" BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inActive'))
  );
`;

export const createModulesTable = `
  CREATE TABLE IF NOT EXISTS OMS."modules" (
    id SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "createdBy" INTEGER NOT NULL    ,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSystemModule" BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(10) DEFAULT 'active' NOT NULL CHECK(status IN ('active', 'inActive'))
  );
`;

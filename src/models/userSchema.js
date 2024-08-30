export const createUserTable = `
  CREATE TABLE IF NOT EXISTS OMS."users" (
    id SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    "mobileNumber" VARCHAR(20) NOT NULL,
    "countryCode" VARCHAR(5) NOT NULL,
    "roleId" INTEGER NOT NULL,
    "createdBy" INTEGER,  
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "isPasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "password" VARCHAR(255) NOT NULL,
    "firebaseToken" TEXT,
    otp JSONB
  ); 
`;

// ALTER TABLE OMS."users"
  // ADD COLUMN "firebaseToken" TEXT;
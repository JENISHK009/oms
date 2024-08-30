export const createUserSignUpTable = `
  CREATE TABLE IF NOT EXISTS OMS."userSignup" (
    id SERIAL PRIMARY KEY,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "mobileNumber" VARCHAR(20) NOT NULL,
    "countryCode" VARCHAR(5) NOT NULL,      
    "otp" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP  
  );
`;

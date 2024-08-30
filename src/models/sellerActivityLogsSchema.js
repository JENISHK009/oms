export const createSellerActivityLogsTable = `
    CREATE TABLE IF NOT EXISTS OMS."sellerActivityLogs" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER,
        "userName" VARCHAR(255),
        "requestTime" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "requestPayload" JSONB,
        "responsePayload" JSONB,
        "apiUrl" VARCHAR(2048)
    );
`;

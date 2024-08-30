export const createUserSubscriptionsTabel = `
    CREATE TABLE IF NOT EXISTS OMS."userSubscriptions" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "planId" INTEGER NOT NULL,
        "purchaseDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'active',
        "totalPrice" NUMERIC NOT NULL,
        "isMonthly" BOOLEAN
    );
`;

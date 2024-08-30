import { pool } from '../config/index.js';
import {
  sendSuccess,
  paginate,
  processRazorpayPayment,
  processStripePayment
} from '../utils/index.js';

const getPlans = async (req, res) => {
  try {
    const query =
      'SELECT * FROM OMS."subscriptionPlans" where active = true ORDER BY id desc';
    const { rows } = await pool.query(query);

    const plansWithDiscount = rows.map((plan) => {
      const monthlyPrice = plan.monthlyPrice;
      const annualPrice = plan.annualPrice;
      const expectedAnnualPrice = monthlyPrice * 12;

      const yearlyDiscountPercentage = (
        ((expectedAnnualPrice - annualPrice) / expectedAnnualPrice) *
        100
      ).toFixed(2);

      return {
        ...plan,
        yearlyDiscount: parseFloat(yearlyDiscountPercentage),
      };
    });

    sendSuccess(res, null, plansWithDiscount);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const purchasePlan = async (req, res) => {
  const { planId, isMonthly } = req.body;
  const userId = req.currentUser.id;

  if (!planId || isNaN(parseInt(planId))) {
    return res.status(400).json({ error: 'Valid plan ID is required' });
  }

  if (typeof isMonthly !== 'boolean') {
    return res.status(400).json({ error: 'isMonthly must be a boolean value' });
  }

  try {
    const planQuery =
      'SELECT * FROM OMS."subscriptionPlans" WHERE id = $1 AND "active" = TRUE';
    const planResult = await pool.query(planQuery, [planId]);

    if (planResult.rowCount === 0) {
      return res
        .status(400)
        .json({ error: 'The plan is not active or does not exist' });
    }

    const plan = planResult.rows[0];
    const totalPrice = isMonthly ? plan.monthlyPrice : plan.annualPrice;

    const paymentGatewayQuery = `
      SELECT * FROM OMS."paymentGateways"
      WHERE active = TRUE AND "deletedAt" IS NULL
      LIMIT 1
    `;
    const paymentGatewayResult = await pool.query(paymentGatewayQuery);

    if (paymentGatewayResult.rowCount === 0) {
      return res.status(400).json({ error: 'No active payment gateway found' });
    }

    const paymentGateway = paymentGatewayResult.rows[0];
    const { name } = paymentGateway;

    let paymentResponse;
    switch (name) {
      case 'Razorpay':
        try {
          paymentResponse = await processRazorpayPayment(
            totalPrice,
            `order_${Date.now()}`
          );
        } catch (error) {
          return res
            .status(500)
            .json({ error: 'Failed to process payment with Razorpay.' });
        }
        break;
      case 'Stripe':
        try {
          paymentResponse = await processStripePayment(
            totalPrice,
            plan?.name,
            planId
          );
        } catch (error) {
          return res
            .status(500)
            .json({ error: 'Failed to process payment with Stripe.' });
        }
        break;
      default:
        return res.status(400).json({ error: 'Unsupported payment gateway' });
    }

    // const currentDate = new Date();

    // const existingSubscriptionQuery = `
    //   SELECT * FROM OMS."userSubscriptions"
    //   WHERE "userId" = $1 AND status = 'active'
    //   ORDER BY "endDate" DESC
    //   LIMIT 1
    // `;
    // const existingSubscriptionResult = await pool.query(
    //   existingSubscriptionQuery,
    //   [userId]
    // );

    // let startDate = currentDate;
    // let endDate;

    // if (existingSubscriptionResult.rowCount > 0) {
    //   const existingSubscription = existingSubscriptionResult.rows[0];

    //   if (currentDate <= new Date(existingSubscription.endDate)) {
    //     startDate = new Date(existingSubscription.endDate.getTime());
    //   }

    //   if (isMonthly) {
    //     endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    //   } else {
    //     endDate = new Date(
    //       startDate.getFullYear() + 1,
    //       startDate.getMonth(),
    //       startDate.getDate()
    //     );
    //   }
    // } else {
    //   if (isMonthly) {
    //     endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    //   } else {
    //     endDate = new Date(
    //       startDate.getFullYear() + 1,
    //       startDate.getMonth(),
    //       startDate.getDate()
    //     );
    //   }
    // }

    // const purchaseQuery = `
    //   INSERT INTO OMS."userSubscriptions" ("userId", "planId", "purchaseDate", "startDate", "endDate", "status", "totalPrice", "isMonthly")
    //   VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, 'active', $5, $6)
    //   RETURNING id;
    // `;
    // const purchaseValues = [
    //   userId,
    //   planId,
    //   startDate,
    //   endDate,
    //   totalPrice,
    //   isMonthly,
    // ];
    // await pool.query(purchaseQuery, purchaseValues);

    sendSuccess(res, 'Payment link generated successfully', paymentResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getActivePlan = async (req, res) => {
  const userId = req.currentUser.id;

  try {
    const currentDate = new Date();

    const query = `
      SELECT us.*, sp.name, sp.description, sp.features, sp."monthlyPrice", sp."annualPrice"
      FROM OMS."userSubscriptions" us
      JOIN OMS."subscriptionPlans" sp ON us."planId" = sp.id
      WHERE us."userId" = $1
        AND us.status = 'active'
        AND us."startDate" <= $2
        AND us."endDate" >= $2
    `;

    const result = await pool.query(query, [userId, currentDate]);

    const activePlan = result.rows[0];

    sendSuccess(res, 'Active plan retrieved successfully.', activePlan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getPurchaseHistory = async (req, res) => {
  const userId = req.currentUser.id;
  const { page = 1, limit = 10 } = req.query;

  const pageNumber = parseInt(page);
  const pageSize = parseInt(limit);

  if (pageNumber <= 0 || pageSize <= 0) {
    return res.status(400).json({ error: 'Invalid page or limit parameter' });
  }

  const query = `
  SELECT us.*, 
       sp.name, 
       sp.description, 
       sp.features, 
       sp."monthlyPrice", 
       sp."annualPrice",
       CURRENT_TIMESTAMP AS currentTime,
       CASE
         WHEN us."endDate" >= CURRENT_TIMESTAMP AND us."startDate" < CURRENT_TIMESTAMP THEN TRUE
         ELSE FALSE
       END AS "isCurrentActivePlan",
       CASE
         WHEN us."endDate" < CURRENT_TIMESTAMP THEN
           'Expired'
         WHEN us."startDate" > CURRENT_TIMESTAMP THEN
           CONCAT('Upcoming')
         ELSE
           CONCAT('Expire')
       END AS "label"
FROM OMS."userSubscriptions" us
JOIN OMS."subscriptionPlans" sp ON us."planId" = sp.id
WHERE us."userId" = $1
ORDER BY us."purchaseDate" asc
  `;

  const countQuery = `
    SELECT COUNT(*) AS count
    FROM OMS."userSubscriptions"
    WHERE "userId" = $1
  `;

  try {
    const responseData = await paginate(
      query,
      countQuery,
      pageNumber,
      pageSize,
      [userId]
    );

    sendSuccess(res, 'Purchase history retrieved successfully.', responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getPlanById = async (req, res) => {
  const planId = req?.query?.planId;

  try {
    const query = `
      SELECT sp.*
      FROM OMS."subscriptionPlans" sp
      WHERE sp.id = $1 and sp."active" = true
    `;

    const result = await pool.query(query, [planId]);

    if (result?.rows?.length === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    const plan = result?.rows?.length > 0 && result?.rows[0];

    sendSuccess(res, 'Plan retrieved successfully.', plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


export default {
  getPlans,
  purchasePlan,
  getActivePlan,
  getPurchaseHistory,
  getPlanById
};

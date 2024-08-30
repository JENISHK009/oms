import Razorpay from 'razorpay';
import Stripe from 'stripe';
import { pool } from '../config/index.js';
import { encrypt } from '../utils/index.js';


const processRazorpayPayment = async (amount, receipt) => {
  try {
    const data = await pool.query(`
      SELECT * FROM OMS."paymentGateways"
      WHERE active = TRUE AND "deletedAt" IS NULL AND name = 'Razorpay'
    `);

    const paymentGatewayData = data.rows[0];

    if (!paymentGatewayData) {
      throw new Error('Razorpay gateway not found or inactive.');
    }
    const razorpay = new Razorpay({
      key_id: paymentGatewayData.accessKey,
      key_secret: paymentGatewayData.secretKey,
    });

    const paymentResponse = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: receipt,
    });

    return paymentResponse;
  } catch (error) {
    console.error('Razorpay Payment Error:', error);
    throw new Error('Failed to process payment with Razorpay.');
  }
};

const processStripePayment = async (amount, planName, planId) => {
  try {
    const data = await pool.query(`
    SELECT * FROM OMS."paymentGateways"
    WHERE active = TRUE AND "deletedAt" IS NULL AND name ilike '%Stripe%'
    `);

    console.log('data?.rows[0] :>> ', data?.rows[0]);
    const paymentGatewayData = data?.rows?.length > 0 && data?.rows[0];

    if (!paymentGatewayData) {
      throw new Error('Stripe gateway not found or inactive.');
    }
    const stripe = new Stripe(paymentGatewayData?.credentials?.secretKey);
    console.log('encrypt({ planId }) :>> ', encrypt(JSON.stringify({ planId })));
    console.log('process.env.FRONTEND_URL :>> ', process.env.FRONTEND_URL);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: planName,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment-successfully?payload=${encrypt(JSON.stringify({ planId }))}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription-plan`,
    });

    console.log('Stripe session.url :>> ', session.url);
    return { url: session.url };
  } catch (error) {
    console.error('Stripe Payment Error:', error);
    throw new Error('Failed to process payment with Stripe.');
  }
};

const purchasePlanProcess = async (userId, isMonthly, planId) => {
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

  const currentDate = new Date();

  const existingSubscriptionQuery = `
    SELECT * FROM OMS."userSubscriptions"
    WHERE "userId" = $1 AND status = 'active'
    ORDER BY "endDate" DESC
    LIMIT 1
  `;
  const existingSubscriptionResult = await pool.query(
    existingSubscriptionQuery,
    [userId]
  );

  let startDate = currentDate;
  let endDate;

  if (existingSubscriptionResult.rowCount > 0) {
    const existingSubscription = existingSubscriptionResult.rows[0];

    if (currentDate <= new Date(existingSubscription.endDate)) {
      startDate = new Date(existingSubscription.endDate.getTime());
    }

    if (isMonthly) {
      endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      endDate = new Date(
        startDate.getFullYear() + 1,
        startDate.getMonth(),
        startDate.getDate()
      );
    }
  } else {
    if (isMonthly) {
      endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      endDate = new Date(
        startDate.getFullYear() + 1,
        startDate.getMonth(),
        startDate.getDate()
      );
    }
  }

  const purchaseQuery = `
    INSERT INTO OMS."userSubscriptions" ("userId", "planId", "purchaseDate", "startDate", "endDate", "status", "totalPrice", "isMonthly")
    VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, 'active', $5, $6)
    RETURNING id;
  `;
  const purchaseValues = [
    userId,
    planId,
    startDate,
    endDate,
    totalPrice,
    isMonthly,
  ];
  await pool.query(purchaseQuery, purchaseValues);
}

export { processRazorpayPayment, processStripePayment, purchasePlanProcess };

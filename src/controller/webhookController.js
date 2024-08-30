import Stripe from 'stripe';
import { pool } from '../config/index.js';

const stripeWebhookForPaymentStatus = async (req, res) => {
    let paymentData = { paymentGateway: 'Stripe' }
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const data = await pool.query(`
            SELECT * FROM OMS."paymentGateways"
            WHERE active = TRUE AND "deletedAt" IS NULL AND name ilike '%Stripe%'
        `);

        const paymentGatewayData = data?.rows?.length > 0 && data?.rows[0];

        if (!paymentGatewayData) {
            throw new Error('Stripe gateway not found or inactive.');
        }

        const stripe = new Stripe(paymentGatewayData?.credentials?.secretKey);
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_SIGNING_SECRET);//signing secret
    } catch (err) {
        console.log('Webhook signature verification failed.', err);
        paymentData = {
            ...paymentData,
            paymentId: null,
            amount: null,
            paymentMethodType: null,
            status: 'failed',
            currency: null,
            customerName: null,
            email: null,
            error: err.message
        }
        await storePaymentHistoryData(paymentData)
    }


    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log(`PaymentIntent for ${paymentIntent.amount / 100} was successful!`);

            paymentData = {
                ...paymentData,
                paymentId: paymentIntent.id,
                amount: paymentIntent.amount / 100,
                paymentMethodType: paymentIntent.payment_method_types[0],
                status: paymentIntent.status,
                currency: paymentIntent.currency,
                customerName: paymentIntent.metadata.customer_name || null,
                email: paymentIntent.receipt_email || null
            }
            break;
        case 'invoice.payment_succeeded':
            const invoice = event.data.object;
            console.log(`Invoice ${invoice.id} was paid!`);
            paymentData = {
                ...paymentData,
                paymentId: invoice.payment_intent,
                amount: invoice.amount_paid / 100,
                paymentMethodType: invoice.payment_method_details.type,
                status: 'succeeded',
                currency: invoice.currency,
                customerName: invoice.customer_name || null,
                email: invoice.customer_email || null
            };
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    await storePaymentHistoryData(paymentData);
}

const storePaymentHistoryData = async (paymentData) => {
    try {
        await pool.query(`
            INSERT INTO OMS."paymentHistory" ("paymentGateway", "paymentId", "amount", "paymentMethod", "status", "currency", "customerName", "email", "error", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
            paymentData.paymentGateway || null,
            paymentData.paymentId || null,
            paymentData.amount || 0,
            paymentData.paymentMethodType || null,
            paymentData.status || null,
            paymentData.currency || null,
            paymentData.customerName || null,
            paymentData.email || null,
            paymentData.error || null
        ]);
    } catch (err) {
        console.error('Error while saving Payment history data:', err);
        throw new Error(err.message)
    }
};

export default { stripeWebhookForPaymentStatus }
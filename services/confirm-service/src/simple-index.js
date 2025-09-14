require('./tracing');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const redis = require('redis');
const { Pool } = require('pg');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());

const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

const RISK_SERVICE_URL = process.env.RISK_SERVICE_URL;
const OTP_SERVICE_URL = process.env.OTP_SERVICE_URL;
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL;
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;

async function initializeServices() {
  try {
    await redisClient.connect();
    console.log('✅ Confirm Service initialized (simplified)');
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    process.exit(1);
  }
}

const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];
  
  if (!idempotencyKey) {
    return res.status(400).json({
      error: 'MISSING_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key header is required'
    });
  }

  try {
    const cached = await redisClient.get(`confirm:${idempotencyKey}`);
    if (cached) {
      console.log(`🔄 Returning cached response for ${idempotencyKey}`);
      return res.json(JSON.parse(cached));
    }
    
    req.idempotencyKey = idempotencyKey;
    next();
  } catch (error) {
    console.error('Idempotency check failed:', error);
    res.status(500).json({ error: 'IDEMPOTENCY_CHECK_FAILED' });
  }
};

app.post('/payment/confirm', idempotencyMiddleware, async (req, res) => {
  try {
    const { transaction_id, otp, customer_id, amount } = req.body;
    const { idempotencyKey } = req;
    
    console.log(`🔄 Processing payment confirmation: ${transaction_id} - Amount: $${amount}`);

    // Create transaction if not exists
    try {
      await pgPool.query(
        'INSERT INTO transactions (id, customer_id, amount, status, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (id) DO NOTHING',
        [transaction_id, customer_id, amount, 'INITIATED']
      );
    } catch (dbError) {
      console.log('Transaction may already exist, continuing...');
    }

    console.log(`🔍 Calling risk assessment for ${transaction_id}`);
    const riskResponse = await axios.post(`${RISK_SERVICE_URL}/assess-risk`, {
      customer_id,
      transaction_id,
      amount: parseFloat(amount)
    });

    const requiresOTP = riskResponse.data.risk_level === 'HIGH';
    console.log(`🚨 Risk level: ${riskResponse.data.risk_level} (Score: ${riskResponse.data.risk_score})`);

    if (requiresOTP && !otp) {
      console.log(`📱 OTP required for high-risk transaction: ${transaction_id}`);
      await axios.post(`${OTP_SERVICE_URL}/generate-otp`, {
        customer_id,
        transaction_id
      });

      const otpResponse = {
        status: 'OTP_REQUIRED',
        message: 'OTP verification required',
        transaction_id,
        risk_level: riskResponse.data.risk_level
      };

      await redisClient.setEx(`confirm:${idempotencyKey}`, 86400, JSON.stringify(otpResponse));
      return res.json(otpResponse);
    }

    if (requiresOTP && otp) {
      console.log(`🔐 Verifying OTP for ${transaction_id}`);
      const otpVerification = await axios.post(`${OTP_SERVICE_URL}/verify-otp`, {
        customer_id,
        otp,
        transaction_id
      });

      if (!otpVerification.data.valid) {
        throw new Error('INVALID_OTP');
      }
      console.log(`✅ OTP verified successfully`);
    }

    console.log(`💰 Validating account for ${customer_id}`);
    await axios.post(`${ACCOUNT_SERVICE_URL}/validate-account`, {
      customer_id,
      required_amount: amount
    });

    await pgPool.query(
      'UPDATE transactions SET status = $1, confirmed_at = NOW() WHERE id = $2',
      ['CONFIRMED', transaction_id]
    );

    console.log(`📧 Sending notification for ${transaction_id}`);
    try {
      await axios.post(`${NOTIFICATION_SERVICE_URL}/send-notification`, {
        customer_id,
        type: 'PAYMENT_CONFIRMED',
        channels: ['sms', 'email'],
        data: { transaction_id, amount }
      });
    } catch (notifError) {
      console.log('Notification service unavailable, continuing...');
    }

    const reference = `PAY${Date.now()}`;
    const successResponse = {
      status: 'SUCCESS',
      transaction_id,
      reference,
      amount: parseFloat(amount),
      confirmed_at: new Date().toISOString(),
      risk_level: riskResponse.data.risk_level
    };

    await redisClient.setEx(`confirm:${idempotencyKey}`, 86400, JSON.stringify(successResponse));

    console.log(`✅ Payment confirmed successfully: ${transaction_id} - $${amount}`);
    res.json(successResponse);

  } catch (error) {
    console.error(`❌ Payment confirmation failed: ${error.message}`);
    res.status(400).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'confirm-service' });
});

const startServer = async () => {
  await initializeServices();
  app.listen(PORT, () => {
    console.log(`🚀 Confirm Service running on port ${PORT}`);
  });
};

startServer().catch(console.error);

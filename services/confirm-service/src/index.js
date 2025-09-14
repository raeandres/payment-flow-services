const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const redis = require('redis');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
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

const kafka = new Kafka({
  clientId: 'confirm-service',
  brokers: [process.env.KAFKA_BROKERS],
});

const producer = kafka.producer();

const RISK_SERVICE_URL = process.env.RISK_SERVICE_URL;
const OTP_SERVICE_URL = process.env.OTP_SERVICE_URL;
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL;
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;

async function initializeServices() {
  try {
    await redisClient.connect();
    await producer.connect();
    console.log('✅ Confirm Service initialized');
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
    
    console.log(`🔄 Processing confirm for transaction: ${transaction_id}`);

    const transactionQuery = 'SELECT * FROM transactions WHERE id = $1';
    const transactionResult = await pgPool.query(transactionQuery, [transaction_id]);
    
    if (transactionResult.rows.length === 0) {
      throw new Error('TRANSACTION_NOT_FOUND');
    }

    const riskResponse = await axios.post(`${RISK_SERVICE_URL}/assess-risk`, {
      customer_id,
      transaction_id,
      amount: parseFloat(amount)
    });

    const requiresOTP = riskResponse.data.risk_level === 'HIGH';

    if (requiresOTP && !otp) {
      await axios.post(`${OTP_SERVICE_URL}/generate-otp`, {
        customer_id,
        transaction_id
      });

      const otpResponse = {
        status: 'OTP_REQUIRED',
        message: 'OTP verification required',
        transaction_id
      };

      await redisClient.setEx(`confirm:${idempotencyKey}`, 86400, JSON.stringify(otpResponse));
      return res.json(otpResponse);
    }

    if (requiresOTP && otp) {
      const otpVerification = await axios.post(`${OTP_SERVICE_URL}/verify-otp`, {
        customer_id,
        otp,
        transaction_id
      });

      if (!otpVerification.data.valid) {
        throw new Error('INVALID_OTP');
      }
    }

    await axios.post(`${ACCOUNT_SERVICE_URL}/validate-account`, {
      customer_id,
      required_amount: amount
    });

    await pgPool.query(
      'UPDATE transactions SET status = $1, confirmed_at = NOW() WHERE id = $2',
      ['CONFIRMED', transaction_id]
    );

    await producer.send({
      topic: 'payment-events',
      messages: [{
        key: transaction_id,
        value: JSON.stringify({
          transaction_id,
          customer_id,
          amount,
          event_type: 'PAYMENT_CONFIRMED'
        })
      }]
    });

    await axios.post(`${NOTIFICATION_SERVICE_URL}/send-notification`, {
      customer_id,
      type: 'PAYMENT_CONFIRMED',
      channels: ['sms', 'email'],
      data: { transaction_id, amount }
    });

    const reference = `PAY${Date.now()}`;
    const successResponse = {
      status: 'SUCCESS',
      transaction_id,
      reference,
      amount: parseFloat(amount),
      confirmed_at: new Date().toISOString()
    };

    await redisClient.setEx(`confirm:${idempotencyKey}`, 86400, JSON.stringify(successResponse));

    console.log(`✅ Payment confirmed: ${transaction_id}`);
    res.json(successResponse);

  } catch (error) {
    console.error('❌ Confirm failed:', error);
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

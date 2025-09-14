require('./tracing');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});
redisClient.connect();

const CONFIRM_SERVICE_URL = process.env.CONFIRM_SERVICE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'ACCESS_TOKEN_REQUIRED' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'TOKEN_REVOKED' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(403).json({ error: 'INVALID_TOKEN' });
  }
};

const validateRequest = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        missing_fields: missingFields
      });
    }
    
    next();
  };
};

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (username === 'demo' && password === 'password123') {
      const token = jwt.sign(
        { 
          user_id: 'cust_001',
          username: 'demo',
          exp: Math.floor(Date.now() / 1000) + (60 * 60)
        },
        JWT_SECRET
      );
      
      console.log('✅ User authenticated successfully');
      res.json({
        success: true,
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600
      });
    } else {
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'AUTHENTICATION_FAILED' });
  }
});

app.post('/payment/confirm', 
  authenticateToken,
  validateRequest(['transaction_id', 'customer_id', 'amount']),
  async (req, res) => {
    try {
      console.log(`🛡️ API Gateway: Processing payment of $${req.body.amount} for user ${req.user.user_id}`);
      
      req.body.authenticated_user = req.user.user_id;
      
      const response = await axios.post(`${CONFIRM_SERVICE_URL}/payment/confirm`, req.body, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': req.user.user_id,
          'X-Correlation-ID': req.headers['x-correlation-id'] || crypto.randomUUID(),
          'Idempotency-Key': req.headers['idempotency-key']
        },
        timeout: 30000
      });
      
      console.log(`✅ Payment processed successfully: ${req.body.transaction_id}`);
      res.json(response.data);
      
    } catch (error) {
      console.error('❌ API Gateway error:', error.message);
      
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        res.status(503).json({ 
          error: 'SERVICE_UNAVAILABLE',
          message: 'Confirm service is currently unavailable'
        });
      } else {
        res.status(500).json({ 
          error: 'GATEWAY_ERROR',
          message: 'An internal error occurred'
        });
      }
    }
  }
);

app.get('/health', async (req, res) => {
  try {
    const dependencies = {};
    
    try {
      await redisClient.ping();
      dependencies.redis = 'healthy';
    } catch (error) {
      dependencies.redis = 'unhealthy';
    }
    
    try {
      await axios.get(`${CONFIRM_SERVICE_URL}/health`, { timeout: 5000 });
      dependencies.confirm_service = 'healthy';
    } catch (error) {
      dependencies.confirm_service = 'unhealthy';
    }
    
    res.json({
      status: 'healthy',
      service: 'api-gateway',
      dependencies,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
});

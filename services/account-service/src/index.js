const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3007;

app.use(express.json());

const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

redisClient.connect();

app.post('/validate-account', async (req, res) => {
  try {
    const { account_number, required_amount, customer_id } = req.body;
    
    const cacheKey = `account:${account_number}`;
    const cached = await redisClient.get(cacheKey);
    
    let account;
    if (cached) {
      account = JSON.parse(cached);
    } else {
      const query = `
        SELECT a.*, c.customer_id, c.email, c.phone
        FROM accounts a
        JOIN customers c ON a.customer_id = c.customer_id
        WHERE a.account_number = $1
      `;
      const result = await pgPool.query(query, [account_number]);
      
      if (result.rows.length === 0) {
        return res.json({
          valid: false,
          reason: 'ACCOUNT_NOT_FOUND'
        });
      }
      
      account = result.rows[0];
      await redisClient.setEx(cacheKey, 300, JSON.stringify(account));
    }
    
    if (customer_id && account.customer_id !== customer_id) {
      return res.json({
        valid: false,
        reason: 'ACCOUNT_OWNERSHIP_MISMATCH'
      });
    }
    
    const hasInsufficientFunds = required_amount && account.balance < required_amount;
    
    if (hasInsufficientFunds) {
      return res.json({
        valid: false,
        reason: 'INSUFFICIENT_FUNDS',
        available_balance: account.balance,
        required_amount
      });
    }
    
    res.json({
      valid: true,
      account: {
        account_number: account.account_number,
        account_type: account.account_type,
        balance: account.balance,
        customer_id: account.customer_id
      }
    });
    
  } catch (error) {
    console.error('Account validation failed:', error);
    res.status(500).json({
      valid: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'account-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Account Service running on port ${PORT}`);
});

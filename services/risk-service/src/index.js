const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

app.post('/assess-risk', async (req, res) => {
  try {
    const { customer_id, transaction_id, amount } = req.body;
    
    const historyQuery = `
      SELECT COUNT(*) as transaction_count, 
             SUM(amount) as total_amount
      FROM transactions 
      WHERE customer_id = $1 
      AND created_at > NOW() - INTERVAL '24 hours'
    `;
    const history = await pgPool.query(historyQuery, [customer_id]);
    
    let riskScore = 0;
    
    if (amount > 5000) riskScore += 30;
    if (amount > 10000) riskScore += 20;
    
    const dailyCount = history.rows[0].transaction_count;
    if (dailyCount > 5) riskScore += 25;
    
    const ofacCheck = await axios.post(`${process.env.OFAC_SERVICE_URL}/check-sanctions`, {
      customer_id
    });
    if (ofacCheck.data.is_sanctioned) riskScore += 100;
    
    const kycCheck = await axios.post(`${process.env.KYC_SERVICE_URL}/check-status`, {
      customer_id
    });
    if (!kycCheck.data.verified) riskScore += 40;
    
    const riskLevel = riskScore >= 50 ? 'HIGH' : 'LOW';
    
    const response = {
      transaction_id,
      customer_id,
      risk_score: riskScore,
      risk_level: riskLevel,
      factors: {
        amount: amount > 5000,
        frequency: dailyCount > 5,
        sanctions: ofacCheck.data.is_sanctioned,
        kyc_verified: kycCheck.data.verified
      }
    };
    
    console.log(`🚨 Risk assessment: ${riskLevel} (${riskScore}) for ${transaction_id}`);
    res.json(response);
    
  } catch (error) {
    console.error('Risk assessment failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'risk-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Risk Service running on port ${PORT}`);
});

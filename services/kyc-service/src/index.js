const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3010;

app.use(express.json());

const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

app.post('/check-status', async (req, res) => {
  try {
    const { customer_id } = req.body;
    
    // Mock KYC verification - in real implementation, check against KYC database
    const verified = !['UNVERIFIED_001', 'PENDING_002'].includes(customer_id);
    
    console.log(`🔍 KYC Check: ${customer_id} - ${verified ? 'VERIFIED' : 'NOT_VERIFIED'}`);
    
    res.json({
      customer_id,
      verified,
      verification_level: verified ? 'FULL' : 'NONE',
      last_updated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('KYC check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'kyc-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 KYC Service running on port ${PORT}`);
});

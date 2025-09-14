const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3008;

app.use(express.json());

const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

app.post('/log-audit', async (req, res) => {
  try {
    const { transaction_id, customer_id, action, details } = req.body;
    
    const query = `
      INSERT INTO audit_logs (transaction_id, customer_id, action, details, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    
    await pgPool.query(query, [transaction_id, customer_id, action, JSON.stringify(details)]);
    
    console.log(`📝 Audit logged: ${action} for ${transaction_id}`);
    
    res.json({
      success: true,
      message: 'Audit log created successfully'
    });
    
  } catch (error) {
    console.error('Audit logging failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'audit-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Audit Service running on port ${PORT}`);
});

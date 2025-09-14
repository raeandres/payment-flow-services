const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3011;

app.use(express.json());

app.post('/process-transfer', async (req, res) => {
  try {
    const { from_account, to_account, amount, routing_number } = req.body;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const success = amount < 50000;
    
    if (success) {
      const reference = `BNK${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      console.log(`🏦 Bank Transfer: ${amount} from ${from_account} to ${to_account} - SUCCESS`);
      
      res.json({
        success: true,
        reference_number: reference,
        status: 'COMPLETED',
        processed_amount: amount,
        processing_fee: 2.50,
        estimated_settlement: new Date(Date.now() + 24*60*60*1000).toISOString()
      });
    } else {
      console.log(`🏦 Bank Transfer: ${amount} - FAILED (amount too high)`);
      
      res.json({
        success: false,
        error_code: 'AMOUNT_EXCEEDS_LIMIT',
        message: 'Transfer amount exceeds daily limit'
      });
    }
    
  } catch (error) {
    console.error('Bank transfer failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/check-balance', (req, res) => {
  try {
    const { account_number } = req.body;
    
    const mockBalance = parseFloat(account_number.slice(-4)) * 10;
    
    res.json({
      account_number,
      available_balance: mockBalance,
      currency: 'USD',
      last_updated: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'partner-bank-api' });
});

app.listen(PORT, () => {
  console.log(`🚀 Partner Bank API running on port ${PORT}`);
});

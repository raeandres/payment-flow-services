const express = require('express');
const redis = require('redis');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());

const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

redisClient.connect();

app.post('/generate-otp', async (req, res) => {
  try {
    const { customer_id, transaction_id } = req.body;
    
    const otp = crypto.randomInt(100000, 999999).toString();
    
    await redisClient.setEx(`otp:${customer_id}`, 300, otp);
    
    console.log(`📱 OTP for ${customer_id}: ${otp}`);
    
    res.json({
      success: true,
      message: 'OTP sent successfully',
      expires_at: new Date(Date.now() + 300000).toISOString()
    });
    
  } catch (error) {
    console.error('OTP generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/verify-otp', async (req, res) => {
  try {
    const { customer_id, otp } = req.body;
    
    const storedOtp = await redisClient.get(`otp:${customer_id}`);
    
    if (!storedOtp) {
      return res.json({ valid: false, message: 'OTP expired or not found' });
    }
    
    if (storedOtp === otp) {
      await redisClient.del(`otp:${customer_id}`);
      res.json({ valid: true, message: 'OTP verified successfully' });
    } else {
      res.json({ valid: false, message: 'Invalid OTP' });
    }
    
  } catch (error) {
    console.error('OTP verification failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'otp-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 OTP Service running on port ${PORT}`);
});

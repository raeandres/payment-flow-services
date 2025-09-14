const express = require('express');

const app = express();
const PORT = process.env.PORT || 3009;

app.use(express.json());

const SANCTIONED_ENTITIES = [
  'BLOCKED_CUSTOMER_001',
  'SANCTIONED_ENTITY_002'
];

app.post('/check-sanctions', (req, res) => {
  try {
    const { customer_id, name, country } = req.body;
    
    const isSanctioned = SANCTIONED_ENTITIES.includes(customer_id);
    
    console.log(`⚠️ OFAC Check: ${customer_id} - ${isSanctioned ? 'SANCTIONED' : 'CLEAR'}`);
    
    res.json({
      customer_id,
      is_sanctioned: isSanctioned,
      check_timestamp: new Date().toISOString(),
      source: 'OFAC_SDN_LIST'
    });
    
  } catch (error) {
    console.error('OFAC check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'ofac-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 OFAC Service running on port ${PORT}`);
});

const express = require('express');
const { Kafka } = require('kafkajs');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BROKERS]
});

const consumer = kafka.consumer({ groupId: 'notification-group' });
const producer = kafka.producer();

const sendSMS = async (phone, message) => {
  console.log(`📱 SMS to ${phone}: ${message}`);
  return { success: true, messageId: `sms_${Date.now()}` };
};

const sendEmail = async (email, subject, message) => {
  console.log(`📧 Email to ${email}: ${subject} - ${message}`);
  return { success: true, messageId: `email_${Date.now()}` };
};

const sendPushNotification = async (userId, title, message) => {
  console.log(`🔔 Push to ${userId}: ${title} - ${message}`);
  return { success: true, messageId: `push_${Date.now()}` };
};

app.post('/send-notification', async (req, res) => {
  try {
    const { customer_id, type, channels, data } = req.body;
    
    const results = [];
    const message = formatMessage(type, data);
    
    for (const channel of channels) {
      switch (channel) {
        case 'sms':
          const smsResult = await sendSMS(`+1234567890`, message);
          results.push({ channel: 'sms', ...smsResult });
          break;
        case 'email':
          const emailResult = await sendEmail(`customer@example.com`, 'Payment Notification', message);
          results.push({ channel: 'email', ...emailResult });
          break;
        case 'push':
          const pushResult = await sendPushNotification(customer_id, 'Payment Update', message);
          results.push({ channel: 'push', ...pushResult });
          break;
      }
    }
    
    res.json({
      success: true,
      results,
      message: 'Notifications sent successfully'
    });
    
  } catch (error) {
    console.error('Notification failed:', error);
    res.status(500).json({ error: error.message });
  }
});

const formatMessage = (type, data) => {
  switch (type) {
    case 'PAYMENT_CONFIRMED':
      return `Payment of ${data.amount} confirmed. Transaction ID: ${data.transaction_id}`;
    case 'OTP_REQUIRED':
      return `OTP verification required for your payment transaction.`;
    default:
      return 'Payment system notification';
  }
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification-service' });
});

const startService = async () => {
  await producer.connect();
  
  app.listen(PORT, () => {
    console.log(`🚀 Notification Service running on port ${PORT}`);
  });
};

startService().catch(console.error);

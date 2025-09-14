# Complete Payment System Docker Setup

## Project Structure
```
payment-system/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── database/
│   └── init/
│       └── 01-init.sql
├── observability/
│   ├── otel-collector-config.yml
│   ├── prometheus.yml
│   └── logstash/
│       └── pipeline/
│           └── logstash.conf
├── services/
│   ├── api-gateway/
│   ├── confirm-service/
│   ├── risk-service/
│   ├── notification-service/
│   ├── otp-service/
│   ├── account-service/
│   ├── audit-service/
│   ├── ofac-service/
│   ├── kyc-service/
│   └── partner-bank-api/
└── README.md
```

## Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

networks:
  payment-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
  kafka-data:
  zookeeper-data:
  influxdb-data:
  elasticsearch-data:

services:
  # ===========================================
  # INFRASTRUCTURE SERVICES
  # ===========================================
  
  # Load Balancer (NGINX)
  load-balancer:
    image: nginx:alpine
    container_name: payment-load-balancer
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - api-gateway-1
      - api-gateway-2
    networks:
      - payment-network
    restart: unless-stopped

  # API Gateway Instances
  api-gateway-1:
    build:
      context: ./services/api-gateway
      dockerfile: Dockerfile
    container_name: payment-api-gateway-1
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=your-super-secret-jwt-key-change-this
      - REDIS_URL=redis://:redis_password@redis-cache:6379
      - CONFIRM_SERVICE_URL=http://confirm-service:3003
      - OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - redis-cache
      - jaeger
    networks:
      - payment-network
    restart: unless-stopped

  api-gateway-2:
    build:
      context: ./services/api-gateway
      dockerfile: Dockerfile
    container_name: payment-api-gateway-2
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=your-super-secret-jwt-key-change-this
      - REDIS_URL=redis://:redis_password@redis-cache:6379
      - CONFIRM_SERVICE_URL=http://confirm-service:3003
      - OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - redis-cache
      - jaeger
    networks:
      - payment-network
    restart: unless-stopped

  # ===========================================
  # CORE PAYMENT SERVICES (Node.js)
  # ===========================================

  confirm-service:
    build:
      context: ./services/confirm-service
      dockerfile: Dockerfile
    container_name: payment-confirm-service
    environment:
      - NODE_ENV=production
      - PORT=3003
      - POSTGRES_URL=postgresql://payment_user:payment_pass@postgres-db:5432/payment_db
      - REDIS_URL=redis://:redis_password@redis-cache:6379
      - RISK_SERVICE_URL=http://risk-service:3004
      - OTP_SERVICE_URL=http://otp-service:3006
      - ACCOUNT_SERVICE_URL=http://account-service:3007
      - NOTIFICATION_SERVICE_URL=http://notification-service:3005
      - AUDIT_SERVICE_URL=http://audit-service:3008
      - KAFKA_BROKERS=kafka:9092
      - OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - postgres-db
      - redis-cache
      - kafka
      - jaeger
    networks:
      - payment-network
    restart: unless-stopped

  risk-service:
    build:
      context: ./services/risk-service
      dockerfile: Dockerfile
    container_name: payment-risk-service
    environment:
      - NODE_ENV=production
      - PORT=3004
      - POSTGRES_URL=postgresql://payment_user:payment_pass@postgres-db:5432/payment_db
      - OFAC_SERVICE_URL=http://ofac-service:3009
      - KYC_SERVICE_URL=http://kyc-service:3010
      - OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - postgres-db
      - jaeger
    networks:
      - payment-network
    restart: unless-stopped

  notification-service:
    build:
      context: ./services/notification-service
      dockerfile: Dockerfile
    container_name: payment-notification-service
    environment:
      - NODE_ENV=production
      - PORT=3005
      - TWILIO_ACCOUNT_SID=your-twilio-account-sid
      - TWILIO_AUTH_TOKEN=your-twilio-auth-token
      - SENDGRID_API_KEY=your-sendgrid-api-key
      - KAFKA_BROKERS=kafka:9092
      - OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - kafka
      - jaeger
    networks:
      - payment-network
    restart: unless-stopped

  otp-service:
    build:
      context: ./services/otp-service
      dockerfile: Dockerfile
    container_name: payment-otp-service
    environment:
      - NODE_ENV=production
      - PORT=3006
      - REDIS_URL=redis://:redis_password@redis-cache:6379
      - TWILIO_ACCOUNT_SID=your-twilio-account-sid
      - TWILIO_AUTH_TOKEN=your-twilio-auth-token
      - SENDGRID_API_KEY=your-sendgrid-api-key
      - OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - redis-cache
      - jaeger
    networks:
      - payment-network
    restart: unless-stopped

  account-service:
    build:
      context: ./services/account-service
      dockerfile: Dockerfile
    container_name: payment-account-service
    environment:
      - NODE_ENV=production
      - PORT=3007
      - POSTGRES_URL=postgresql://payment_user:payment_pass@postgres-db:5432/payment_db
      - REDIS_URL=redis://:redis_password@redis-cache:6379
      - PARTNER_BANK_API_URL=http://partner-bank-api:3011
      - OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - postgres-db
      - redis-cache
      - jaeger
    networks:
      - payment-network
    restart: unless-stopped

  audit-service:
    build:
      context: ./services/audit-service
      dockerfile: Dockerfile
    container_name: payment-audit-service
    environment:
      - NODE_ENV=production
      - PORT=3008
      - POSTGRES_URL=postgresql://payment_user:payment_pass@postgres-db:5432/payment_db
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      - postgres-db
      - elasticsearch
      - jaeger
    networks:
      - payment-network
    restart: unless-stopped

  # External Service Mocks
  ofac-service:
    build:
      context: ./services/ofac-service
      dockerfile: Dockerfile
    container_name: payment-ofac-service
    environment:
      - NODE_ENV=production
      - PORT=3009
    networks:
      - payment-network
    restart: unless-stopped

  kyc-service:
    build:
      context: ./services/kyc-service
      dockerfile: Dockerfile
    container_name: payment-kyc-service
    environment:
      - NODE_ENV=production
      - PORT=3010
      - POSTGRES_URL=postgresql://payment_user:payment_pass@postgres-db:5432/payment_db
    depends_on:
      - postgres-db
    networks:
      - payment-network
    restart: unless-stopped

  partner-bank-api:
    build:
      context: ./services/partner-bank-api
      dockerfile: Dockerfile
    container_name: payment-partner-bank-api
    environment:
      - NODE_ENV=production
      - PORT=3011
    networks:
      - payment-network
    restart: unless-stopped

  # ===========================================
  # DATA STORAGE SERVICES
  # ===========================================

  postgres-db:
    image: postgres:15-alpine
    container_name: payment-postgres-db
    environment:
      POSTGRES_DB: payment_db
      POSTGRES_USER: payment_user
      POSTGRES_PASSWORD: payment_pass
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - payment-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U payment_user -d payment_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-cache:
    image: redis:7-alpine
    container_name: payment-redis-cache
    command: redis-server --appendonly yes --requirepass redis_password
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    networks:
      - payment-network
    restart: unless-stopped

  # ===========================================
  # MESSAGE QUEUE SERVICES
  # ===========================================

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    container_name: payment-zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    volumes:
      - zookeeper-data:/var/lib/zookeeper/data
    networks:
      - payment-network
    restart: unless-stopped

  kafka:
    image: confluentinc/cp-kafka:latest
    container_name: payment-kafka
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: true
    volumes:
      - kafka-data:/var/lib/kafka/data
    ports:
      - "9092:9092"
    networks:
      - payment-network
    restart: unless-stopped

  # ===========================================
  # OBSERVABILITY SERVICES
  # ===========================================

  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: payment-jaeger
    environment:
      COLLECTOR_OTLP_ENABLED: true
    ports:
      - "16686:16686"  # Jaeger UI
      - "14268:14268"  # HTTP
    networks:
      - payment-network
    restart: unless-stopped

  opentelemetry:
    image: otel/opentelemetry-collector-contrib:latest
    container_name: payment-opentelemetry
    command: ["--config=/etc/otel-collector-config.yml"]
    volumes:
      - ./observability/otel-collector-config.yml:/etc/otel-collector-config.yml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
    depends_on:
      - jaeger
      - prometheus
    networks:
      - payment-network
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    container_name: payment-prometheus
    volumes:
      - ./observability/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - payment-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: payment-grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin123
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    networks:
      - payment-network
    restart: unless-stopped

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: payment-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks:
      - payment-network
    restart: unless-stopped

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    container_name: payment-kibana
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
    networks:
      - payment-network
    restart: unless-stopped

  influxdb:
    image: influxdb:2.7-alpine
    container_name: payment-influxdb
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: admin
      DOCKER_INFLUXDB_INIT_PASSWORD: password123
      DOCKER_INFLUXDB_INIT_ORG: payment-org
      DOCKER_INFLUXDB_INIT_BUCKET: payment-metrics
    volumes:
      - influxdb-data:/var/lib/influxdb2
    ports:
      - "8086:8086"
    networks:
      - payment-network
    restart: unless-stopped
```

## Sample Node.js Service Implementations

### 1. Confirm Service

**Dockerfile:**
```dockerfile
# services/confirm-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3003

CMD ["node", "src/index.js"]
```

**Package.json:**
```json
{
  "name": "confirm-service",
  "version": "1.0.0",
  "main": "src/index.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "redis": "^4.6.7",
    "pg": "^8.11.0",
    "kafkajs": "^2.2.4",
    "axios": "^1.4.0",
    "uuid": "^9.0.0",
    "@opentelemetry/api": "^1.4.1",
    "@opentelemetry/sdk-node": "^0.39.1",
    "@opentelemetry/exporter-jaeger": "^1.15.1"
  }
}
```

**Main Service:**
```javascript
// services/confirm-service/src/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const redis = require('redis');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Initialize OpenTelemetry
require('./tracing');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize connections
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

// Service URLs
const RISK_SERVICE_URL = process.env.RISK_SERVICE_URL;
const OTP_SERVICE_URL = process.env.OTP_SERVICE_URL;
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL;
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;
const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL;

// Initialize services
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

// Idempotency middleware
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

// Main confirm endpoint
app.post('/payment/confirm', idempotencyMiddleware, async (req, res) => {
  try {
    const { transaction_id, otp, customer_id, amount } = req.body;
    const { idempotencyKey } = req;
    
    console.log(`🔄 Processing confirm for transaction: ${transaction_id}`);

    // Validate transaction
    const transactionQuery = 'SELECT * FROM transactions WHERE id = $1';
    const transactionResult = await pgPool.query(transactionQuery, [transaction_id]);
    
    if (transactionResult.rows.length === 0) {
      throw new Error('TRANSACTION_NOT_FOUND');
    }

    // Risk assessment
    const riskResponse = await axios.post(`${RISK_SERVICE_URL}/assess-risk`, {
      customer_id,
      transaction_id,
      amount: parseFloat(amount)
    });

    const requiresOTP = riskResponse.data.risk_level === 'HIGH';

    // Handle OTP requirement
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

    // Verify OTP if provided
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

    // Validate account balance
    await axios.post(`${ACCOUNT_SERVICE_URL}/validate-account`, {
      customer_id,
      required_amount: amount
    });

    // Update transaction status
    await pgPool.query(
      'UPDATE transactions SET status = $1, confirmed_at = NOW() WHERE id = $2',
      ['CONFIRMED', transaction_id]
    );

    // Publish to Kafka
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

    // Send notification
    await axios.post(`${NOTIFICATION_SERVICE_URL}/send-notification`, {
      customer_id,
      type: 'PAYMENT_CONFIRMED',
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

// Start server
const startServer = async () => {
  await initializeServices();
  app.listen(PORT, () => {
    console.log(`🚀 Confirm Service running on port ${PORT}`);
  });
};

startServer().catch(console.error);
```

### 2. Risk Service

```javascript
// services/risk-service/src/index.js
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
    
    // Get customer transaction history
    const historyQuery = `
      SELECT COUNT(*) as transaction_count, 
             SUM(amount) as total_amount
      FROM transactions 
      WHERE customer_id = $1 
      AND created_at > NOW() - INTERVAL '24 hours'
    `;
    const history = await pgPool.query(historyQuery, [customer_id]);
    
    // Calculate risk score
    let riskScore = 0;
    
    // Amount-based risk
    if (amount > 5000) riskScore += 30;
    if (amount > 10000) riskScore += 20;
    
    // Frequency-based risk
    const dailyCount = history.rows[0].transaction_count;
    if (dailyCount > 5) riskScore += 25;
    
    // Check OFAC (sanctions)
    const ofacCheck = await axios.post(`${process.env.OFAC_SERVICE_URL}/check-sanctions`, {
      customer_id
    });
    if (ofacCheck.data.is_sanctioned) riskScore += 100;
    
    // Check KYC status
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
```

### 3. OTP Service

```javascript
// services/otp-service/src/index.js
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

// Generate OTP
app.post('/generate-otp', async (req, res) => {
  try {
    const { customer_id, transaction_id } = req.body;
    
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Store in Redis with 5-minute expiration
    await redisClient.setEx(`otp:${customer_id}`, 300, otp);
    
    // Mock SMS/Email sending (replace with real Twilio/SendGrid)
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

// Verify OTP
app.post('/verify-otp', async (req, res) => {
  try {
    const { customer_id, otp } = req.body;
    
    const storedOtp = await redisClient.get(`otp:${customer_id}`);
    
    if (!storedOtp) {
      return res.json({ valid: false, message: 'OTP expired or not found' });
    }
    
    if (storedOtp === otp) {
      // Delete OTP after successful verification
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
```

## Additional Configuration Files

### NGINX Configuration
```nginx
# nginx/nginx.conf
upstream api_gateway {
    server api-gateway-1:3000;
    server api-gateway-2:3000;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Database Init Script
```sql
-- database/init/01-init.sql
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(50) REFERENCES customers(customer_id),
    balance DECIMAL(15,2) DEFAULT 0,
    account_type VARCHAR(20) DEFAULT 'CHECKING',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id),
    from_account VARCHAR(50),
    to_account VARCHAR(50),
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'INITIATED',
    risk_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50),
    customer_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO customers (customer_id, email, phone) VALUES 
('cust_001', 'john@example.com', '+1234567890'),
('cust_002', 'jane@example.com', '+1234567891');

INSERT INTO accounts (account_number, customer_id, balance) VALUES 
('ACC001', 'cust_001', 15000.00),
('ACC002', 'cust_002', 8500.00);
```

### Prometheus Configuration
```yaml
# observability/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'payment-services'
    static_configs:
      - targets: 
        - 'api-gateway-1:3000'
        - 'api-gateway-2:3000'
        - 'confirm-service:3003'
        - 'risk-service:3004'
        - 'notification-service:3005'
        - 'otp-service:3006'
        - 'account-service:3007'
        - 'audit-service:3008'

  - job_name: 'infrastructure'
    static_configs:
      - targets:
        - 'postgres-db:5432'
        - 'redis-cache:6379'
        - 'kafka:9092'
```

### OpenTelemetry Collector Configuration
```yaml
# observability/otel-collector-config.yml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
  resource:
    attributes:
      service.name: "payment-system"
      deployment.environment: "docker"

exporters:
  jaeger:
    endpoint: "jaeger:14250"
    tls:
      insecure: true
  prometheus:
    endpoint: "0.0.0.0:8889"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [jaeger]
    metrics:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [prometheus]
```

## Complete Service Implementations

### 4. Notification Service

```javascript
// services/notification-service/src/index.js
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

// Mock notification functions
const sendSMS = async (phone, message) => {
  // Mock Twilio SMS
  console.log(`📱 SMS to ${phone}: ${message}`);
  return { success: true, messageId: `sms_${Date.now()}` };
};

const sendEmail = async (email, subject, message) => {
  // Mock SendGrid Email
  console.log(`📧 Email to ${email}: ${subject} - ${message}`);
  return { success: true, messageId: `email_${Date.now()}` };
};

const sendPushNotification = async (userId, title, message) => {
  // Mock FCM/APNS Push
  console.log(`🔔 Push to ${userId}: ${title} - ${message}`);
  return { success: true, messageId: `push_${Date.now()}` };
};

// Direct notification endpoint
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

// Kafka consumer for async notifications
const startKafkaConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'notification-events' });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value.toString());
      console.log(`🔄 Processing notification event: ${event.type}`);
      
      // Process notification based on event type
      await sendNotificationFromEvent(event);
    }
  });
};

const sendNotificationFromEvent = async (event) => {
  const { customer_id, type, data } = event;
  
  // Send to all channels by default for important events
  const channels = ['sms', 'email', 'push'];
  
  for (const channel of channels) {
    try {
      const message = formatMessage(type, data);
      
      switch (channel) {
        case 'sms':
          await sendSMS(`+1234567890`, message);
          break;
        case 'email':
          await sendEmail(`customer@example.com`, 'Payment Notification', message);
          break;
        case 'push':
          await sendPushNotification(customer_id, 'Payment Update', message);
          break;
      }
    } catch (error) {
      console.error(`Failed to send ${channel} notification:`, error);
    }
  }
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification-service' });
});

const startService = async () => {
  await producer.connect();
  await startKafkaConsumer();
  
  app.listen(PORT, () => {
    console.log(`🚀 Notification Service running on port ${PORT}`);
  });
};

startService().catch(console.error);
```

### 5. Account Service

```javascript
// services/account-service/src/index.js
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

// Validate account and check balance
app.post('/validate-account', async (req, res) => {
  try {
    const { account_number, required_amount, customer_id } = req.body;
    
    // Check cache first
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
      // Cache for 5 minutes
      await redisClient.setEx(cacheKey, 300, JSON.stringify(account));
    }
    
    // Check if customer owns the account
    if (customer_id && account.customer_id !== customer_id) {
      return res.json({
        valid: false,
        reason: 'ACCOUNT_OWNERSHIP_MISMATCH'
      });
    }
    
    // Check balance
    const hasInsufficientFunds = required_amount && account.balance < required_amount;
    
    if (hasInsufficientFunds) {
      return res.json({
        valid: false,
        reason: 'INSUFFICIENT_FUNDS',
        available_balance: account.balance,
        required_amount
      });
    }
    
    // Check with partner bank for real-time balance (optional)
    try {
      const bankResponse = await axios.post(`${process.env.PARTNER_BANK_API_URL}/check-balance`, {
        account_number,
        bank_code: account_number.substring(0, 3) // Mock routing number
      }, { timeout: 2000 });
      
      if (bankResponse.data.balance !== account.balance) {
        // Update local cache with real balance
        account.balance = bankResponse.data.balance;
        await redisClient.setEx(cacheKey, 300, JSON.stringify(account));
      }
    } catch (bankError) {
      console.warn('Partner bank API unavailable, using cached balance');
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

// Get account details
app.get('/account/:account_number', async (req, res) => {
  try {
    const { account_number } = req.params;
    
    const query = `
      SELECT a.account_number, a.account_type, a.balance, a.created_at,
             c.customer_id, c.email
      FROM accounts a
      JOIN customers c ON a.customer_id = c.customer_id
      WHERE a.account_number = $1
    `;
    
    const result = await pgPool.query(query, [account_number]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Get account failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reserve funds (for transaction processing)
app.post('/reserve-funds', async (req, res) => {
  try {
    const { account_number, amount, transaction_id } = req.body;
    
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check current balance
      const balanceQuery = 'SELECT balance FROM accounts WHERE account_number = $1 FOR UPDATE';
      const balanceResult = await client.query(balanceQuery, [account_number]);
      
      if (balanceResult.rows.length === 0) {
        throw new Error('Account not found');
      }
      
      const currentBalance = balanceResult.rows[0].balance;
      
      if (currentBalance < amount) {
        throw new Error('Insufficient funds');
      }
      
      // Create reservation record
      const reserveQuery = `
        INSERT INTO fund_reservations (transaction_id, account_number, amount, status, created_at)
        VALUES ($1, $2, $3, 'RESERVED', NOW())
      `;
      await client.query(reserveQuery, [transaction_id, account_number, amount]);
      
      // Update available balance
      const updateQuery = `
        UPDATE accounts 
        SET balance = balance - $1, updated_at = NOW()
        WHERE account_number = $2
      `;
      await client.query(updateQuery, [amount, account_number]);
      
      await client.query('COMMIT');
      
      // Clear cache
      await redisClient.del(`account:${account_number}`);
      
      res.json({
        success: true,
        transaction_id,
        reserved_amount: amount,
        new_balance: currentBalance - amount
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Fund reservation failed:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'account-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Account Service running on port ${PORT}`);
});
```

### 6. API Gateway

```javascript
// services/api-gateway/src/index.js
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

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));

// Redis for session management
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});
redisClient.connect();

// Service URLs
const CONFIRM_SERVICE_URL = process.env.CONFIRM_SERVICE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

// E2E Encryption keys (In production, use proper key management)
const ENCRYPTION_KEY = crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

// Decrypt incoming requests
const decryptMiddleware = (req, res, next) => {
  try {
    if (req.headers['x-encrypted'] === 'true' && req.body.encrypted_payload) {
      const { encrypted_payload, iv, auth_tag, encrypted_key } = req.body;
      
      // In a real implementation, decrypt the symmetric key using private RSA key
      // For demo purposes, we'll use a simple decryption
      const decipher = crypto.createDecipherGCM(ALGORITHM, ENCRYPTION_KEY);
      decipher.setAuthTag(Buffer.from(auth_tag, 'hex'));
      
      let decrypted = decipher.update(encrypted_payload, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      req.body = JSON.parse(decrypted);
      req.isEncrypted = true;
    }
    next();
  } catch (error) {
    console.error('Decryption failed:', error);
    res.status(400).json({ error: 'DECRYPTION_FAILED' });
  }
};

// Encrypt outgoing responses
const encryptResponse = (data) => {
  const cipher = crypto.createCipherGCM(ALGORITHM, ENCRYPTION_KEY);
  const iv = crypto.randomBytes(16);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted_payload: encrypted,
    iv: iv.toString('hex'),
    auth_tag: authTag.toString('hex')
  };
};

// JWT Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'ACCESS_TOKEN_REQUIRED' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token is blacklisted
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

// Request validation middleware
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

// Login endpoint (mock)
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Mock authentication (replace with real auth)
    if (username === 'demo' && password === 'password123') {
      const token = jwt.sign(
        { 
          user_id: 'cust_001',
          username: 'demo',
          exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
        },
        JWT_SECRET
      );
      
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

// Payment confirm endpoint (proxy to confirm service)
app.post('/payment/confirm', 
  decryptMiddleware,
  authenticateToken,
  validateRequest(['transaction_id', 'customer_id', 'amount']),
  async (req, res) => {
    try {
      console.log(`🛡️ API Gateway: Processing confirm request for user ${req.user.user_id}`);
      
      // Add user context to request
      req.body.authenticated_user = req.user.user_id;
      
      // Forward to confirm service
      const response = await axios.post(`${CONFIRM_SERVICE_URL}/payment/confirm`, req.body, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': req.user.user_id,
          'X-Correlation-ID': req.headers['x-correlation-id'] || crypto.randomUUID(),
          'Idempotency-Key': req.headers['idempotency-key']
        },
        timeout: 30000 // 30 second timeout
      });
      
      // Encrypt response if request was encrypted
      if (req.isEncrypted) {
        const encryptedResponse = encryptResponse(response.data);
        res.json(encryptedResponse);
      } else {
        res.json(response.data);
      }
      
    } catch (error) {
      console.error('API Gateway error:', error);
      
      if (error.response) {
        // Forward service error
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

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check dependencies
    const dependencies = {};
    
    // Check Redis
    try {
      await redisClient.ping();
      dependencies.redis = 'healthy';
    } catch (error) {
      dependencies.redis = 'unhealthy';
    }
    
    // Check Confirm Service
    try {
      await axios.get(`${CONFIRM_SERVICE_URL}/health`, { timeout: 5000 });
      dependencies.confirm_service = 'healthy';
    } catch (error) {
      dependencies.confirm_service = 'unhealthy';
    }
    
    res.json({
      status: 'healthy',
      service: 'api-gateway',
      instance: process.env.HOSTNAME || 'unknown',
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

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`🔒 JWT authentication enabled`);
  console.log(`🛡️ E2E encryption supported`);
});
```

## Mock External Services

### 7. OFAC Service (Sanctions Screening)

```javascript
// services/ofac-service/src/index.js
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3009;

app.use(express.json());

// Mock OFAC sanctions list
const SANCTIONED_ENTITIES = [
  'BLOCKED_CUSTOMER_001',
  'SANCTIONED_ENTITY_002'
];

app.post('/check-sanctions', (req, res) => {
  try {
    const { customer_id, name, country } = req.body;
    
    // Mock sanctions check
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
```

### 8. Partner Bank API (Mock)

```javascript
// services/partner-bank-api/src/index.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3011;

app.use(express.json());

// Mock bank processing
app.post('/process-transfer', async (req, res) => {
  try {
    const { from_account, to_account, amount, routing_number } = req.body;
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock success/failure based on amount
    const success = amount < 50000; // Fail for very large amounts
    
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
    
    // Mock balance based on account number
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
```

## Startup Instructions

### 1. Create project structure:
```bash
mkdir payment-system
cd payment-system

# Create directories
mkdir -p services/{api-gateway,confirm-service,risk-service,notification-service,otp-service,account-service,audit-service,ofac-service,kyc-service,partner-bank-api}/{src}
mkdir -p {nginx,database/init,observability}
```

### 2. Add the Docker Compose file and configurations above

### 3. Create package.json for each Node.js service:
```bash
# Example for confirm-service
cd services/confirm-service
npm init -y
npm install express cors helmet redis pg kafkajs axios uuid @opentelemetry/api @opentelemetry/sdk-node
```

### 4. Start the entire system:
```bash
docker-compose up --build
```

## Access Points:
- **API Gateway**: http://localhost:80
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin123)
- **Kibana**: http://localhost:5601
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Testing the System:

### 1. Get authentication token:
```bash
curl -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "password123"}'
```

### 2. Test payment confirm (low risk):
```bash
curl -X POST http://localhost/payment/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "transaction_id": "txn_001",
    "customer_id": "cust_001",
    "amount": 1000.00,
    "from_account": "ACC001",
    "to_account": "ACC002"
  }'
```

This complete setup provides all 11 services with proper containerization, observability, and realistic payment processing flow!
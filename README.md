# Payment Flow Services

A distributed payment system with 11 microservices implementing inter-bank fund transfers with security, asynchronous communication, and full observability.

## Architecture Overview

### Core Services
- **API Gateway** (2 instances) - Load balanced entry point with JWT auth
- **Confirm Service** - Main payment confirmation orchestrator
- **Risk Service** - Risk assessment and fraud detection
- **OTP Service** - One-time password generation and verification
- **Account Service** - Account validation and balance management
- **Notification Service** - Multi-channel notifications (SMS, Email, Push)
- **Audit Service** - Transaction logging and compliance

### External Service Mocks
- **OFAC Service** - Sanctions screening
- **KYC Service** - Know Your Customer verification
- **Partner Bank API** - External bank integration

### Infrastructure
- **PostgreSQL** - Primary database
- **Redis** - Caching and session management
- **Kafka** - Event streaming and async messaging
- **NGINX** - Load balancer

### Observability Stack
- **Jaeger** - Distributed tracing
- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization
- **Elasticsearch + Kibana** - Log aggregation
- **OpenTelemetry** - Observability data collection

## Quick Start

### Prerequisites
- Docker and Docker Compose
- 8GB+ RAM recommended

### 1. Start the System
```bash
docker-compose up --build
```

### 2. Wait for Services
All services will be available in ~2-3 minutes. Monitor logs for "✅" indicators.

### 3. Access Points
- **API Gateway**: http://localhost
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin123)
- **Kibana**: http://localhost:5601

## Testing the Payment Flow

### 1. Get Authentication Token
```bash
curl -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "password123"}'
```

### 2. Test Low-Risk Payment (No OTP Required)
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

### 3. Test High-Risk Payment (OTP Required)
```bash
# First request triggers OTP
curl -X POST http://localhost/payment/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "transaction_id": "txn_002",
    "customer_id": "cust_001",
    "amount": 15000.00,
    "from_account": "ACC001",
    "to_account": "ACC002"
  }'

# Check logs for OTP, then confirm with OTP
curl -X POST http://localhost/payment/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Idempotency-Key: SAME_KEY_AS_ABOVE" \
  -d '{
    "transaction_id": "txn_002",
    "customer_id": "cust_001",
    "amount": 15000.00,
    "otp": "123456",
    "from_account": "ACC001",
    "to_account": "ACC002"
  }'
```

## Service Details

### Risk Assessment Logic
- Amount > $5,000: +30 risk points
- Amount > $10,000: +20 risk points  
- >5 transactions/day: +25 risk points
- OFAC sanctioned: +100 risk points
- KYC not verified: +40 risk points
- **Risk Level**: ≥50 points = HIGH (requires OTP)

### Security Features
- JWT authentication with Redis blacklisting
- Rate limiting (100 requests/15min per IP)
- Idempotency keys for duplicate prevention
- Helmet.js security headers
- Input validation and sanitization

### Observability Features
- Distributed tracing across all services
- Metrics collection and alerting
- Centralized logging with structured data
- Health checks for all services
- Performance monitoring

## Development

### Adding a New Service
1. Create service directory: `services/new-service/`
2. Add Dockerfile, package.json, and src/index.js
3. Update docker-compose.yml
4. Add service to observability configs

### Environment Variables
Key environment variables are configured in docker-compose.yml:
- Database connections
- Redis URLs
- Kafka brokers
- Service URLs
- API keys (Twilio, SendGrid)

### Database Schema
The system uses PostgreSQL with tables for:
- customers
- accounts  
- transactions
- audit_logs
- fund_reservations

## Production Considerations

### Security Enhancements Needed
- Replace demo JWT secret with proper key management
- Implement proper certificate management for HTTPS
- Add API rate limiting per user
- Implement proper encryption for sensitive data
- Add input validation and sanitization

### Scalability Improvements
- Add horizontal pod autoscaling
- Implement database read replicas
- Add Redis clustering
- Implement circuit breakers
- Add proper load balancing strategies

### Monitoring & Alerting
- Set up Grafana dashboards for business metrics
- Configure Prometheus alerting rules
- Implement log-based alerting
- Add uptime monitoring
- Set up error rate thresholds

## Troubleshooting

### Common Issues
1. **Services not starting**: Check Docker resources (8GB+ RAM needed)
2. **Database connection errors**: Wait for PostgreSQL health check
3. **Redis connection errors**: Ensure Redis is fully started
4. **Kafka errors**: Kafka takes ~30s to initialize

### Logs
```bash
# View all service logs
docker-compose logs -f

# View specific service
docker-compose logs -f confirm-service

# View infrastructure logs
docker-compose logs -f postgres-db redis-cache kafka
```

### Health Checks
```bash
# Check all service health
for port in 3003 3004 3005 3006 3007 3008 3009 3010 3011; do
  echo "Service on port $port:"
  curl -s http://localhost/health | jq .
done
```

## Architecture Decisions

### Why Microservices?
- **Scalability**: Each service can scale independently
- **Resilience**: Failure isolation between services  
- **Technology Diversity**: Different services can use optimal tech stacks
- **Team Autonomy**: Teams can develop and deploy independently

### Why Event-Driven Architecture?
- **Loose Coupling**: Services communicate via events, not direct calls
- **Scalability**: Async processing handles high throughput
- **Reliability**: Events can be replayed and processed multiple times
- **Auditability**: Complete event history for compliance

### Why This Tech Stack?
- **Node.js**: Fast development, good for I/O-heavy operations
- **PostgreSQL**: ACID compliance for financial transactions
- **Redis**: High-performance caching and session storage
- **Kafka**: Reliable event streaming with persistence
- **Docker**: Consistent deployment across environments

This system demonstrates enterprise-grade payment processing with proper security, observability, and scalability patterns.

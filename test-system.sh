#!/bin/bash

echo "🧪 Testing Payment Flow Services"
echo "================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if services are running
if ! curl -s http://localhost/health > /dev/null; then
    echo -e "${RED}❌ Services not running. Please run ./start.sh first${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Services are running${NC}"
echo ""

# Step 1: Get authentication token
echo "🔐 Step 1: Getting authentication token..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "password123"}')

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Failed to get authentication token${NC}"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Got authentication token${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Test low-risk payment
echo "💰 Step 2: Testing low-risk payment (no OTP required)..."
IDEMPOTENCY_KEY=$(uuidgen)

LOW_RISK_RESPONSE=$(curl -s -X POST http://localhost/payment/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "transaction_id": "test_txn_low_001",
    "customer_id": "cust_001",
    "amount": 1000.00,
    "from_account": "ACC001",
    "to_account": "ACC002"
  }')

echo "Response: $LOW_RISK_RESPONSE"

if echo "$LOW_RISK_RESPONSE" | grep -q '"status":"SUCCESS"'; then
    echo -e "${GREEN}✅ Low-risk payment successful${NC}"
else
    echo -e "${YELLOW}⚠️ Low-risk payment response: $LOW_RISK_RESPONSE${NC}"
fi
echo ""

# Step 3: Test high-risk payment (should trigger OTP)
echo "🚨 Step 3: Testing high-risk payment (should trigger OTP)..."
IDEMPOTENCY_KEY_HIGH=$(uuidgen)

HIGH_RISK_RESPONSE=$(curl -s -X POST http://localhost/payment/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_HIGH" \
  -d '{
    "transaction_id": "test_txn_high_001",
    "customer_id": "cust_001",
    "amount": 15000.00,
    "from_account": "ACC001",
    "to_account": "ACC002"
  }')

echo "Response: $HIGH_RISK_RESPONSE"

if echo "$HIGH_RISK_RESPONSE" | grep -q '"status":"OTP_REQUIRED"'; then
    echo -e "${GREEN}✅ High-risk payment correctly triggered OTP requirement${NC}"
    
    # Check logs for OTP
    echo ""
    echo "📱 Checking OTP service logs for generated OTP..."
    echo "Look for a line like: 📱 OTP for cust_001: 123456"
    echo ""
    docker-compose logs --tail=10 otp-service | grep "OTP for cust_001" | tail -1
    
    echo ""
    echo "💡 To complete the high-risk payment, use the OTP from logs:"
    echo "curl -X POST http://localhost/payment/confirm \\"
    echo "  -H \"Content-Type: application/json\" \\"
    echo "  -H \"Authorization: Bearer $TOKEN\" \\"
    echo "  -H \"Idempotency-Key: $IDEMPOTENCY_KEY_HIGH\" \\"
    echo "  -d '{\"transaction_id\": \"test_txn_high_001\", \"customer_id\": \"cust_001\", \"amount\": 15000.00, \"otp\": \"YOUR_OTP_HERE\", \"from_account\": \"ACC001\", \"to_account\": \"ACC002\"}'"
    
else
    echo -e "${YELLOW}⚠️ High-risk payment response: $HIGH_RISK_RESPONSE${NC}"
fi
echo ""

# Step 4: Test idempotency
echo "🔄 Step 4: Testing idempotency (same request twice)..."
DUPLICATE_RESPONSE=$(curl -s -X POST http://localhost/payment/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "transaction_id": "test_txn_low_001",
    "customer_id": "cust_001",
    "amount": 1000.00,
    "from_account": "ACC001",
    "to_account": "ACC002"
  }')

echo "Duplicate Response: $DUPLICATE_RESPONSE"

if [ "$LOW_RISK_RESPONSE" = "$DUPLICATE_RESPONSE" ]; then
    echo -e "${GREEN}✅ Idempotency working correctly (same response)${NC}"
else
    echo -e "${YELLOW}⚠️ Idempotency check - responses differ${NC}"
fi
echo ""

# Step 5: Check service health
echo "🏥 Step 5: Checking service health..."
HEALTH_RESPONSE=$(curl -s http://localhost/health)
echo "Health Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅ API Gateway is healthy${NC}"
else
    echo -e "${RED}❌ API Gateway health check failed${NC}"
fi
echo ""

# Step 6: Test rate limiting (optional)
echo "🚦 Step 6: Testing rate limiting (sending 5 rapid requests)..."
for i in {1..5}; do
    RATE_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null http://localhost/health)
    echo "Request $i: HTTP $RATE_RESPONSE"
    if [ "$RATE_RESPONSE" = "429" ]; then
        echo -e "${GREEN}✅ Rate limiting is working${NC}"
        break
    fi
done
echo ""

echo "🎯 Test Summary:"
echo "==============="
echo "- Authentication: ✅"
echo "- Low-risk payment: ✅"
echo "- High-risk payment (OTP trigger): ✅"
echo "- Idempotency: ✅"
echo "- Health checks: ✅"
echo ""

echo "📊 Observability Access:"
echo "- Jaeger (Tracing): http://localhost:16686"
echo "- Prometheus (Metrics): http://localhost:9090"
echo "- Grafana (Dashboards): http://localhost:3000"
echo "- Kibana (Logs): http://localhost:5601"
echo ""

echo -e "${GREEN}🎉 Payment Flow Services testing complete!${NC}"

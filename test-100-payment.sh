#!/bin/bash

echo "💰 Testing $100 Payment Transaction"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Use load balancer
API_URL="http://localhost"

# Check if services are running
if ! curl -s $API_URL/health > /dev/null; then
    echo "❌ Services not running or load balancer not accessible"
    echo "Checking service status..."
    docker-compose ps | grep -E "(load-balancer|api-gateway)"
    exit 1
fi

echo -e "${GREEN}✅ Services are running${NC}"
echo ""

# Step 1: Get authentication token
echo "🔐 Step 1: Getting authentication token..."
TOKEN_RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "password123"}')

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get authentication token"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Got authentication token${NC}"
echo ""

# Step 2: Make $100 payment
echo "💳 Step 2: Making $100 payment transaction..."
TRANSACTION_ID="txn_100_$(date +%s)"
IDEMPOTENCY_KEY=$(uuidgen)

echo "Transaction ID: $TRANSACTION_ID"
echo "Idempotency Key: $IDEMPOTENCY_KEY"
echo ""

PAYMENT_RESPONSE=$(curl -s -X POST $API_URL/payment/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "{
    \"transaction_id\": \"$TRANSACTION_ID\",
    \"customer_id\": \"cust_001\",
    \"amount\": 100.00,
    \"from_account\": \"ACC001\",
    \"to_account\": \"ACC002\"
  }")

echo "Payment Response:"
echo "$PAYMENT_RESPONSE" | jq '.' 2>/dev/null || echo "$PAYMENT_RESPONSE"
echo ""

# Step 3: Show recent logs
echo "📝 Recent service logs:"
echo "======================"
echo ""
echo "API Gateway logs:"
docker-compose logs --tail=5 api-gateway-1 | grep -E "(Processing payment|Payment processed|authenticated|✅|🛡️)"
echo ""
echo "Confirm Service logs:"
docker-compose logs --tail=10 confirm-service | grep -E "(Processing payment|Payment confirmed|Risk level|OTP|Validating|Publishing|Sending|✅|🔄)"
echo ""

echo -e "${GREEN}🎯 Observability Access Points:${NC}"
echo "- Jaeger UI: http://localhost:16686 (Search for '$TRANSACTION_ID')"
echo "- Prometheus: http://localhost:9090 (Query metrics)"
echo "- Grafana: http://localhost:3000 (admin/admin123)"
echo "- Kibana: http://localhost:5601 (Search logs)"
echo ""

echo -e "${YELLOW}💡 What to look for:${NC}"
echo "1. In Jaeger: Distributed trace showing api-gateway → confirm-service → risk-service → account-service"
echo "2. In Prometheus: HTTP request metrics and custom payment metrics"
echo "3. In logs: Detailed payment processing steps with transaction ID"
echo ""

echo -e "${GREEN}✅ $100 Payment test completed!${NC}"
echo "Transaction ID: $TRANSACTION_ID"

#!/bin/bash

echo "🚀 Starting Payment Flow Services..."
echo "This will take 2-3 minutes for all services to be ready."
echo ""

# Start all services
docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to initialize..."
sleep 30

echo ""
echo "🔍 Checking service health..."

# Wait for key services to be healthy
for i in {1..10}; do
    if curl -s http://localhost/health > /dev/null 2>&1; then
        echo "✅ API Gateway is ready"
        break
    fi
    echo "⏳ Waiting for API Gateway... ($i/10)"
    sleep 10
done

echo ""
echo "🎯 Access Points:"
echo "- API Gateway: http://localhost"
echo "- Jaeger UI: http://localhost:16686"
echo "- Prometheus: http://localhost:9090"
echo "- Grafana: http://localhost:3000 (admin/admin123)"
echo "- Kibana: http://localhost:5601"
echo ""

echo "📋 Quick Test Commands:"
echo ""
echo "1. Get auth token:"
echo 'curl -X POST http://localhost/auth/login -H "Content-Type: application/json" -d '"'"'{"username": "demo", "password": "password123"}'"'"''
echo ""
echo "2. Test low-risk payment:"
echo 'curl -X POST http://localhost/payment/confirm -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" -H "Idempotency-Key: $(uuidgen)" -d '"'"'{"transaction_id": "txn_001", "customer_id": "cust_001", "amount": 1000.00, "from_account": "ACC001", "to_account": "ACC002"}'"'"''
echo ""
echo "3. Test high-risk payment (triggers OTP):"
echo 'curl -X POST http://localhost/payment/confirm -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" -H "Idempotency-Key: $(uuidgen)" -d '"'"'{"transaction_id": "txn_002", "customer_id": "cust_001", "amount": 15000.00, "from_account": "ACC001", "to_account": "ACC002"}'"'"''
echo ""

echo "📊 Monitor logs with: docker-compose logs -f"
echo "🛑 Stop services with: docker-compose down"
echo ""
echo "✅ Payment Flow Services are ready!"

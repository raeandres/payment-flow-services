-- Insert sample transactions for testing
INSERT INTO transactions (id, customer_id, from_account, to_account, amount, status, created_at) VALUES 
('txn_001', 'cust_001', 'ACC001', 'ACC002', 1000.00, 'INITIATED', NOW() - INTERVAL '1 hour'),
('txn_002', 'cust_001', 'ACC001', 'ACC002', 15000.00, 'INITIATED', NOW() - INTERVAL '30 minutes'),
('txn_003', 'cust_002', 'ACC002', 'ACC001', 500.00, 'CONFIRMED', NOW() - INTERVAL '2 hours'),
('txn_004', 'cust_001', 'ACC001', 'ACC002', 2500.00, 'COMPLETED', NOW() - INTERVAL '1 day'),
('txn_005', 'cust_002', 'ACC002', 'ACC001', 750.00, 'INITIATED', NOW() - INTERVAL '10 minutes');

-- Insert sample audit logs
INSERT INTO audit_logs (transaction_id, customer_id, action, details) VALUES 
('txn_003', 'cust_002', 'PAYMENT_CONFIRMED', '{"amount": 500.00, "risk_score": 15}'),
('txn_004', 'cust_001', 'PAYMENT_COMPLETED', '{"amount": 2500.00, "settlement_time": "24h"}'),
('txn_001', 'cust_001', 'RISK_ASSESSMENT', '{"risk_level": "LOW", "score": 30}');

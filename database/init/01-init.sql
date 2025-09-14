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

CREATE TABLE IF NOT EXISTS fund_reservations (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50),
    account_number VARCHAR(50),
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'RESERVED',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO customers (customer_id, email, phone) VALUES 
('cust_001', 'john@example.com', '+1234567890'),
('cust_002', 'jane@example.com', '+1234567891');

INSERT INTO accounts (account_number, customer_id, balance) VALUES 
('ACC001', 'cust_001', 15000.00),
('ACC002', 'cust_002', 8500.00);

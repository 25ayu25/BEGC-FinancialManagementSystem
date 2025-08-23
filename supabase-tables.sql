-- Clinic Financial Management System Database Schema
-- Copy and paste this into Supabase SQL Editor

-- Users table
CREATE TABLE users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    location TEXT NOT NULL DEFAULT 'south_sudan',
    status TEXT NOT NULL DEFAULT 'active',
    permissions JSONB NOT NULL DEFAULT '[]',
    default_currency TEXT DEFAULT 'SSP',
    email_notifications BOOLEAN DEFAULT true,
    report_alerts BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Departments table
CREATE TABLE departments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Insurance providers table
CREATE TABLE insurance_providers (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Transactions table
CREATE TABLE transactions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    department_id VARCHAR REFERENCES departments(id),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    description TEXT,
    date TIMESTAMP NOT NULL DEFAULT NOW(),
    receipt_path TEXT,
    insurance_provider_id VARCHAR REFERENCES insurance_providers(id),
    expense_category TEXT,
    staff_type TEXT,
    created_by VARCHAR NOT NULL REFERENCES users(id),
    sync_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Monthly reports table
CREATE TABLE monthly_reports (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    total_income DECIMAL(10,2) NOT NULL,
    total_expenses DECIMAL(10,2) NOT NULL,
    net_income DECIMAL(10,2) NOT NULL,
    department_breakdown JSONB NOT NULL,
    insurance_breakdown JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    pdf_path TEXT,
    generated_by VARCHAR NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Receipts table
CREATE TABLE receipts (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR NOT NULL REFERENCES transactions(id),
    file_path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_by VARCHAR NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Patient volume table
CREATE TABLE patient_volume (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP NOT NULL,
    department_id VARCHAR REFERENCES departments(id),
    patient_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    recorded_by VARCHAR NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial departments
INSERT INTO departments (code, name) VALUES
('CON', 'Consultation'),
('LAB', 'Laboratory'),
('ULTRASOUND', 'Ultrasound'),
('XRAY', 'X-Ray'),
('PHARMACY', 'Pharmacy');

-- Insert initial insurance providers
INSERT INTO insurance_providers (code, name) VALUES
('CIC', 'CIC Insurance'),
('UAP', 'UAP Insurance'),
('CIGNA', 'CIGNA'),
('CASH', 'Cash Payment'),
('OTHER', 'Other Insurance');

-- Insert initial admin user (password is 'admin123' - change this!)
INSERT INTO users (username, email, full_name, password, role, location) VALUES
('admin', 'admin@clinic.com', 'System Administrator', '$2b$10$rQZ9gZJgUQiVQ/K7Q9Y2i.5Q9P8X4.9M3P2Q1R5S7T8U9V0W1X2Y3Z', 'admin', 'south_sudan');
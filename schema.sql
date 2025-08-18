-- Bahr El Ghazal Clinic Financial Management Schema
-- Run this in your Supabase SQL Editor

-- Enable RLS (Row Level Security)
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'staff');
CREATE TYPE user_location AS ENUM ('usa', 'south_sudan');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE currency_type AS ENUM ('USD', 'SSP');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role user_role DEFAULT 'staff',
  location user_location DEFAULT 'south_sudan',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments table
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insurance providers table
CREATE TABLE insurance_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type transaction_type NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency currency_type NOT NULL,
  description TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) NOT NULL,
  insurance_provider_id UUID REFERENCES insurance_providers(id),
  date DATE NOT NULL,
  receipt_url TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly reports table
CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  total_income_usd DECIMAL(12,2) DEFAULT 0,
  total_income_ssp DECIMAL(12,2) DEFAULT 0,
  total_expenses_usd DECIMAL(12,2) DEFAULT 0,
  total_expenses_ssp DECIMAL(12,2) DEFAULT 0,
  net_income_usd DECIMAL(12,2) DEFAULT 0,
  net_income_ssp DECIMAL(12,2) DEFAULT 0,
  department_breakdown JSONB DEFAULT '{}',
  insurance_breakdown JSONB DEFAULT '{}',
  pdf_path TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

-- Create indexes for better performance
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_department ON transactions(department_id);
CREATE INDEX idx_transactions_insurance ON transactions(insurance_provider_id);
CREATE INDEX idx_transactions_created_by ON transactions(created_by);
CREATE INDEX idx_monthly_reports_year_month ON monthly_reports(year, month);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monthly_reports_updated_at BEFORE UPDATE ON monthly_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Departments policies (all authenticated users can read, only admins can modify)
CREATE POLICY "All users can view departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can insert departments" ON departments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Only admins can update departments" ON departments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Insurance providers policies (same as departments)
CREATE POLICY "All users can view insurance providers" ON insurance_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can insert insurance providers" ON insurance_providers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Only admins can update insurance providers" ON insurance_providers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Transactions policies
CREATE POLICY "All users can view transactions" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "All users can insert transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own transactions" ON transactions FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Admins can update all transactions" ON transactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete transactions" ON transactions FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Monthly reports policies
CREATE POLICY "All users can view monthly reports" ON monthly_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can modify monthly reports" ON monthly_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Insert initial data
INSERT INTO departments (name) VALUES 
  ('Consultation'),
  ('Laboratory'),
  ('Ultrasound'),
  ('X-Ray'),
  ('Pharmacy');

INSERT INTO insurance_providers (name) VALUES 
  ('None'),
  ('CIC Insurance'),
  ('UAP Insurance'),
  ('CIGNA'),
  ('Private Pay'),
  ('Government Insurance');

-- Create Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Storage policies for receipts bucket
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects 
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Users can view receipts" ON storage.objects 
  FOR SELECT TO authenticated USING (bucket_id = 'receipts');

CREATE POLICY "Admins can delete receipts" ON storage.objects 
  FOR DELETE TO authenticated USING (
    bucket_id = 'receipts' AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
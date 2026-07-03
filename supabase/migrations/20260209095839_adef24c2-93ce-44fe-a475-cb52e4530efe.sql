-- Add new account types: other_income and other_expenses
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'other_income';
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'other_expenses';
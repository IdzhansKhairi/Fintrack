-- =============================================================================
-- FINTRACK V2 — MASTER SUPABASE CLOUD DATABASE SCHEMA
-- File: master_all_table_supabase.sql
--
-- Instructions:
-- 1. Open your Supabase Cloud Dashboard (https://supabase.com/dashboard)
-- 2. Go to "SQL Editor" -> "+ New query"
-- 3. Copy and paste this entire file into the editor and click "Run".
--
-- This script is 100% idempotent: it safely creates all tables, columns,
-- constraints, indexes, triggers, functions, and Row Level Security (RLS)
-- policies whether run on a brand-new project or an existing project.
-- =============================================================================

-- =============================================================================
-- 1. SHARED HELPER FUNCTION: AUTO-UPDATE `updated_at`
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. PROFILES TABLE (Mirrored from `auth.users`)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    preferred_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create / sync profile when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, preferred_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(
      NEW.raw_user_meta_data->>'preferred_name',
      NULLIF(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1), '')
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    preferred_name = COALESCE(EXCLUDED.preferred_name, public.profiles.preferred_name),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing users in `auth.users` into `public.profiles`
INSERT INTO public.profiles (id, email, full_name, preferred_name)
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name',
  COALESCE(
    u.raw_user_meta_data->>'preferred_name',
    NULLIF(split_part(COALESCE(u.raw_user_meta_data->>'full_name', ''), ' ', 1), '')
  )
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- RLS for `public.profiles`
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- =============================================================================
-- 3. ACCOUNTS TABLE (Bank, E-Wallet, Cash, Credit Card, Retirement, Investment)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    account_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_credit_card BOOLEAN NOT NULL DEFAULT false,
    credit_limit NUMERIC(12, 2) CHECK (credit_limit IS NULL OR credit_limit > 0),
    color TEXT DEFAULT '#1e4db7',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure credit card columns exist if upgrading an older table
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS is_credit_card BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2) CHECK (credit_limit IS NULL OR credit_limit > 0);

UPDATE public.accounts
SET is_credit_card = true
WHERE account_type = 'Credit Card' AND is_credit_card = false;

CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);

DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for `public.accounts`
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
CREATE POLICY "Users can view own accounts"
ON public.accounts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
CREATE POLICY "Users can insert own accounts"
ON public.accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
CREATE POLICY "Users can update own accounts"
ON public.accounts FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can delete own accounts"
ON public.accounts FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- 4. SUBACCOUNTS TABLE (Pockets / Partitions inside Non-Credit-Card Accounts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subaccounts (
    subaccount_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(account_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subaccount_name TEXT NOT NULL,
    subaccount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subaccount_value >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subaccounts_account ON public.subaccounts(account_id);
CREATE INDEX IF NOT EXISTS idx_subaccounts_user ON public.subaccounts(user_id);

DROP TRIGGER IF EXISTS update_subaccounts_updated_at ON public.subaccounts;
CREATE TRIGGER update_subaccounts_updated_at
BEFORE UPDATE ON public.subaccounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for `public.subaccounts`
ALTER TABLE public.subaccounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subaccounts" ON public.subaccounts;
CREATE POLICY "Users can view own subaccounts"
ON public.subaccounts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own subaccounts" ON public.subaccounts;
CREATE POLICY "Users can insert own subaccounts"
ON public.subaccounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subaccounts" ON public.subaccounts;
CREATE POLICY "Users can update own subaccounts"
ON public.subaccounts FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own subaccounts" ON public.subaccounts;
CREATE POLICY "Users can delete own subaccounts"
ON public.subaccounts FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- 5. TRANSACTIONS TABLE (Income, Expenses, & Credit Card Bill Settlements)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(account_id) ON DELETE CASCADE,
    subaccount_id UUID REFERENCES public.subaccounts(subaccount_id) ON DELETE SET NULL,
    target_account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    expense_category TEXT,
    income_category TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_time TEXT NOT NULL DEFAULT '00:00',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure `target_account_id` exists if upgrading an older table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS target_account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_target_account ON public.transactions(target_account_id);

DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for `public.transactions`
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions"
ON public.transactions FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- 6. WISHLIST TABLE (Standalone Wanted / Purchased Items)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.wishlist (
    wishlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wishlist_name TEXT NOT NULL,
    wishlist_category TEXT NOT NULL,
    wishlist_estimated_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (wishlist_estimated_price >= 0),
    product_link TEXT,
    image_url TEXT,
    is_purchased BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON public.wishlist(user_id);

DROP TRIGGER IF EXISTS update_wishlist_updated_at ON public.wishlist;
CREATE TRIGGER update_wishlist_updated_at
BEFORE UPDATE ON public.wishlist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for `public.wishlist`
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wishlist" ON public.wishlist;
CREATE POLICY "Users can view own wishlist"
ON public.wishlist FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own wishlist" ON public.wishlist;
CREATE POLICY "Users can insert own wishlist"
ON public.wishlist FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own wishlist" ON public.wishlist;
CREATE POLICY "Users can update own wishlist"
ON public.wishlist FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own wishlist" ON public.wishlist;
CREATE POLICY "Users can delete own wishlist"
ON public.wishlist FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- 7. TABUNG & TABUNG_CONTRIBUTION TABLES (Savings Funds)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tabung (
    tabung_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tabung_name TEXT NOT NULL,
    tabung_purpose TEXT NOT NULL,
    tabung_held_at TEXT NOT NULL,
    tabung_target_amount NUMERIC(12, 2) NOT NULL CHECK (tabung_target_amount > 0),
    tabung_target_date DATE,
    tabung_notes TEXT,
    color TEXT DEFAULT '#16a34a',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_tabung_updated_at ON public.tabung;
CREATE TRIGGER update_tabung_updated_at
BEFORE UPDATE ON public.tabung
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.tabung_contribution (
    tabung_contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabung_id UUID NOT NULL REFERENCES public.tabung(tabung_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contribution_type TEXT NOT NULL DEFAULT 'deposit' CHECK (contribution_type IN ('deposit', 'withdrawal')),
    tabung_contribution_amount NUMERIC(12, 2) NOT NULL CHECK (tabung_contribution_amount > 0),
    tabung_contribution_note TEXT NOT NULL,
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL,
    subaccount_id UUID REFERENCES public.subaccounts(subaccount_id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(transaction_id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tabung_user ON public.tabung(user_id);
CREATE INDEX IF NOT EXISTS idx_tabung_contribution_tabung ON public.tabung_contribution(tabung_id);
CREATE INDEX IF NOT EXISTS idx_tabung_contribution_transaction ON public.tabung_contribution(transaction_id);

DROP TRIGGER IF EXISTS update_tabung_contribution_updated_at ON public.tabung_contribution;
CREATE TRIGGER update_tabung_contribution_updated_at
BEFORE UPDATE ON public.tabung_contribution
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Two-way sync: when a transaction is cancelled (`is_active` -> false), soft-delete linked tabung_contribution
CREATE OR REPLACE FUNCTION public.sync_tabung_contribution_on_transaction_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_active = true AND NEW.is_active = false THEN
        UPDATE public.tabung_contribution
        SET is_active = false
        WHERE transaction_id = NEW.transaction_id
          AND user_id = NEW.user_id
          AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_transaction_cancel_sync_tabung ON public.transactions;
CREATE TRIGGER on_transaction_cancel_sync_tabung
AFTER UPDATE OF is_active ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_tabung_contribution_on_transaction_cancel();

-- RLS for `public.tabung` & `public.tabung_contribution`
ALTER TABLE public.tabung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabung_contribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tabung" ON public.tabung;
CREATE POLICY "Users can view own tabung"
ON public.tabung FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tabung" ON public.tabung;
CREATE POLICY "Users can insert own tabung"
ON public.tabung FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tabung" ON public.tabung;
CREATE POLICY "Users can update own tabung"
ON public.tabung FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tabung" ON public.tabung;
CREATE POLICY "Users can delete own tabung"
ON public.tabung FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own tabung contributions" ON public.tabung_contribution;
CREATE POLICY "Users can view own tabung contributions"
ON public.tabung_contribution FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tabung contributions" ON public.tabung_contribution;
CREATE POLICY "Users can insert own tabung contributions"
ON public.tabung_contribution FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tabung contributions" ON public.tabung_contribution;
CREATE POLICY "Users can update own tabung contributions"
ON public.tabung_contribution FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tabung contributions" ON public.tabung_contribution;
CREATE POLICY "Users can delete own tabung contributions"
ON public.tabung_contribution FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- 8. DEBTS TABLE (Money Lent to Others or Borrowed from Others)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.debts (
    debts_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    debts_type TEXT NOT NULL DEFAULT 'lent' CHECK (debts_type IN ('lent', 'borrowed')),
    debts_name TEXT NOT NULL,
    debts_person TEXT NOT NULL,
    debts_amount NUMERIC(12, 2) NOT NULL CHECK (debts_amount > 0),
    debts_date DATE NOT NULL DEFAULT CURRENT_DATE,
    debts_due_date DATE,
    debts_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    settled_at DATE,
    account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL,
    subaccount_id UUID REFERENCES public.subaccounts(subaccount_id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(transaction_id) ON DELETE SET NULL,
    settled_account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL,
    settled_subaccount_id UUID REFERENCES public.subaccounts(subaccount_id) ON DELETE SET NULL,
    settled_transaction_id UUID REFERENCES public.transactions(transaction_id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_transaction ON public.debts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_debts_settled_transaction ON public.debts(settled_transaction_id);

DROP TRIGGER IF EXISTS update_debts_updated_at ON public.debts;
CREATE TRIGGER update_debts_updated_at
BEFORE UPDATE ON public.debts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Two-way sync: when a transaction linked to a debt is cancelled (`is_active` -> false)
CREATE OR REPLACE FUNCTION public.sync_debts_on_transaction_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_active = true AND NEW.is_active = false THEN
        -- Reopen settled debt if its settlement transaction was cancelled
        UPDATE public.debts
        SET status = 'pending',
            settled_at = NULL,
            settled_transaction_id = NULL,
            settled_account_id = NULL,
            settled_subaccount_id = NULL
        WHERE settled_transaction_id = NEW.transaction_id
          AND user_id = NEW.user_id
          AND is_active = true;

        -- Soft-delete pending debt if its creation transaction was cancelled
        UPDATE public.debts
        SET is_active = false
        WHERE transaction_id = NEW.transaction_id
          AND user_id = NEW.user_id
          AND status = 'pending'
          AND is_active = true;

        -- Unlink initial transaction if debt is already settled
        UPDATE public.debts
        SET transaction_id = NULL,
            account_id = NULL,
            subaccount_id = NULL
        WHERE transaction_id = NEW.transaction_id
          AND user_id = NEW.user_id
          AND status = 'settled'
          AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_transaction_cancel_sync_debts ON public.transactions;
CREATE TRIGGER on_transaction_cancel_sync_debts
AFTER UPDATE OF is_active ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_debts_on_transaction_cancel();

-- RLS for `public.debts`
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
CREATE POLICY "Users can view own debts"
ON public.debts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
CREATE POLICY "Users can insert own debts"
ON public.debts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
CREATE POLICY "Users can update own debts"
ON public.debts FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;
CREATE POLICY "Users can delete own debts"
ON public.debts FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- 9. FINANCING & FINANCING_INSTALLMENTS TABLES (Loans, BNPL, Hire Purchase, Credit Card Installments)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.financing (
    financing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    financing_name TEXT NOT NULL,
    financing_provider TEXT NOT NULL,
    financing_category TEXT NOT NULL DEFAULT 'Other',
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    duration_months INTEGER CHECK (duration_months IS NULL OR duration_months > 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL,
    sync_to_commitments BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled')),
    financing_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure `account_id` exists on `public.financing` if upgrading an older table
ALTER TABLE public.financing
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS update_financing_updated_at ON public.financing;
CREATE TRIGGER update_financing_updated_at
BEFORE UPDATE ON public.financing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.financing_installments (
    installment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financing_id UUID NOT NULL REFERENCES public.financing(financing_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL DEFAULT 1,
    due_date DATE NOT NULL,
    amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_due >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_at DATE,
    installment_notes TEXT,
    account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL,
    subaccount_id UUID REFERENCES public.subaccounts(subaccount_id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(transaction_id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financing_user ON public.financing(user_id);
CREATE INDEX IF NOT EXISTS idx_financing_status ON public.financing(user_id, status);
CREATE INDEX IF NOT EXISTS idx_financing_sync_commitments ON public.financing(user_id, sync_to_commitments);
CREATE INDEX IF NOT EXISTS idx_financing_account ON public.financing(account_id);
CREATE INDEX IF NOT EXISTS idx_financing_installments_financing ON public.financing_installments(financing_id);
CREATE INDEX IF NOT EXISTS idx_financing_installments_user ON public.financing_installments(user_id);
CREATE INDEX IF NOT EXISTS idx_financing_installments_transaction ON public.financing_installments(transaction_id);

DROP TRIGGER IF EXISTS update_financing_installments_updated_at ON public.financing_installments;
CREATE TRIGGER update_financing_installments_updated_at
BEFORE UPDATE ON public.financing_installments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Two-way sync: when a transaction linked to a financing installment is cancelled (`is_active` -> false)
CREATE OR REPLACE FUNCTION public.sync_financing_on_transaction_cancel()
RETURNS TRIGGER AS $$
DECLARE
    affected_financing_id UUID;
BEGIN
    IF OLD.is_active = true AND NEW.is_active = false THEN
        FOR affected_financing_id IN
            UPDATE public.financing_installments
            SET status = 'pending',
                amount_paid = 0.00,
                paid_at = NULL,
                transaction_id = NULL,
                account_id = NULL,
                subaccount_id = NULL
            WHERE transaction_id = NEW.transaction_id
              AND user_id = NEW.user_id
              AND is_active = true
            RETURNING financing_id
        LOOP
            UPDATE public.financing
            SET status = 'active'
            WHERE financing_id = affected_financing_id
              AND user_id = NEW.user_id
              AND status = 'settled';
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_transaction_cancel_sync_financing ON public.transactions;
CREATE TRIGGER on_transaction_cancel_sync_financing
AFTER UPDATE OF is_active ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_financing_on_transaction_cancel();

-- RLS for `public.financing` & `public.financing_installments`
ALTER TABLE public.financing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own financing" ON public.financing;
CREATE POLICY "Users can view own financing"
ON public.financing FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own financing" ON public.financing;
CREATE POLICY "Users can insert own financing"
ON public.financing FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own financing" ON public.financing;
CREATE POLICY "Users can update own financing"
ON public.financing FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own financing" ON public.financing;
CREATE POLICY "Users can delete own financing"
ON public.financing FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own financing installments" ON public.financing_installments;
CREATE POLICY "Users can view own financing installments"
ON public.financing_installments FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own financing installments" ON public.financing_installments;
CREATE POLICY "Users can insert own financing installments"
ON public.financing_installments FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own financing installments" ON public.financing_installments;
CREATE POLICY "Users can update own financing installments"
ON public.financing_installments FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own financing installments" ON public.financing_installments;
CREATE POLICY "Users can delete own financing installments"
ON public.financing_installments FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- 10. COMMITMENTS & COMMITMENT_PAYMENTS TABLES (Recurring Monthly Obligations)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.commitments (
    commitment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    commitment_name TEXT NOT NULL,
    commitment_description TEXT,
    commitment_category TEXT NOT NULL DEFAULT 'Other',
    monthly_amount NUMERIC(12, 2) NOT NULL CHECK (monthly_amount > 0),
    due_day INTEGER NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    is_variable_amount BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_commitments_updated_at ON public.commitments;
CREATE TRIGGER update_commitments_updated_at
BEFORE UPDATE ON public.commitments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.commitment_payments (
    commitment_payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_id UUID NOT NULL REFERENCES public.commitments(commitment_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payment_year INTEGER NOT NULL,
    payment_month INTEGER NOT NULL CHECK (payment_month BETWEEN 1 AND 12),
    amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_due >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'skipped')),
    paid_at DATE,
    payment_notes TEXT,
    account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL,
    subaccount_id UUID REFERENCES public.subaccounts(subaccount_id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(transaction_id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commitments_user ON public.commitments(user_id);
CREATE INDEX IF NOT EXISTS idx_commitment_payments_commitment ON public.commitment_payments(commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_payments_user_year ON public.commitment_payments(user_id, payment_year);
CREATE INDEX IF NOT EXISTS idx_commitment_payments_transaction ON public.commitment_payments(transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commitment_payments_unique_active
    ON public.commitment_payments(commitment_id, payment_year, payment_month)
    WHERE is_active = true;

DROP TRIGGER IF EXISTS update_commitment_payments_updated_at ON public.commitment_payments;
CREATE TRIGGER update_commitment_payments_updated_at
BEFORE UPDATE ON public.commitment_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Two-way sync: when a transaction linked to a commitment payment is cancelled (`is_active` -> false)
CREATE OR REPLACE FUNCTION public.sync_commitments_on_transaction_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_active = true AND NEW.is_active = false THEN
        UPDATE public.commitment_payments
        SET is_active = false
        WHERE transaction_id = NEW.transaction_id
          AND user_id = NEW.user_id
          AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_transaction_cancel_sync_commitments ON public.transactions;
CREATE TRIGGER on_transaction_cancel_sync_commitments
AFTER UPDATE OF is_active ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_commitments_on_transaction_cancel();

-- RLS for `public.commitments` & `public.commitment_payments`
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitment_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own commitments" ON public.commitments;
CREATE POLICY "Users can view own commitments"
ON public.commitments FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own commitments" ON public.commitments;
CREATE POLICY "Users can insert own commitments"
ON public.commitments FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own commitments" ON public.commitments;
CREATE POLICY "Users can update own commitments"
ON public.commitments FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own commitments" ON public.commitments;
CREATE POLICY "Users can delete own commitments"
ON public.commitments FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own commitment payments" ON public.commitment_payments;
CREATE POLICY "Users can view own commitment payments"
ON public.commitment_payments FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own commitment payments" ON public.commitment_payments;
CREATE POLICY "Users can insert own commitment payments"
ON public.commitment_payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own commitment payments" ON public.commitment_payments;
CREATE POLICY "Users can update own commitment payments"
ON public.commitment_payments FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own commitment payments" ON public.commitment_payments;
CREATE POLICY "Users can delete own commitment payments"
ON public.commitment_payments FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- END OF MASTER SCHEMA
-- =============================================================================


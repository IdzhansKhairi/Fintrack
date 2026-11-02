-- 8. Tabung (Savings Funds) Table
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
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Tabung Contribution Table (deposits into / withdrawals out of a tabung)
CREATE TABLE IF NOT EXISTS public.tabung_contribution (
    tabung_contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabung_id UUID NOT NULL REFERENCES public.tabung(tabung_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contribution_type TEXT NOT NULL DEFAULT 'deposit' CHECK (contribution_type IN ('deposit', 'withdrawal')),
    tabung_contribution_amount NUMERIC(12, 2) NOT NULL CHECK (tabung_contribution_amount > 0),
    tabung_contribution_note TEXT NOT NULL,
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Optional link to the account / sub-account / transaction this contribution was reflected in
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
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Two-way sync: when a transaction is cancelled (is_active -> false),
-- soft-delete the tabung contribution linked to it.
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

-- Row Level Security (RLS) for Tabung
ALTER TABLE public.tabung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabung_contribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tabung" ON public.tabung;
CREATE POLICY "Users can view own tabung" ON public.tabung FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tabung" ON public.tabung;
CREATE POLICY "Users can insert own tabung" ON public.tabung FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tabung" ON public.tabung;
CREATE POLICY "Users can update own tabung" ON public.tabung FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tabung" ON public.tabung;
CREATE POLICY "Users can delete own tabung" ON public.tabung FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own tabung contributions" ON public.tabung_contribution;
CREATE POLICY "Users can view own tabung contributions" ON public.tabung_contribution FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tabung contributions" ON public.tabung_contribution;
CREATE POLICY "Users can insert own tabung contributions" ON public.tabung_contribution FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tabung contributions" ON public.tabung_contribution;
CREATE POLICY "Users can update own tabung contributions" ON public.tabung_contribution FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tabung contributions" ON public.tabung_contribution;
CREATE POLICY "Users can delete own tabung contributions" ON public.tabung_contribution FOR DELETE USING (auth.uid() = user_id);


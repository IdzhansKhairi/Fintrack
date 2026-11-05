-- 13. Financing Plans Table (Loans, BNPL, Hire Purchase, Credit Card Installments)
CREATE TABLE IF NOT EXISTS public.financing (
    financing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    financing_name TEXT NOT NULL,
    financing_provider TEXT NOT NULL,
    financing_category TEXT NOT NULL DEFAULT 'Other',
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    duration_months INTEGER CHECK (duration_months IS NULL OR duration_months > 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sync_to_commitments BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled')),
    financing_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_financing_updated_at ON public.financing;
CREATE TRIGGER update_financing_updated_at
BEFORE UPDATE ON public.financing
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 14. Financing Installments Table (Monthly Schedule / Variable Bills per Plan)
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
    -- Optional link to the account / sub-account / transaction when this installment was paid
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
CREATE INDEX IF NOT EXISTS idx_financing_installments_financing ON public.financing_installments(financing_id);
CREATE INDEX IF NOT EXISTS idx_financing_installments_user ON public.financing_installments(user_id);
CREATE INDEX IF NOT EXISTS idx_financing_installments_transaction ON public.financing_installments(transaction_id);

DROP TRIGGER IF EXISTS update_financing_installments_updated_at ON public.financing_installments;
CREATE TRIGGER update_financing_installments_updated_at
BEFORE UPDATE ON public.financing_installments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 15. Two-way sync: when a transaction linked to a financing installment is cancelled (is_active -> false),
-- revert that installment back to 'pending' and reopen the parent financing plan if it was 'settled'.
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

-- Row Level Security (RLS) for Financing & Installments
ALTER TABLE public.financing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own financing" ON public.financing;
CREATE POLICY "Users can view own financing" ON public.financing FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own financing" ON public.financing;
CREATE POLICY "Users can insert own financing" ON public.financing FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own financing" ON public.financing;
CREATE POLICY "Users can update own financing" ON public.financing FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own financing" ON public.financing;
CREATE POLICY "Users can delete own financing" ON public.financing FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own financing installments" ON public.financing_installments;
CREATE POLICY "Users can view own financing installments" ON public.financing_installments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own financing installments" ON public.financing_installments;
CREATE POLICY "Users can insert own financing installments" ON public.financing_installments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own financing installments" ON public.financing_installments;
CREATE POLICY "Users can update own financing installments" ON public.financing_installments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own financing installments" ON public.financing_installments;
CREATE POLICY "Users can delete own financing installments" ON public.financing_installments FOR DELETE USING (auth.uid() = user_id);


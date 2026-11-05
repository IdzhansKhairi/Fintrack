-- 16. Commitments Table (Recurring Monthly Obligations: Rent, Insurance, Utilities, Subscriptions, Zakat, etc.)
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
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 17. Commitment Payments Table (Monthly Payment / Skipped Records per Commitment)
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
    -- Optional link to the account / sub-account / transaction when this monthly commitment was paid
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
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 18. Two-way sync: when a transaction linked to a commitment payment is cancelled (is_active -> false),
-- soft-delete the commitment_payments row so the month cell reverts to unpaid.
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

-- Row Level Security (RLS) for Commitments & Commitment Payments
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitment_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own commitments" ON public.commitments;
CREATE POLICY "Users can view own commitments" ON public.commitments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own commitments" ON public.commitments;
CREATE POLICY "Users can insert own commitments" ON public.commitments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own commitments" ON public.commitments;
CREATE POLICY "Users can update own commitments" ON public.commitments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own commitments" ON public.commitments;
CREATE POLICY "Users can delete own commitments" ON public.commitments FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own commitment payments" ON public.commitment_payments;
CREATE POLICY "Users can view own commitment payments" ON public.commitment_payments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own commitment payments" ON public.commitment_payments;
CREATE POLICY "Users can insert own commitment payments" ON public.commitment_payments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own commitment payments" ON public.commitment_payments;
CREATE POLICY "Users can update own commitment payments" ON public.commitment_payments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own commitment payments" ON public.commitment_payments;
CREATE POLICY "Users can delete own commitment payments" ON public.commitment_payments FOR DELETE USING (auth.uid() = user_id);


-- 11. Debts Table (money lent to others or borrowed from others)
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
    -- Optional link to the account / sub-account / transaction when the debt was created
    account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL,
    subaccount_id UUID REFERENCES public.subaccounts(subaccount_id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(transaction_id) ON DELETE SET NULL,
    -- Optional link to the account / sub-account / transaction when the debt was settled
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
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Two-way sync: when a transaction linked to a debt is cancelled (is_active -> false):
--   a) If it was the settlement transaction, reopen the debt back to 'pending'.
--   b) If it was the initial creation transaction on a pending debt, soft-delete the debt
--      (or unlink transaction_id if the debt is already settled).
CREATE OR REPLACE FUNCTION public.sync_debts_on_transaction_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_active = true AND NEW.is_active = false THEN
        -- If the cancelled transaction was a debt settlement transaction, reopen the debt
        UPDATE public.debts
        SET status = 'pending',
            settled_at = NULL,
            settled_transaction_id = NULL,
            settled_account_id = NULL,
            settled_subaccount_id = NULL
        WHERE settled_transaction_id = NEW.transaction_id
          AND user_id = NEW.user_id
          AND is_active = true;

        -- If the cancelled transaction was the initial debt creation transaction on a pending debt, soft-delete the debt
        UPDATE public.debts
        SET is_active = false
        WHERE transaction_id = NEW.transaction_id
          AND user_id = NEW.user_id
          AND status = 'pending'
          AND is_active = true;

        -- If the debt was already settled and its initial creation transaction is cancelled, unlink it
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

-- Row Level Security (RLS) for Debts
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

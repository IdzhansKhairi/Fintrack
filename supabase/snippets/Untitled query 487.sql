-- 1. Add credit card columns to public.accounts
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS is_credit_card BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2) CHECK (credit_limit IS NULL OR credit_limit > 0);

UPDATE public.accounts
SET is_credit_card = true
WHERE account_type = 'Credit Card';

-- 2. Add optional credit card link to public.financing
ALTER TABLE public.financing
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financing_account
    ON public.financing(account_id);

-- 3. Add target_account_id to public.transactions for "Pay card" settlements
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS target_account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_target_account
    ON public.transactions(target_account_id);
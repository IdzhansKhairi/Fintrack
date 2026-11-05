-- 19. Add Credit Card Support to Accounts & Link Financing Plans to Credit Cards

-- A. Add `is_credit_card` and `credit_limit` to `public.accounts`
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS is_credit_card BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2) CHECK (credit_limit IS NULL OR credit_limit > 0);

-- Backfill any existing Credit Card accounts
UPDATE public.accounts
SET is_credit_card = true
WHERE account_type = 'Credit Card';

-- B. Add optional `account_id` (credit card link) to `public.financing`
ALTER TABLE public.financing
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financing_account ON public.financing(account_id);

-- C. Add optional `target_account_id` on `public.transactions` for "Pay card" bill settlements
-- so cancelling a Credit Card Payment transaction on /transaction reverses both the bank account and the credit card.
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS target_account_id UUID REFERENCES public.accounts(account_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_target_account ON public.transactions(target_account_id);


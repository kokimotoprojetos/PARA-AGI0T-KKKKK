-- Adicionar original_amount para cálculo de lucro
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS original_amount DECIMAL(12,2);
COMMENT ON COLUMN public.debts.original_amount IS 'Valor original emprestado (capital principal)';

-- Atualizar dívidas existentes (assumindo lucro zero inicialmente)
UPDATE public.debts SET original_amount = amount WHERE original_amount IS NULL;

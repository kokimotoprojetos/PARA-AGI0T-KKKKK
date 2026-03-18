-- Adicionar coluna de método de pagamento na tabela de dívidas
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS payment_method TEXT;
-- Valores esperados: PIX, CREDITO, DEBITO, DINHEIRO, TRANSFERENCIA, OUTROS

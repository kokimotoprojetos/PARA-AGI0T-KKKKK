-- Adicionar coluna de controle de notificações na tabela de dívidas
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

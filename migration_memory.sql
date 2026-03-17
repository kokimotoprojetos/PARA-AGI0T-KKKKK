-- Adicionar coluna de histórico de chat para dar memória ao Agente
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]'::jsonb;

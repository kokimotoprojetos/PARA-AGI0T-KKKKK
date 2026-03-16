-- 1. Remover TODAS as políticas de segurança (RLS) que bloqueiam a alteração
-- O Postgres exige que as políticas sejam removidas ANTES de mudar o tipo da coluna.
DROP POLICY IF EXISTS "Users can manage their own debtors" ON public.debtors;
DROP POLICY IF EXISTS "Users can manage their own debt types" ON public.debt_types;
DROP POLICY IF EXISTS "Users can manage their own debt_types" ON public.debt_types;
DROP POLICY IF EXISTS "Users can manage their own debts" ON public.debts;
DROP POLICY IF EXISTS "Allow user to manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles; -- Erro reportado pelo usuário

-- 2. Remover Constraints de Chave Estrangeira
ALTER TABLE public.debtors DROP CONSTRAINT IF EXISTS debtors_user_id_fkey;
ALTER TABLE public.debt_types DROP CONSTRAINT IF EXISTS debt_types_user_id_fkey;
ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. Converter colunas para TEXT (Compatível com IDs do Clerk)
ALTER TABLE public.debtors ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.debt_types ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.debts ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;

-- 4. Adicionar coluna de número de notificação (se não existir)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_number TEXT;

-- 5. Desativar RLS para evitar bloqueios nas APIs (como solicitado)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debtors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts DISABLE ROW LEVEL SECURITY;

-- 6. Garantir permissões de acesso
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

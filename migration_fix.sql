-- =========================================================
-- SCRIPT "NUCLEAR" PARA CORREÇÃO FINAL DE BANCO DE DADOS
-- =========================================================

-- 1. Remover ABSOLUTAMENTE TODAS as políticas de RLS conhecidas
-- (Isso limpa tudo que trava a mudança de UUID para TEXT)
DROP POLICY IF EXISTS "Users can manage their own debtors" ON public.debtors;
DROP POLICY IF EXISTS "Users can manage their own debt types" ON public.debt_types;
DROP POLICY IF EXISTS "Users can manage their own debt_types" ON public.debt_types;
DROP POLICY IF EXISTS "Users can manage their own debts" ON public.debts;
DROP POLICY IF EXISTS "Allow user to manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Remover chaves estrangeiras que travam o tipo da coluna
ALTER TABLE public.debtors DROP CONSTRAINT IF EXISTS debtors_user_id_fkey;
ALTER TABLE public.debt_types DROP CONSTRAINT IF EXISTS debt_types_user_id_fkey;
ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. Converter colunas para TEXT (Clerk ID)
ALTER TABLE public.debtors ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.debt_types ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.debts ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;

-- 4. Adicionar colunas novas (IA e Notificações)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_number TEXT;

-- 5. DESATIVAR RLS COMPLETAMENTE (Para garantir funcionamento com Clerk e Service Role)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debtors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts DISABLE ROW LEVEL SECURITY;

-- 6. Liberar acesso total
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

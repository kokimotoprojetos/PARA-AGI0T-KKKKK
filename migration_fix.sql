-- 1. Drop dependent policies
-- PostgreSQL prevents altering column types when columns are used in policy definitions.
DROP POLICY IF EXISTS "Users can manage their own debtors" ON public.debtors;
DROP POLICY IF EXISTS "Users can manage their own debt_types" ON public.debt_types;
DROP POLICY IF EXISTS "Users can manage their own debts" ON public.debts;
DROP POLICY IF EXISTS "Allow user to manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profiles" ON public.profiles;

-- 2. Drop constraints
-- Foreign keys often depend on specific types (UUID vs TEXT).
ALTER TABLE public.debtors DROP CONSTRAINT IF EXISTS debtors_user_id_fkey;
ALTER TABLE public.debt_types DROP CONSTRAINT IF EXISTS debt_types_user_id_fkey;
ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. Alter columns to TEXT
-- Clerk uses string-based IDs (e.g., "user_2...").
ALTER TABLE public.debtors ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.debt_types ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.debts ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT;

-- 4. Disable RLS (as requested for Service Role Key usage)
-- This allows the server-side API calls to bypass RLS checks.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debtors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts DISABLE ROW LEVEL SECURITY;

-- 5. Permissions
-- Ensure all roles have necessary access.
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

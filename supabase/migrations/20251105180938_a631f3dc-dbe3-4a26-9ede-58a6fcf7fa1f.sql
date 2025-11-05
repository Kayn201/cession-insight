-- Drop the policy first, then recreate the function with correct search_path
DROP POLICY IF EXISTS "Allow first user registration" ON public.profiles;

DROP FUNCTION IF EXISTS public.is_first_user();
CREATE OR REPLACE FUNCTION public.is_first_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles LIMIT 1
  )
$$;

-- Recreate the policy
CREATE POLICY "Allow first user registration" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.is_first_user());
-- Add username to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Create function to check if this is the first user in the system
CREATE OR REPLACE FUNCTION public.is_first_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles LIMIT 1
  )
$$;

-- Create function to automatically assign admin role to first user
CREATE OR REPLACE FUNCTION public.assign_first_user_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the first user
  IF (SELECT COUNT(*) FROM public.profiles) = 1 THEN
    -- Assign admin role to this user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to assign admin to first user
DROP TRIGGER IF EXISTS on_first_user_assign_admin ON public.profiles;
CREATE TRIGGER on_first_user_assign_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_user_admin();

-- Update profiles table RLS to allow first user to insert
CREATE POLICY "Allow first user registration" 
ON public.profiles 
FOR INSERT 
WITH CHECK (is_first_user());

-- Allow admins to insert new profiles
CREATE POLICY "Admins can create profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow admins to view and manage all profiles
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));
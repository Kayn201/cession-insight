-- Update policy to allow admins to insert new roles (including other admins)
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


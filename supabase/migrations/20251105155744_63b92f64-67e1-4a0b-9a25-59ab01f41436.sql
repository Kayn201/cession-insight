-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'cessionario');

-- Create enum for acquisition status
CREATE TYPE public.acquisition_status AS ENUM ('ativa', 'finalizada');

-- Create enum for incident types
CREATE TYPE public.incident_type AS ENUM ('precatorio', 'rpv', 'precatorio_prioridade', 'precatorio_sjrp');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create acquisitions table
CREATE TABLE public.acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cessionario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data_aquisicao DATE NOT NULL,
  incidente public.incident_type NOT NULL,
  cessionario_nome TEXT NOT NULL,
  habilitacao_cessionario TEXT,
  mapa_orcamentario TEXT,
  proxima_verificacao DATE,
  fase_processo TEXT,
  resumo TEXT,
  ultima_movimentacao TEXT,
  prazo_processual DATE,
  prazo_demanda DATE,
  demanda TEXT,
  data_pagamento DATE,
  valor_incidente DECIMAL(15, 2) NOT NULL,
  preco_pago DECIMAL(15, 2) NOT NULL,
  valor_liquido DECIMAL(15, 2) NOT NULL,
  lucro DECIMAL(15, 2) GENERATED ALWAYS AS (valor_liquido - preco_pago) STORED,
  titular_acao TEXT,
  pessoas TEXT,
  processo TEXT,
  status public.acquisition_status DEFAULT 'ativa' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create permissions table for viewing other cessionarios
CREATE TABLE public.cessionario_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  granted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cessionario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  can_view_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(cessionario_id, can_view_user_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cessionario_permissions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Acquisitions policies
CREATE POLICY "Cessionarios can view their own acquisitions"
  ON public.acquisitions FOR SELECT
  USING (auth.uid() = cessionario_id);

CREATE POLICY "Cessionarios can view acquisitions they have permission for"
  ON public.acquisitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cessionario_permissions
      WHERE cessionario_id = acquisitions.cessionario_id
        AND can_view_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all acquisitions"
  ON public.acquisitions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all acquisitions"
  ON public.acquisitions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Cessionarios can insert their own acquisitions"
  ON public.acquisitions FOR INSERT
  WITH CHECK (auth.uid() = cessionario_id);

CREATE POLICY "Cessionarios can update their own acquisitions"
  ON public.acquisitions FOR UPDATE
  USING (auth.uid() = cessionario_id);

-- Permissions policies
CREATE POLICY "Admins can manage all permissions"
  ON public.cessionario_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Cessionarios can view permissions about themselves"
  ON public.cessionario_permissions FOR SELECT
  USING (auth.uid() = cessionario_id OR auth.uid() = can_view_user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_acquisitions_updated_at
  BEFORE UPDATE ON public.acquisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
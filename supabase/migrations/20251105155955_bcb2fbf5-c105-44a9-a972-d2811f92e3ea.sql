-- Drop all existing tables and types
DROP TABLE IF EXISTS public.cessionario_permissions CASCADE;
DROP TABLE IF EXISTS public.acquisitions CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS public.incident_type CASCADE;
DROP TYPE IF EXISTS public.acquisition_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP FUNCTION IF EXISTS public.has_role CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;

-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'cessionario');
CREATE TYPE public.acquisition_status AS ENUM ('ativa', 'finalizada');
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

-- Create user_roles table
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

-- Create permissions table
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

-- Create security definer function
CREATE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create trigger functions
CREATE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_acquisitions_updated_at
  BEFORE UPDATE ON public.acquisitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for acquisitions
CREATE POLICY "Cessionarios can view their own acquisitions"
  ON public.acquisitions FOR SELECT USING (auth.uid() = cessionario_id);

CREATE POLICY "Cessionarios can view permitted acquisitions"
  ON public.acquisitions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cessionario_permissions
      WHERE cessionario_id = acquisitions.cessionario_id
        AND can_view_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all acquisitions"
  ON public.acquisitions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all acquisitions"
  ON public.acquisitions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Cessionarios can insert their own acquisitions"
  ON public.acquisitions FOR INSERT WITH CHECK (auth.uid() = cessionario_id);

CREATE POLICY "Cessionarios can update their own acquisitions"
  ON public.acquisitions FOR UPDATE USING (auth.uid() = cessionario_id);

-- RLS Policies for permissions
CREATE POLICY "Admins can manage all permissions"
  ON public.cessionario_permissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Cessionarios can view their permissions"
  ON public.cessionario_permissions FOR SELECT 
  USING (auth.uid() = cessionario_id OR auth.uid() = can_view_user_id);
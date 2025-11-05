import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, TrendingUp, DollarSign, PieChart, FolderCheck, Users, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AcquisitionsTable from "@/components/dashboard/AcquisitionsTable";
import OverviewCharts from "@/components/dashboard/OverviewCharts";
import { fetchMondayBoard, convertMondayItemToAcquisition, getUniqueCessionarios } from "@/services/monday";
import { Separator } from "@/components/ui/separator";

type Acquisition = {
  id: string;
  data_aquisicao: string;
  incidente: string;
  cessionario_nome: string;
  valor_incidente: number;
  preco_pago: number;
  valor_liquido: number;
  lucro: number;
  status: 'ativa' | 'finalizada';
  fase_processo: string | null;
  proxima_verificacao: string | null;
  pessoas: string | null;
  data_pagamento: string | null;
};

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allAcquisitions, setAllAcquisitions] = useState<Acquisition[]>([]);
  const [userCessionario, setUserCessionario] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [cessionariosList, setCessionariosList] = useState<string[]>([]);
  const [alphaExpanded, setAlphaExpanded] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Função para buscar dados do Monday
  const fetchMondayData = async () => {
    try {
      const board = await fetchMondayBoard();
      const acquisitions = board.items.map(convertMondayItemToAcquisition);
      setAllAcquisitions(acquisitions);
      setCessionariosList(getUniqueCessionarios(board.items));
      
      // Se não é admin, buscar cessionário do perfil
      if (!isAdmin && session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', session.user.id)
          .single();
        
        if (profile?.username) {
          setUserCessionario(profile.username);
        }
      }
      
      return true;
    } catch (error: any) {
      console.error('Error fetching Monday data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message || "Não foi possível carregar os dados do Monday.com",
        variant: "destructive",
      });
      return false;
    }
  };

  // Função para atualizar dados
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMondayData();
    setRefreshing(false);
    toast({
      title: "Dados atualizados",
      description: "Os dados do Monday.com foram atualizados com sucesso.",
    });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        checkAdminStatus(session.user.id);
        fetchUserProfile(session.user.id);
        fetchMondayData().then(() => setLoading(false));
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        checkAdminStatus(session.user.id);
        fetchUserProfile(session.user.id);
        fetchMondayData().then(() => setLoading(false));
      }
    });

    // Auto-refresh a cada 15 minutos
    const refreshInterval = setInterval(() => {
      if (session) {
        fetchMondayData();
      }
    }, 15 * 60 * 1000); // 15 minutos

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [navigate]);

  // Re-fetch quando isAdmin muda
  useEffect(() => {
    if (session && !loading) {
      fetchMondayData();
    }
  }, [isAdmin]);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      setIsAdmin(!!data);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      if (data) {
        setUserName(data.full_name || "Usuário");
        if (!isAdmin && data.username) {
          setUserCessionario(data.username);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Filtrar aquisições por cessionário
  const filteredAcquisitions = useMemo(() => {
    if (isAdmin) {
      return allAcquisitions;
    }
    if (userCessionario) {
      return allAcquisitions.filter(acq => acq.cessionario_nome === userCessionario);
    }
    return [];
  }, [allAcquisitions, isAdmin, userCessionario]);

  // Separar ativas e finalizadas (excluindo grupo "Aquisições Finalizadas")
  const activeAcquisitions = useMemo(() => {
    return filteredAcquisitions.filter(acq => acq.status === 'ativa');
  }, [filteredAcquisitions]);

  const finishedAcquisitions = useMemo(() => {
    return filteredAcquisitions.filter(acq => acq.status === 'finalizada');
  }, [filteredAcquisitions]);

  // Calcular métricas para aquisições ativas (excluindo finalizadas)
  const totalInvestidoAtivas = useMemo(() => {
    return activeAcquisitions.reduce((sum, acq) => sum + Number(acq.preco_pago), 0);
  }, [activeAcquisitions]);

  const lucroAcumuladoAtivas = useMemo(() => {
    return activeAcquisitions.reduce((sum, acq) => sum + Number(acq.lucro), 0);
  }, [activeAcquisitions]);

  // Calcular métricas gerais (incluindo finalizadas)
  const totalInvestidoGeral = useMemo(() => {
    return filteredAcquisitions.reduce((sum, acq) => sum + Number(acq.preco_pago), 0);
  }, [filteredAcquisitions]);

  const valorLiquidoTotal = useMemo(() => {
    return filteredAcquisitions.reduce((sum, acq) => sum + Number(acq.valor_liquido), 0);
  }, [filteredAcquisitions]);

  const lucroTotal = useMemo(() => {
    return valorLiquidoTotal - totalInvestidoGeral;
  }, [valorLiquidoTotal, totalInvestidoGeral]);

  // Rentabilidade média = lucro total / total investido
  const rentabilidadeMedia = useMemo(() => {
    return totalInvestidoGeral > 0 ? (lucroTotal / totalInvestidoGeral) * 100 : 0;
  }, [lucroTotal, totalInvestidoGeral]);

  // Lucro médio por operação: Lucro Total / quantidade de Aquisições
  const lucroAnualMedio = useMemo(() => {
    const lucroTotalCalc = filteredAcquisitions.reduce((sum, acq) => {
      return sum + (Number(acq.valor_liquido) - Number(acq.preco_pago));
    }, 0);
    return filteredAcquisitions.length > 0 ? lucroTotalCalc / filteredAcquisitions.length : 0;
  }, [filteredAcquisitions]);

  // Se for admin, agrupar por cessionário
  const acquisitionsByCessionario = useMemo(() => {
    if (!isAdmin) return [];
    
    const grouped: Record<string, Acquisition[]> = {};
    cessionariosList.forEach(cessionario => {
      grouped[cessionario] = allAcquisitions.filter(acq => acq.cessionario_nome === cessionario);
    });
    return grouped;
  }, [isAdmin, allAcquisitions, cessionariosList]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  // Componente para renderizar métricas
  const renderMetrics = (acquisitions: Acquisition[], title: string = "", isExpanded?: boolean, setIsExpanded?: (value: boolean) => void) => {
    const active = acquisitions.filter(acq => acq.status === 'ativa');
    const finished = acquisitions.filter(acq => acq.status === 'finalizada');
    
    const totalInvestidoAtivas = active.reduce((sum, acq) => sum + Number(acq.preco_pago), 0);
    const lucroAcumuladoAtivas = active.reduce((sum, acq) => sum + Number(acq.lucro), 0);
    const totalInvestidoGeral = acquisitions.reduce((sum, acq) => sum + Number(acq.preco_pago), 0);
    const valorLiquidoTotal = acquisitions.reduce((sum, acq) => sum + Number(acq.valor_liquido), 0);
    const lucroTotal = valorLiquidoTotal - totalInvestidoGeral;
    const rentabilidadeMedia = totalInvestidoGeral > 0 ? (lucroTotal / totalInvestidoGeral) * 100 : 0;
    
    // Lucro médio por operação: Lucro Total / quantidade de Aquisições
    const lucroAnualMedio = acquisitions.length > 0 ? lucroTotal / acquisitions.length : 0;

    return (
      <>
        {/* Cards de Resumo - Ativas e Finalizadas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Investimentos Ativos
              </CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalInvestidoAtivas)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Apenas aquisições ativas
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lucro Presumido (Ativas)
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(lucroAcumuladoAtivas)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalInvestidoAtivas > 0 ? ((lucroAcumuladoAtivas / totalInvestidoAtivas) * 100).toFixed(1) : '0'}% de rentabilidade
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aquisições Ativas
              </CardTitle>
              <PieChart className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{active.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {acquisitions.length} no total
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aquisições Finalizadas
              </CardTitle>
              <FolderCheck className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{finished.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Concluídas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Cálculo Médio - Todas as Aquisições */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Investido
              </CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalInvestidoGeral)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {acquisitions.length} aquisições
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor líquido dos Titulos
              </CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(valorLiquidoTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {acquisitions.length} aquisições
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lucro Total
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(lucroTotal)}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lucro médio por operação
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(lucroAnualMedio)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Lucro Total / {acquisitions.length} aquisições
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Botão Expandir para Alpha Intermediação */}
        {title === "Alpha Intermediação de Serviços e Negócios LTDA" && setIsExpanded && (
          <div className="flex justify-center mt-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? "Recolher" : "Expandir"}
            </Button>
          </div>
        )}

        {/* Cards Especiais para Alpha Intermediação */}
        {title === "Alpha Intermediação de Serviços e Negócios LTDA" && isExpanded && (
          <>
            {/* Cards para Ativos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Valor Bruto do Incidente (Ativos)
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(active.reduce((sum, acq) => sum + Number(acq.valor_incidente), 0))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Todos os grupos menos Finalizadas
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Investido (Ativas)
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalInvestidoAtivas)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas aquisições ativas
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Lucro Presumido (Ativas)
                  </CardTitle>
                  <TrendingUp className="w-4 h-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{formatCurrency(lucroAcumuladoAtivas)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalInvestidoAtivas > 0 ? ((lucroAcumuladoAtivas / totalInvestidoAtivas) * 100).toFixed(1) : '0'}% de rentabilidade
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Honorários de Serviço
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(active.reduce((sum, acq) => sum + Number(acq.valor_incidente), 0) * 0.3)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    30% do Valor Bruto do Incidente
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Cards para Finalizadas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Valor Bruto do Incidente (Finalizadas)
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(finished.reduce((sum, acq) => sum + Number(acq.valor_incidente), 0))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas Aquisições Finalizadas
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Investido (Finalizadas)
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(finished.reduce((sum, acq) => sum + Number(acq.preco_pago), 0))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas aquisições finalizadas
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Lucro (Finalizadas)
                  </CardTitle>
                  <TrendingUp className="w-4 h-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {formatCurrency(finished.reduce((sum, acq) => sum + Number(acq.lucro), 0))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lucro das finalizadas
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Honorários de Serviço (Finalizadas)
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(finished.reduce((sum, acq) => sum + Number(acq.valor_incidente), 0) * 0.3)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    30% do Valor Bruto do Incidente
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Cards de Total (soma de todos os grupos) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Valor Bruto do Incidente (Total)
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(acquisitions.reduce((sum, acq) => sum + Number(acq.valor_incidente), 0))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Soma de todos os grupos
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Investido (Total)
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalInvestidoGeral)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Soma de todos os grupos
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lucro (Total)
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(lucroTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Lucro Presumido + Lucro Finalizado
              </p>
            </CardContent>
          </Card>

              <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Honorários de Serviço (Total)
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(acquisitions.reduce((sum, acq) => sum + Number(acq.valor_incidente), 0) * 0.3)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    30% do Valor Bruto Total
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Gráficos */}
        <OverviewCharts acquisitions={active} finishedAcquisitions={finished} />

        {/* Tabelas de Aquisições com Tabs */}
        <Tabs defaultValue="ativas" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="ativas">Aquisições Ativas ({active.length})</TabsTrigger>
            <TabsTrigger value="finalizadas">Aquisições Finalizadas ({finished.length})</TabsTrigger>
            <TabsTrigger value="total">Aquisições Total ({acquisitions.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ativas">
            <AcquisitionsTable acquisitions={active} title="Aquisições Ativas" />
          </TabsContent>
          
          <TabsContent value="finalizadas">
            <AcquisitionsTable acquisitions={finished} title="Aquisições Finalizadas" />
          </TabsContent>
          
          <TabsContent value="total">
            <AcquisitionsTable acquisitions={acquisitions} title="Todas as Aquisições" />
          </TabsContent>
        </Tabs>
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados do Monday.com...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-accent">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 shadow-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Dashboard Financeiro</h1>
              <p className="text-sm text-muted-foreground">{userName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="sm"
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? "Atualizando..." : "Atualizar"}
            </Button>
            {isAdmin && (
              <Button onClick={() => navigate("/users")} variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Usuários
              </Button>
            )}
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {isAdmin ? (
          // Se for admin, mostrar todos os cessionários separados
          // Se o admin também for cessionário, mostrar os dados dele primeiro
          (() => {
            const sortedCessionarios = [...cessionariosList];
            
            // Se o admin tiver um cessionário atribuído, colocar ele primeiro
            if (userCessionario && sortedCessionarios.includes(userCessionario)) {
              const index = sortedCessionarios.indexOf(userCessionario);
              sortedCessionarios.splice(index, 1);
              sortedCessionarios.unshift(userCessionario);
            }
            
            return (
              <>
                {sortedCessionarios.map((cessionario, index) => {
                  const cessionarioAcquisitions = acquisitionsByCessionario[cessionario] || [];
                  return (
                    <div key={cessionario}>
                      {index > 0 && (
                        <div className="my-8">
                          <Separator className="my-4" />
                          <div className="flex items-center gap-2 my-4">
                            <h2 className="text-2xl font-bold">{cessionario}</h2>
                          </div>
                          <Separator className="my-4" />
                        </div>
                      )}
                      {renderMetrics(
                        cessionarioAcquisitions, 
                        cessionario,
                        cessionario === "Alpha Intermediação de Serviços e Negócios LTDA" ? alphaExpanded : undefined,
                        cessionario === "Alpha Intermediação de Serviços e Negócios LTDA" ? setAlphaExpanded : undefined
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()
        ) : (
          // Se não for admin, mostrar apenas os dados do cessionário do usuário
          renderMetrics(filteredAcquisitions)
        )}
      </main>
    </div>
  );
};

export default Dashboard;

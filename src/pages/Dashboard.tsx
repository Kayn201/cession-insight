import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, TrendingUp, DollarSign, PieChart, FolderCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AcquisitionsTable from "@/components/dashboard/AcquisitionsTable";
import OverviewCharts from "@/components/dashboard/OverviewCharts";

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
};

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [acquisitions, setAcquisitions] = useState<Acquisition[]>([]);
  const [activeAcquisitions, setActiveAcquisitions] = useState<Acquisition[]>([]);
  const [finishedAcquisitions, setFinishedAcquisitions] = useState<Acquisition[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);
      if (!session) {
        navigate("/auth");
      } else {
        setTimeout(() => {
          fetchAcquisitions();
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) {
        navigate("/auth");
      } else {
        setTimeout(() => {
          fetchAcquisitions();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchAcquisitions = async () => {
    try {
      const { data, error } = await supabase
        .from('acquisitions')
        .select('*')
        .order('data_aquisicao', { ascending: false });

      if (error) throw error;

      if (data) {
        setAcquisitions(data);
        setActiveAcquisitions(data.filter((acq) => acq.status === 'ativa'));
        setFinishedAcquisitions(data.filter((acq) => acq.status === 'finalizada'));
      }
    } catch (error) {
      console.error('Error fetching acquisitions:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as aquisições.",
        variant: "destructive",
      });
    }
  };

  // Cálculos para aquisições ativas
  const totalInvestidoAtivas = activeAcquisitions.reduce((sum, acq) => sum + Number(acq.preco_pago), 0);
  const totalLucroAtivas = activeAcquisitions.reduce((sum, acq) => sum + Number(acq.lucro), 0);
  const totalAquisicoes = acquisitions.length;
  const aquisitiveAtivas = activeAcquisitions.length;

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
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
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                Lucro Acumulado (Ativas)
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(totalLucroAtivas)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalInvestidoAtivas > 0 ? ((totalLucroAtivas / totalInvestidoAtivas) * 100).toFixed(1) : '0'}% de rentabilidade
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
              <div className="text-2xl font-bold">{aquisitiveAtivas}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalAquisicoes} no total
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
              <div className="text-2xl font-bold">{finishedAcquisitions.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Concluídas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <OverviewCharts acquisitions={activeAcquisitions} />

        {/* Tabelas de Aquisições com Tabs */}
        <Tabs defaultValue="ativas" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="ativas">Aquisições Ativas ({aquisitiveAtivas})</TabsTrigger>
            <TabsTrigger value="finalizadas">Aquisições Finalizadas ({finishedAcquisitions.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ativas">
            <AcquisitionsTable acquisitions={activeAcquisitions} title="Aquisições Ativas" />
          </TabsContent>
          
          <TabsContent value="finalizadas">
            <AcquisitionsTable acquisitions={finishedAcquisitions} title="Aquisições Finalizadas" />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;

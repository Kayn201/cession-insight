import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Acquisition = {
  id: string;
  data_aquisicao: string;
  incidente: string;
  preco_pago: number;
  lucro: number;
  data_pagamento?: string | null;
  status?: 'ativa' | 'finalizada';
};

type OverviewChartsProps = {
  acquisitions: Acquisition[];
  finishedAcquisitions?: Acquisition[];
};

const OverviewCharts = ({ acquisitions, finishedAcquisitions = [] }: OverviewChartsProps) => {
  const [timeView, setTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [statusFilter, setStatusFilter] = useState<'ativas' | 'finalizadas'>('ativas');

  // Filtrar aquisições baseado no status
  const filteredAcquisitions = useMemo(() => {
    if (statusFilter === 'finalizadas') {
      // Para finalizadas, usar apenas as que têm data de pagamento
      return finishedAcquisitions.filter(acq => acq.data_pagamento);
    } else {
      // Para ativas, usar apenas as que não têm data de pagamento
      return acquisitions.filter(acq => !acq.data_pagamento);
    }
  }, [acquisitions, finishedAcquisitions, statusFilter]);

  const monthlyData = useMemo(() => {
    const periodMap = new Map<string, { investido: number; lucro: number }>();
    
    filteredAcquisitions.forEach((acq) => {
      // Para finalizadas, usar data de pagamento; para ativas, usar data de aquisição
      const dateKey = statusFilter === 'finalizadas' && acq.data_pagamento 
        ? acq.data_pagamento 
        : acq.data_aquisicao;
      
      const date = new Date(dateKey);
      const periodKey = timeView === 'monthly'
        ? date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        : date.getFullYear().toString();
      
      const current = periodMap.get(periodKey) || { investido: 0, lucro: 0 };
      periodMap.set(periodKey, {
        investido: current.investido + Number(acq.preco_pago),
        lucro: current.lucro + Number(acq.lucro),
      });
    });

    const data = Array.from(periodMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => {
        // Ordenar por data
        const dateA = new Date(a.name);
        const dateB = new Date(b.name);
        return dateA.getTime() - dateB.getTime();
      });
    
    return timeView === 'monthly' ? data.slice(-12) : data;
  }, [filteredAcquisitions, timeView, statusFilter]);

  const incidentData = useMemo(() => {
    const incidentMap = new Map<string, number>();
    
    filteredAcquisitions.forEach((acq) => {
      const current = incidentMap.get(acq.incidente) || 0;
      incidentMap.set(acq.incidente, current + 1);
    });

    const colors = {
      precatorio: "hsl(200, 90%, 40%)",
      rpv: "hsl(210, 85%, 50%)",
      precatorio_prioridade: "hsl(142, 76%, 36%)",
      precatorio_sjrp: "hsl(280, 70%, 45%)",
    };

    return Array.from(incidentMap.entries()).map(([name, value]) => ({
      name: name.replace(/_/g, ' ').toUpperCase(),
      value,
      color: colors[name as keyof typeof colors] || "hsl(0, 0%, 50%)",
    }));
  }, [filteredAcquisitions]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>Investimentos e Lucros</CardTitle>
              <Tabs value={timeView} onValueChange={(value) => setTimeView(value as 'monthly' | 'annual')}>
                <TabsList>
                  <TabsTrigger value="monthly">Mensal</TabsTrigger>
                  <TabsTrigger value="annual">Anual</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ativas' | 'finalizadas')}>
              <TabsList>
                <TabsTrigger value="ativas">Ativos</TabsTrigger>
                <TabsTrigger value="finalizadas">Finalizados</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(value as number)
                }
              />
              <Bar dataKey="investido" fill="hsl(200, 90%, 40%)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="lucro" fill="hsl(142, 76%, 36%)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Distribuição por Tipo de Incidente</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={incidentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {incidentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewCharts;

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
};

type OverviewChartsProps = {
  acquisitions: Acquisition[];
};

const OverviewCharts = ({ acquisitions }: OverviewChartsProps) => {
  const [timeView, setTimeView] = useState<'monthly' | 'annual'>('monthly');

  const monthlyData = useMemo(() => {
    const periodMap = new Map<string, { investido: number; lucro: number }>();
    
    acquisitions.forEach((acq) => {
      const date = new Date(acq.data_aquisicao);
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
      .map(([name, data]) => ({ name, ...data }));
    
    return timeView === 'monthly' ? data.slice(-6) : data;
  }, [acquisitions, timeView]);

  const incidentData = useMemo(() => {
    const incidentMap = new Map<string, number>();
    
    acquisitions.forEach((acq) => {
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
  }, [acquisitions]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Investimentos e Lucros</CardTitle>
            <Tabs value={timeView} onValueChange={(value) => setTimeView(value as 'monthly' | 'annual')}>
              <TabsList>
                <TabsTrigger value="monthly">Mensal</TabsTrigger>
                <TabsTrigger value="annual">Anual</TabsTrigger>
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

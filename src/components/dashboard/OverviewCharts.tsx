import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useMemo } from "react";

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
  const monthlyData = useMemo(() => {
    const monthsMap = new Map<string, { investido: number; lucro: number }>();
    
    acquisitions.forEach((acq) => {
      const date = new Date(acq.data_aquisicao);
      const monthYear = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      const current = monthsMap.get(monthYear) || { investido: 0, lucro: 0 };
      monthsMap.set(monthYear, {
        investido: current.investido + Number(acq.preco_pago),
        lucro: current.lucro + Number(acq.lucro),
      });
    });

    return Array.from(monthsMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .slice(-6);
  }, [acquisitions]);

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
          <CardTitle>Investimentos e Lucros Mensais</CardTitle>
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

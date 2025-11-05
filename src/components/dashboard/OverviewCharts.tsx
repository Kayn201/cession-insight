import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const monthlyData = [
  { name: "Jan", investido: 245000, lucro: 52000 },
  { name: "Fev", investido: 320000, lucro: 68000 },
  { name: "Mar", investido: 280000, lucro: 58000 },
  { name: "Abr", investido: 400000, lucro: 82000 },
];

const incidentData = [
  { name: "Precatórios", value: 45, color: "hsl(200, 90%, 40%)" },
  { name: "RPV", value: 30, color: "hsl(210, 85%, 50%)" },
  { name: "Prioridade", value: 25, color: "hsl(142, 76%, 36%)" },
];

const OverviewCharts = () => {
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

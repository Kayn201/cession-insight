import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockData = [
  {
    id: 1,
    dataAquisicao: "15/01/2024",
    incidente: "Precatório",
    cessionario: "João Silva",
    valorIncidente: 150000,
    precoPago: 120000,
    valorLiquido: 142500,
    lucro: 22500,
    fase: "Habilitação",
    proximaVerificacao: "20/02/2024",
  },
  {
    id: 2,
    dataAquisicao: "22/01/2024",
    incidente: "RPV",
    cessionario: "Maria Santos",
    valorIncidente: 85000,
    precoPago: 68000,
    valorLiquido: 80750,
    lucro: 12750,
    fase: "Pagamento",
    proximaVerificacao: "15/02/2024",
  },
  {
    id: 3,
    dataAquisicao: "10/02/2024",
    incidente: "Precatório Prioridade",
    cessionario: "Carlos Oliveira",
    valorIncidente: 250000,
    precoPago: 200000,
    valorLiquido: 237500,
    lucro: 37500,
    fase: "Análise",
    proximaVerificacao: "01/03/2024",
  },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const AcquisitionsTable = () => {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Aquisições Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="precatorio">Precatórios</TabsTrigger>
            <TabsTrigger value="rpv">RPV</TabsTrigger>
            <TabsTrigger value="prioridade">Prioridade</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Incidente</TableHead>
                    <TableHead>Cessionário</TableHead>
                    <TableHead className="text-right">Valor Pago</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Próx. Verificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.dataAquisicao}</TableCell>
                      <TableCell>
                        <Badge variant={item.incidente === "RPV" ? "secondary" : "outline"}>
                          {item.incidente}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.cessionario}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.precoPago)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.valorLiquido)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-success">
                        {formatCurrency(item.lucro)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.fase}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.proximaVerificacao}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="precatorio">
            <p className="text-center text-muted-foreground py-8">
              Filtro de precatórios em desenvolvimento
            </p>
          </TabsContent>
          <TabsContent value="rpv">
            <p className="text-center text-muted-foreground py-8">
              Filtro de RPV em desenvolvimento
            </p>
          </TabsContent>
          <TabsContent value="prioridade">
            <p className="text-center text-muted-foreground py-8">
              Filtro de prioridade em desenvolvimento
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AcquisitionsTable;

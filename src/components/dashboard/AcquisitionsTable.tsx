import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Acquisition = {
  id: string;
  data_aquisicao: string;
  incidente: string;
  cessionario_nome: string;
  valor_incidente: number;
  preco_pago: number;
  valor_liquido: number;
  lucro: number;
  status: "ativa" | "finalizada";
  fase_processo: string | null;
  proxima_verificacao: string | null;
  pessoas: string | null;
};

type AcquisitionsTableProps = {
  acquisitions: Acquisition[];
  title?: string;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("pt-BR");
};

const getIncidentBadgeVariant = (incidente: string) => {
  if (incidente === "rpv") return "secondary";
  if (incidente === "precatorio_prioridade") return "default";
  return "outline";
};

const AcquisitionsTable = ({ acquisitions, title = "Aquisições" }: AcquisitionsTableProps) => {
  const precatorios = acquisitions.filter((a) => a.incidente === "precatorio");
  const rpvs = acquisitions.filter((a) => a.incidente === "rpv");
  const prioridade = acquisitions.filter((a) => a.incidente === "precatorio_prioridade");
  const sjrp = acquisitions.filter((a) => a.incidente === "precatorio_sjrp");
  const renderTable = (data: Acquisition[]) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Incidente</TableHead>
            <TableHead>Cessionário</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-right">Valor Pago</TableHead>
            <TableHead className="text-right">Valor Líquido</TableHead>
            <TableHead className="text-right">Lucro</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead>Próx. Verificação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                Nenhuma aquisição encontrada
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{formatDate(item.data_aquisicao)}</TableCell>
                <TableCell>
                  <Badge variant={getIncidentBadgeVariant(item.incidente)}>
                    {item.incidente.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{item.cessionario_nome}</TableCell>
                <TableCell className="text-muted-foreground">{item.pessoas || "N/A"}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(item.preco_pago))}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(item.valor_liquido))}</TableCell>
                <TableCell className="text-right font-semibold text-success">
                  {formatCurrency(Number(item.lucro))}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{item.fase_processo || "N/A"}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.proxima_verificacao ? formatDate(item.proxima_verificacao) : "N/A"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todas ({acquisitions.length})</TabsTrigger>
            <TabsTrigger value="precatorio">Precatórios ({precatorios.length})</TabsTrigger>
            <TabsTrigger value="rpv">RPV ({rpvs.length})</TabsTrigger>
            <TabsTrigger value="prioridade">Prioridade ({prioridade.length})</TabsTrigger>
            <TabsTrigger value="sjrp">SJRP ({sjrp.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">{renderTable(acquisitions)}</TabsContent>

          <TabsContent value="precatorio">{renderTable(precatorios)}</TabsContent>

          <TabsContent value="rpv">{renderTable(rpvs)}</TabsContent>

          <TabsContent value="prioridade">{renderTable(prioridade)}</TabsContent>

          <TabsContent value="sjrp">{renderTable(sjrp)}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AcquisitionsTable;

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const GROUP_LABEL_MAP: Record<string, string> = {
  "Aquisições Precatórios": "Precatório (padrão)",
  "Aquisições Precatórios (Acordo)": "Precatório acordo",
  "Aquisições Precatórios Prioridade": "Precatório prioridade",
  "Aquisições Precatórios SJRP": "Precatório SJRP",
  "Aquisições Finalizadas": "Precatório (finalizadas)",
  "Aquisições RPV": "RPV",
};

const sanitizeGroupKey = (label: string, used: Set<string>) => {
  const baseLabel = label || "Sem grupo";
  const normalized = baseLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const baseKey = normalized || "grupo";

  let key = baseKey;
  let suffix = 1;
  while (used.has(key)) {
    key = `${baseKey}_${suffix}`;
    suffix += 1;
  }
  used.add(key);
  return key;
};

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
  grupo: string | null;
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
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({});
  const ITEMS_PER_PAGE = 10;
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("all");

  const groups = useMemo(() => {
    const groupMap = new Map<
      string,
      { key: string; label: string; acquisitions: Acquisition[]; count: number }
    >();
    const usedKeys = new Set<string>();

    acquisitions.forEach((acq) => {
      const rawGroup = acq.grupo || "Sem grupo";
      if (!groupMap.has(rawGroup)) {
        const key = sanitizeGroupKey(rawGroup, usedKeys);
        const label = GROUP_LABEL_MAP[rawGroup] || rawGroup;
        groupMap.set(rawGroup, {
          key,
          label,
          acquisitions: [],
          count: 0,
        });
      }

      const entry = groupMap.get(rawGroup)!;
      entry.acquisitions.push(acq);
      entry.count += 1;
    });

    return Array.from(groupMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR")
    );
  }, [acquisitions]);

  useEffect(() => {
    if (selectedGroupKey === "all") return;
    const exists = groups.some((group) => group.key === selectedGroupKey);
    if (!exists) {
      setSelectedGroupKey("all");
    }
  }, [groups, selectedGroupKey]);

  const selectedGroup =
    selectedGroupKey === "all" ? null : groups.find((group) => group.key === selectedGroupKey) || null;

  const toggleExpand = (tabKey: string) => {
    setExpandedTabs(prev => ({
      ...prev,
      [tabKey]: !prev[tabKey]
    }));
  };

  const renderTable = (data: Acquisition[], tabKey: string) => {
    const isExpanded = expandedTabs[tabKey] || false;
    const displayData = isExpanded ? data : data.slice(0, ITEMS_PER_PAGE);
    const hasMore = data.length > ITEMS_PER_PAGE;

    return (
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
            {displayData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nenhuma aquisição encontrada
                </TableCell>
              </TableRow>
            ) : (
              <>
                {displayData.map((item) => (
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
                ))}
                {hasMore && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4">
                      <Button
                        variant="outline"
                        onClick={() => toggleExpand(tabKey)}
                        className="w-full md:w-auto"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="mr-2 h-4 w-4" />
                            Mostrar menos
                          </>
                        ) : (
                          <>
                            <ChevronDown className="mr-2 h-4 w-4" />
                            Expandir para ver todos ({data.length} itens)
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <Select value={selectedGroupKey} onValueChange={setSelectedGroupKey}>
            <SelectTrigger className="w-full sm:w-72 text-sm">
              <SelectValue placeholder="Selecione o grupo" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">
                Todos os grupos ({acquisitions.length})
              </SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.key} value={group.key}>
                  {group.label} ({group.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">
            Exibindo {selectedGroup ? selectedGroup.count : acquisitions.length} aquisições
          </span>
        </div>

        {renderTable(selectedGroup ? selectedGroup.acquisitions : acquisitions, selectedGroup ? selectedGroup.key : "all")}
      </CardContent>
    </Card>
  );
};

export default AcquisitionsTable;

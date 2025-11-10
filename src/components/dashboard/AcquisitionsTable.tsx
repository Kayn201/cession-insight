import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronRight, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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
  titular_acao?: string | null;
  mapa_orcamentario?: string | null;
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

// Formatar valores monetários para mobile (Mil, Mi, Bi, Tri)
const formatMobileCurrency = (value: number) => {
  const absValue = Math.abs(value);
  const suffixes: Array<{ threshold: number; suffix: string }> = [
    { threshold: 1_000_000_000_000, suffix: 'Tri' },
    { threshold: 1_000_000_000, suffix: 'Bi' },
    { threshold: 1_000_000, suffix: 'Mi' },
    { threshold: 1_000, suffix: 'Mil' },
  ];

  for (const { threshold, suffix } of suffixes) {
    if (absValue >= threshold) {
      const formatted = (value / threshold).toFixed(1).replace(/\.0$/, '');
      return `R$ ${formatted} ${suffix}`;
    }
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
};

const getIncidentBadgeVariant = (incidente: string) => {
  if (incidente === "rpv") return "secondary";
  if (incidente === "precatorio_prioridade") return "default";
  return "outline";
};

const AcquisitionsTable = ({ acquisitions, title = "Aquisições" }: AcquisitionsTableProps) => {
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const isMobile = useIsMobile();
  const ITEMS_PER_PAGE = isMobile ? 4 : 8;

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

  // Filtrar aquisições baseado no grupo selecionado e termo de pesquisa
  const filteredAcquisitions = useMemo(() => {
    let filtered = selectedGroup ? selectedGroup.acquisitions : acquisitions;
    
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((acq) => {
        const nome = (acq.titular_acao || acq.cessionario_nome || "").toLowerCase();
        return nome.includes(searchLower);
      });
    }
    
    return filtered;
  }, [acquisitions, selectedGroup, searchTerm]);

  const toggleExpand = (tabKey: string) => {
    setExpandedTabs(prev => ({
      ...prev,
      [tabKey]: !prev[tabKey]
    }));
  };

  const toggleItemExpand = (itemId: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Renderizar layout mobile com cards
  const renderMobileView = (data: Acquisition[], tabKey: string) => {
    const isExpanded = expandedTabs[tabKey] || false;
    const displayData = isExpanded ? data : data.slice(0, ITEMS_PER_PAGE);
    const hasMore = data.length > ITEMS_PER_PAGE;

    if (displayData.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          Nenhuma aquisição encontrada
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {displayData.map((item) => {
          const isItemExpanded = expandedItems[item.id] || false;
          const nome = item.titular_acao || item.cessionario_nome || "Sem nome";
          
          return (
            <Card key={item.id} className="shadow-sm">
              <CardContent className="p-4">
                {/* Informações principais */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Data da Aquisição</p>
                      <p className="font-medium text-sm">{formatDate(item.data_aquisicao)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleItemExpand(item.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isItemExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="font-medium text-sm">{nome}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-muted-foreground">Incidente</p>
                    <Badge variant={getIncidentBadgeVariant(item.incidente)} className="text-xs">
                      {item.incidente.replace(/_/g, " ").toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Valor Pago</p>
                      <p className="font-semibold text-sm">{formatMobileCurrency(Number(item.preco_pago))}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Lucro</p>
                      <p className="font-semibold text-sm text-success">{formatMobileCurrency(Number(item.lucro))}</p>
                    </div>
                  </div>
                </div>

                {/* Detalhamento expandido */}
                {isItemExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Incidente</p>
                      <Badge variant={getIncidentBadgeVariant(item.incidente)} className="text-xs">
                        {item.incidente.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </div>
                    
                    {item.mapa_orcamentario && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Mapa Orçamentário</p>
                        <p className="text-sm">{item.mapa_orcamentario}</p>
                      </div>
                    )}
                    
                    {item.pessoas && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                        <p className="text-sm">{item.pessoas}</p>
                      </div>
                    )}
                    
                    {item.proxima_verificacao && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Próxima Verificação</p>
                        <p className="text-sm">{formatDate(item.proxima_verificacao)}</p>
                      </div>
                    )}
                    
                    {item.fase_processo && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Fase do Processo</p>
                        <Badge variant="outline" className="text-xs">{item.fase_processo}</Badge>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Valor do Incidente</p>
                      <p className="text-sm font-medium">{formatCurrency(Number(item.valor_incidente))}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Preço Pago</p>
                      <p className="text-sm font-medium">{formatCurrency(Number(item.preco_pago))}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Valor Líquido do Incidente</p>
                      <p className="text-sm font-medium">{formatCurrency(Number(item.valor_liquido))}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Lucro</p>
                      <p className="text-sm font-semibold text-success">{formatCurrency(Number(item.lucro))}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        
        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => toggleExpand(tabKey)}
              className="w-full"
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
          </div>
        )}
      </div>
    );
  };

  // Renderizar layout desktop com cards
  const renderDesktopView = (data: Acquisition[], tabKey: string) => {
    const isExpanded = expandedTabs[tabKey] || false;
    const displayData = isExpanded ? data : data.slice(0, ITEMS_PER_PAGE);
    const hasMore = data.length > ITEMS_PER_PAGE;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayData.map((item) => {
            const isItemExpanded = expandedItems[item.id] || false;
            const nome = item.titular_acao || item.cessionario_nome || "Sem nome";
            
            return (
              <Card key={item.id} className="shadow-sm">
                <CardContent className="p-4">
                  {/* Informações principais */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Data da Aquisição</p>
                        <p className="font-medium text-sm">{formatDate(item.data_aquisicao)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleItemExpand(item.id)}
                        className="h-8 w-8 p-0"
                      >
                        {isItemExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground">Nome</p>
                      <p className="font-medium text-sm">{nome}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground">Incidente</p>
                      <Badge variant={getIncidentBadgeVariant(item.incidente)} className="text-xs">
                        {item.incidente.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Valor Pago</p>
                        <p className="font-semibold text-sm">{formatCurrency(Number(item.preco_pago))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Lucro</p>
                        <p className="font-semibold text-sm text-success">{formatCurrency(Number(item.lucro))}</p>
                      </div>
                    </div>
                  </div>

                  {/* Detalhamento expandido */}
                  {isItemExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {item.mapa_orcamentario && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Mapa Orçamentário</p>
                          <p className="text-sm">{item.mapa_orcamentario}</p>
                        </div>
                      )}
                      
                      {item.pessoas && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                          <p className="text-sm">{item.pessoas}</p>
                        </div>
                      )}
                      
                      {item.proxima_verificacao && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Próxima Verificação</p>
                          <p className="text-sm">{formatDate(item.proxima_verificacao)}</p>
                        </div>
                      )}
                      
                      {item.fase_processo && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Fase do Processo</p>
                          <Badge variant="outline" className="text-xs">{item.fase_processo}</Badge>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valor do Incidente</p>
                        <p className="text-sm font-medium">{formatCurrency(Number(item.valor_incidente))}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Preço Pago</p>
                        <p className="text-sm font-medium">{formatCurrency(Number(item.preco_pago))}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valor Líquido do Incidente</p>
                        <p className="text-sm font-medium">{formatCurrency(Number(item.valor_liquido))}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Lucro</p>
                        <p className="text-sm font-semibold text-success">{formatCurrency(Number(item.lucro))}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {displayData.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Nenhuma aquisição encontrada
          </div>
        )}
        
        {hasMore && (
          <div className="flex justify-center pt-2">
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
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-card overflow-visible">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-visible">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Select value={selectedGroupKey} onValueChange={setSelectedGroupKey}>
              <SelectTrigger className="w-full sm:w-72 text-sm">
                <SelectValue placeholder="Selecione o grupo" />
              </SelectTrigger>
              <SelectContent 
                className="max-h-64 z-[100]"
                position="popper"
                side="bottom"
                sideOffset={4}
                align="start"
                collisionPadding={8}
                avoidCollisions={true}
              >
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

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Pesquisar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <span className="text-sm text-muted-foreground">
            Exibindo {filteredAcquisitions.length} aquisição{filteredAcquisitions.length !== 1 ? 'ões' : ''}
          </span>
        </div>

        {isMobile 
          ? renderMobileView(filteredAcquisitions, selectedGroup ? selectedGroup.key : "all")
          : renderDesktopView(filteredAcquisitions, selectedGroup ? selectedGroup.key : "all")
        }
      </CardContent>
    </Card>
  );
};

export default AcquisitionsTable;

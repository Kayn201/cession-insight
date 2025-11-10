import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart, Area, AreaChart, LabelList } from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

type Acquisition = {
  id: string;
  data_aquisicao: string;
  incidente: string;
  preco_pago: number;
  valor_incidente: number;
  valor_liquido: number;
  lucro: number;
  data_pagamento?: string | null;
  pagamento_aquisicao?: string | null;
  status?: 'ativa' | 'finalizada';
  cessionario_nome?: string;
  fase_processo?: string | null;
  mapa_orcamentario?: string | null;
  grupo?: string | null; // Grupo do Monday.com
};

type OverviewChartsProps = {
  acquisitions: Acquisition[];
  finishedAcquisitions?: Acquisition[];
  allAcquisitions?: Acquisition[]; // Todas as aquisições para o gráfico de contratos fechados
};

type PendentesData = {
  availableYears: number[];
  mapaEntries: Array<{ key: string; label: string }>;
  mapaData: Array<Record<string, string | number>>;
  etapaData: Array<{ name: string; quantidade: number }>;
  totalBase: number;
  count: number;
};

const sanitizeKey = (label: string, index: number, used: Set<string>) => {
  let keyBase = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (!keyBase) keyBase = `mapa_${index}`;
  let key = keyBase;
  let suffix = 1;
  while (used.has(key)) {
    key = `${keyBase}_${suffix}`;
    suffix += 1;
  }
  used.add(key);
  return key;
};

const extractStageNumber = (value: string) => {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : Number.MAX_SAFE_INTEGER;
};

const normalizeGroupName = (value?: string | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

type PrecatorioResumoGroupValue = 'all' | 'precatorio' | 'acordo' | 'prioridade' | 'sjrp' | 'finalizadas';

type PrecatorioResumoGroupOption = {
  value: PrecatorioResumoGroupValue;
  label: string;
  groupNames?: string[];
};

const ALL_PRECATORIO_GROUP_NAMES = [
  'Aquisições Precatórios',
  'Aquisições Precatórios (Acordo)',
  'Aquisições Precatórios Prioridade',
  'Aquisições Precatórios SJRP',
  'Aquisições Finalizadas',
];

const PRECATORIO_RESUMO_GROUP_OPTIONS: PrecatorioResumoGroupOption[] = [
  {
    value: 'all',
    label: 'Todos os grupos',
  },
  {
    value: 'precatorio',
    label: 'Precatório (padrão)',
    groupNames: ['Aquisições Precatórios'],
  },
  {
    value: 'acordo',
    label: 'Precatório acordo',
    groupNames: ['Aquisições Precatórios (Acordo)'],
  },
  {
    value: 'prioridade',
    label: 'Precatório prioridade',
    groupNames: ['Aquisições Precatórios Prioridade'],
  },
  {
    value: 'sjrp',
    label: 'Precatório SJRP',
    groupNames: ['Aquisições Precatórios SJRP'],
  },
  {
    value: 'finalizadas',
    label: 'Precatório (finalizadas)',
    groupNames: ['Aquisições Finalizadas'],
  },
];

const computePendentesData = (
  targetGroup: string,
  acquisitions: Acquisition[],
  allAcquisitions: Acquisition[],
  timeView: 'monthly' | 'annual',
  selectedYear: string,
  filterPredicate?: (acq: Acquisition) => boolean,
  matchMode: 'includes' | 'equals' = 'includes'
): PendentesData => {
  const normalizedGroup = targetGroup.toLowerCase();
  const primaryList = allAcquisitions && allAcquisitions.length > 0 ? allAcquisitions : acquisitions;

  const currentCessionarioRaw = acquisitions[0]?.cessionario_nome
    || allAcquisitions[0]?.cessionario_nome
    || null;
  const currentCessionario = currentCessionarioRaw ? currentCessionarioRaw.toLowerCase().trim() : null;

  const baseList = (primaryList || []).filter((acq) => {
    if (!acq) return false;
    if (acq.status && acq.status !== 'ativa') return false;

    const groupName = (acq.grupo || '').toLowerCase().trim();
    const matchesGroup = matchMode === 'equals'
      ? groupName === normalizedGroup
      : groupName.includes(normalizedGroup);
    if (!matchesGroup) return false;

    if (currentCessionario) {
      const acqCessionario = (acq.cessionario_nome || '').toLowerCase().trim();
      if (acqCessionario !== currentCessionario) return false;
    }

    if (filterPredicate && !filterPredicate(acq)) return false;

    return true;
  });

  if (baseList.length === 0) {
    return {
      availableYears: [],
      mapaEntries: [],
      mapaData: [],
      etapaData: [],
      totalBase: 0,
      count: 0,
    };
  }

  const yearsSet = new Set<number>();
  baseList.forEach((acq) => {
    if (!acq.data_aquisicao) return;
    const date = new Date(acq.data_aquisicao);
    if (!isNaN(date.getTime())) {
      yearsSet.add(date.getFullYear());
    }
  });

  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  const filteredList = selectedYear === 'all'
    ? baseList
    : baseList.filter((acq) => {
        if (!acq.data_aquisicao) return false;
        const date = new Date(acq.data_aquisicao);
        return !isNaN(date.getTime()) && date.getFullYear() === parseInt(selectedYear, 10);
      });

  if (filteredList.length === 0) {
    return {
      availableYears,
      mapaEntries: [],
      mapaData: [],
      etapaData: [],
      totalBase: baseList.length,
      count: 0,
    };
  }

  const periodMap = new Map<string, Map<string, number>>();
  const mapaTotals = new Map<string, number>();
  const etapaMap = new Map<string, number>();

  filteredList.forEach((acq) => {
    if (!acq.data_aquisicao) return;
    const date = new Date(acq.data_aquisicao);
    if (isNaN(date.getTime())) return;

    const periodKey = timeView === 'monthly'
      ? `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`
      : date.getFullYear().toString();

    const mapaLabel = (acq.mapa_orcamentario || 'Sem mapa').trim() || 'Sem mapa';
    const etapaLabel = (acq.fase_processo || 'Sem fase').trim() || 'Sem fase';

    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, new Map<string, number>());
    }
    const currentPeriod = periodMap.get(periodKey)!;
    currentPeriod.set(mapaLabel, (currentPeriod.get(mapaLabel) || 0) + 1);

    mapaTotals.set(mapaLabel, (mapaTotals.get(mapaLabel) || 0) + 1);
    etapaMap.set(etapaLabel, (etapaMap.get(etapaLabel) || 0) + 1);
  });

  const usedKeys = new Set<string>();
  const mapaEntries = Array.from(mapaTotals.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([label], index) => ({
      key: sanitizeKey(label, index, usedKeys),
      label,
    }));

  const mapaData = Array.from(periodMap.entries())
    .map(([period, counts]) => {
      const entry: Record<string, string | number> = { name: period };
      mapaEntries.forEach(({ key, label }) => {
        entry[key] = counts.get(label) || 0;
      });
      return entry;
    })
    .sort((a, b) => {
      const nameA = String(a.name);
      const nameB = String(b.name);

      if (timeView === 'monthly') {
        const partsA = nameA.split('/');
        const partsB = nameB.split('/');
        if (partsA.length === 2 && partsB.length === 2) {
          const monthA = parseInt(partsA[0], 10);
          const yearA = parseInt(`20${partsA[1]}`, 10);
          const monthB = parseInt(partsB[0], 10);
          const yearB = parseInt(`20${partsB[1]}`, 10);
          if (yearA !== yearB) return yearA - yearB;
          return monthA - monthB;
        }
      } else {
        const yearA = parseInt(nameA, 10);
        const yearB = parseInt(nameB, 10);
        if (!isNaN(yearA) && !isNaN(yearB)) {
          return yearA - yearB;
        }
      }
      return nameA.localeCompare(nameB);
    });

  const etapaData = Array.from(etapaMap.entries())
    .map(([name, quantidade]) => ({ name, quantidade }))
    .sort((a, b) => {
      const numA = extractStageNumber(a.name);
      const numB = extractStageNumber(b.name);
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

  return {
    availableYears,
    mapaEntries,
    mapaData,
    etapaData,
    totalBase: baseList.length,
    count: filteredList.length,
  };
};

const useMonthlyViewYearSync = (
  isMobile: boolean,
  timeView: 'monthly' | 'annual',
  selectedYear: string,
  setSelectedYear: (value: string) => void,
  availableYears: number[],
) => {
  const previousTimeViewRef = useRef<'monthly' | 'annual' | null>(null);

  useEffect(() => {
    if (!isMobile) {
      previousTimeViewRef.current = timeView;
      return;
    }

    const firstYear = availableYears.length > 0 ? availableYears[0].toString() : null;
    const selectedYearNumber = parseInt(selectedYear, 10);
    const isSelectedYearValid = !Number.isNaN(selectedYearNumber) && availableYears.includes(selectedYearNumber);
    const previousTimeView = previousTimeViewRef.current;

    if (timeView === 'monthly') {
      if (!isSelectedYearValid && firstYear) {
        setSelectedYear(firstYear);
        previousTimeViewRef.current = timeView;
        return;
      }

      if (previousTimeView !== 'monthly' && firstYear && selectedYear !== firstYear) {
        setSelectedYear(firstYear);
        previousTimeViewRef.current = timeView;
        return;
      }
    } else if (timeView === 'annual' && selectedYear !== 'all') {
      setSelectedYear('all');
      previousTimeViewRef.current = timeView;
      return;
    }

    previousTimeViewRef.current = timeView;
  }, [isMobile, timeView, selectedYear, setSelectedYear, availableYears]);
};

const OverviewCharts = ({ acquisitions, finishedAcquisitions = [], allAcquisitions = [] }: OverviewChartsProps) => {
  const [timeView, setTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [statusFilter, setStatusFilter] = useState<'ativas' | 'finalizadas'>('ativas');
  const [contractsView, setContractsView] = useState<'volume' | 'tipo'>('volume');
  const [contractsTimeView, setContractsTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [valuesView, setValuesView] = useState<'valores' | 'tipo'>('valores');
  const [valuesTimeView, setValuesTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [selectedInvestimentosYear, setSelectedInvestimentosYear] = useState<string>('all');
  const [selectedContratosYear, setSelectedContratosYear] = useState<string>('all');
  const [selectedValoresYear, setSelectedValoresYear] = useState<string>('all');
  const [rpvView, setRpvView] = useState<'valor' | 'percentual'>('valor');
  const [rpvTimeView, setRpvTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [selectedRpvYear, setSelectedRpvYear] = useState<string>('all');
  const [rpvExpanded, setRpvExpanded] = useState<boolean>(false);
  const [precatorioResumoView, setPrecatorioResumoView] = useState<'valor' | 'percentual'>('valor');
  const [precatorioResumoTimeView, setPrecatorioResumoTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPrecatorioResumoYear, setSelectedPrecatorioResumoYear] = useState<string>('all');
  const [selectedPrecatorioResumoGroup, setSelectedPrecatorioResumoGroup] = useState<PrecatorioResumoGroupValue>('all');
  const [precatorioResumoExpanded, setPrecatorioResumoExpanded] = useState<boolean>(false);
  const [extraChartsExpanded, setExtraChartsExpanded] = useState<boolean>(false);
  const [valoresRecebidosView, setValoresRecebidosView] = useState<'geral' | 'detalhado'>('geral');
  const [valoresRecebidosTimeView, setValoresRecebidosTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [selectedValoresRecebidosYear, setSelectedValoresRecebidosYear] = useState<string>('all');
  const [valoresRecebidosExpanded, setValoresRecebidosExpanded] = useState<boolean>(false);
  const [valoresPendentesView, setValoresPendentesView] = useState<'valores' | 'quantidade'>('valores');
  const [rpvPendentesView, setRpvPendentesView] = useState<'acumulado' | 'etapas'>('acumulado');
  const [rpvPendentesTimeView, setRpvPendentesTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [selectedRpvPendentesYear, setSelectedRpvPendentesYear] = useState<string>('all');
  const [precatorioPendentesView, setPrecatorioPendentesView] = useState<'mapa' | 'etapa'>('mapa');
  const [precatorioPendentesTimeView, setPrecatorioPendentesTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPrecatorioPendentesYear, setSelectedPrecatorioPendentesYear] = useState<string>('all');
  const [precatorioPrioridadePendentesView, setPrecatorioPrioridadePendentesView] = useState<'mapa' | 'etapa'>('mapa');
  const [precatorioPrioridadePendentesTimeView, setPrecatorioPrioridadePendentesTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPrecatorioPrioridadePendentesYear, setSelectedPrecatorioPrioridadePendentesYear] = useState<string>('all');
  const [precatorioSjrpPendentesView, setPrecatorioSjrpPendentesView] = useState<'mapa' | 'etapa'>('mapa');
  const [precatorioSjrpPendentesTimeView, setPrecatorioSjrpPendentesTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPrecatorioSjrpPendentesYear, setSelectedPrecatorioSjrpPendentesYear] = useState<string>('all');
  const [precatorioAcordoPendentesView, setPrecatorioAcordoPendentesView] = useState<'mapa' | 'etapa'>('mapa');
  const [precatorioAcordoPendentesTimeView, setPrecatorioAcordoPendentesTimeView] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPrecatorioAcordoPendentesYear, setSelectedPrecatorioAcordoPendentesYear] = useState<string>('all');

  const isMobile = useIsMobile();
  const mobileChartMinHeight = 360;
  const formatMobileCurrencyTick = (value: number) => {
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
        return `${formatted}${suffix}`;
      }
    }

    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 0,
    }).format(value);
  };

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

  const investimentosData = useMemo(() => {
    const periodMap = new Map<string, { investido: number; lucro: number }>();
    const yearsSet = new Set<number>();
    
    filteredAcquisitions.forEach((acq) => {
      const dateKey =
        statusFilter === 'finalizadas' && acq.data_pagamento
        ? acq.data_pagamento 
        : acq.data_aquisicao;
      
      if (!dateKey) return;
      
      const date = new Date(dateKey);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear();
      yearsSet.add(year);

      if (
        timeView === 'monthly' &&
        selectedInvestimentosYear !== 'all' &&
        year !== parseInt(selectedInvestimentosYear, 10)
      ) {
        return;
      }

      const periodKey =
        timeView === 'monthly'
        ? `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`
          : year.toString();
      
      const current = periodMap.get(periodKey) || { investido: 0, lucro: 0 };
      periodMap.set(periodKey, {
        investido: current.investido + Number(acq.preco_pago),
        lucro: current.lucro + Number(acq.lucro),
      });
    });

    const data = Array.from(periodMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => {
        if (timeView === 'monthly') {
          const nameA = String(a.name);
          const nameB = String(b.name);
          const partsA = nameA.split('/');
          const partsB = nameB.split('/');
          
          if (partsA.length === 2 && partsB.length === 2) {
            const monthA = parseInt(partsA[0], 10);
            const yearA = parseInt('20' + partsA[1], 10);
            const monthB = parseInt(partsB[0], 10);
            const yearB = parseInt('20' + partsB[1], 10);
            
            if (yearA !== yearB) {
              return yearA - yearB;
            }
            return monthA - monthB;
          }
          
          return nameA.localeCompare(nameB);
        }

        const yearA = parseInt(String(a.name), 10);
        const yearB = parseInt(String(b.name), 10);
        return yearA - yearB;
      });

    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

    const filteredData =
      timeView === 'monthly' && selectedInvestimentosYear !== 'all'
        ? data
        : timeView === 'monthly'
        ? data.slice(-12)
        : data;

    const totals = filteredData.reduce(
      (acc, item) => {
        acc.totalInvestido += Number(item.investido || 0);
        acc.totalLucro += Number(item.lucro || 0);
        return acc;
      },
      { totalInvestido: 0, totalLucro: 0 }
    );

    return { data: filteredData, availableYears, totals };
  }, [filteredAcquisitions, timeView, statusFilter, selectedInvestimentosYear]);

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

  const incidentTotalCount = useMemo(
    () => incidentData.reduce((sum, item) => sum + item.value, 0),
    [incidentData]
  );

  // Dados para o gráfico de Contratos Fechados
  const contractsData = useMemo(() => {
    // Combinar acquisitions e finishedAcquisitions (já filtrados por cessionário) - mesma lógica dos outros gráficos
    // Isso garante que cada usuário veja apenas seus próprios dados
    const allFilteredAcquisitions = [...(acquisitions || []), ...(finishedAcquisitions || [])];
    
    // Filtrar apenas aquisições com pagamento_aquisicao (campo "Pagamento Aquisição" do Monday)
    // Usar pagamento_aquisicao em vez de data_pagamento para não afetar outros gráficos
    const closedContracts = allFilteredAcquisitions.filter(acq => acq && acq.pagamento_aquisicao);
    
    if (closedContracts.length === 0) return { data: [], incidentTypes: [], availableYears: [], totalVolume: 0 };

    const periodMap = new Map<string, Map<string, number>>();
    const incidentTypes = new Set<string>();
    const yearsSet = new Set<number>();
    
    closedContracts.forEach((acq) => {
      if (!acq.pagamento_aquisicao) return;
      
      const date = new Date(acq.pagamento_aquisicao);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear();
      yearsSet.add(year);

      if (
        contractsTimeView === 'monthly' &&
        selectedContratosYear !== 'all' &&
        year !== parseInt(selectedContratosYear, 10)
      ) {
        return;
      }

      const periodKey = contractsTimeView === 'monthly'
        ? `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`
        : year.toString();
      
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, new Map<string, number>());
      }
      
      const periodData = periodMap.get(periodKey)!;
      const current = periodData.get(acq.incidente) || 0;
      periodData.set(acq.incidente, current + 1);
      incidentTypes.add(acq.incidente);
    });

    // Converter para array e ordenar
    const baseData = Array.from(periodMap.entries())
      .map(([name, incidents]) => {
        const entry: Record<string, number | string> = { name, total: 0 };
        
        incidentTypes.forEach(incident => {
          const count = incidents.get(incident) || 0;
          entry[incident] = count;
          entry.total = (entry.total as number) + count;
        });
        
        return entry;
      })
      .sort((a, b) => {
        if (contractsTimeView === 'monthly') {
          const nameA = String(a.name);
          const nameB = String(b.name);
          const partsA = nameA.split('/');
          const partsB = nameB.split('/');
          
          if (partsA.length === 2 && partsB.length === 2) {
            const monthA = parseInt(partsA[0], 10);
            const yearA = parseInt('20' + partsA[1], 10);
            const monthB = parseInt(partsB[0], 10);
            const yearB = parseInt('20' + partsB[1], 10);
            
            if (yearA !== yearB) {
              return yearA - yearB;
            }
            return monthA - monthB;
          }
          
          return nameA.localeCompare(nameB);
        } else {
          const yearA = parseInt(String(a.name), 10);
          const yearB = parseInt(String(b.name), 10);
          return yearA - yearB;
        }
      });

    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

    const data =
      contractsTimeView === 'monthly' && selectedContratosYear === 'all'
        ? baseData.slice(-12)
        : baseData;

    const totalVolume = data.reduce((sum, entry) => sum + Number(entry.total || 0), 0);

    return { data, incidentTypes: Array.from(incidentTypes), availableYears, totalVolume };
  }, [acquisitions, finishedAcquisitions, contractsTimeView, selectedContratosYear]);

  // Dados para o gráfico de Valores Pagos
  const valuesData = useMemo(() => {
    // Combinar acquisitions e finishedAcquisitions (já filtrados por cessionário)
    const allFilteredAcquisitions = [...(acquisitions || []), ...(finishedAcquisitions || [])];
    
    // Filtrar apenas aquisições com pagamento_aquisicao e preco_pago
    const paidAcquisitions = allFilteredAcquisitions.filter(acq => 
      acq && acq.pagamento_aquisicao && acq.preco_pago
    );
    
    if (paidAcquisitions.length === 0) return { data: [], incidentTypes: [], availableYears: [], totalPago: 0 };

    const periodMap = new Map<string, Map<string, number>>();
    const incidentTypes = new Set<string>();
    const yearsSet = new Set<number>();
    
    paidAcquisitions.forEach((acq) => {
      if (!acq.pagamento_aquisicao || !acq.preco_pago) return;
      
      const date = new Date(acq.pagamento_aquisicao);
      const year = date.getFullYear();
      yearsSet.add(year);
      
      // Filtrar por ano se selecionado
      if (selectedValoresYear !== 'all' && year !== parseInt(selectedValoresYear)) return;
      
      const periodKey = valuesTimeView === 'monthly'
        ? `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`
        : date.getFullYear().toString();
      
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, new Map<string, number>());
      }
      
      const periodData = periodMap.get(periodKey)!;
      const current = periodData.get(acq.incidente) || 0;
      periodData.set(acq.incidente, current + Number(acq.preco_pago));
      incidentTypes.add(acq.incidente);
    });

    // Converter para array e ordenar
    const data = Array.from(periodMap.entries())
      .map(([name, incidents]) => {
        const entry: Record<string, number | string> = { name, total: 0 };
        
        incidentTypes.forEach(incident => {
          const value = incidents.get(incident) || 0;
          entry[incident] = value;
          entry.total = (entry.total as number) + value;
        });
        
        return entry;
      })
      .sort((a, b) => {
        if (valuesTimeView === 'monthly') {
          const nameA = String(a.name);
          const nameB = String(b.name);
          const partsA = nameA.split('/');
          const partsB = nameB.split('/');
          
          if (partsA.length === 2 && partsB.length === 2) {
            const monthA = parseInt(partsA[0], 10);
            const yearA = parseInt('20' + partsA[1], 10);
            const monthB = parseInt(partsB[0], 10);
            const yearB = parseInt('20' + partsB[1], 10);
            
            if (yearA !== yearB) {
              return yearA - yearB;
            }
            return monthA - monthB;
          }
          
          return nameA.localeCompare(nameB);
        } else {
          const yearA = parseInt(String(a.name), 10);
          const yearB = parseInt(String(b.name), 10);
          return yearA - yearB;
        }
      });
    
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    
    const totalPago = data.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
    
    return { data, incidentTypes: Array.from(incidentTypes), availableYears, totalPago };
  }, [acquisitions, finishedAcquisitions, valuesTimeView, selectedValoresYear]);

  // Dados para o gráfico de RPV - Valor Pago + Lucro
  const rpvData = useMemo(() => {
    // Combinar acquisitions e finishedAcquisitions (já filtrados por cessionário)
    const allFilteredAcquisitions = [...(acquisitions || []), ...(finishedAcquisitions || [])];
    
    // Filtrar apenas incidentes RPV com pagamento_aquisicao
    const rpvAcquisitions = allFilteredAcquisitions.filter(acq => 
      acq && 
      acq.incidente?.toLowerCase() === 'rpv' && 
      acq.pagamento_aquisicao && 
      acq.preco_pago && 
      acq.valor_liquido &&
      acq.valor_incidente
    );
    
    if (rpvAcquisitions.length === 0) return { data: [], availableYears: [], totalValorIncidente: 0, cessionarioNome: null, count: 0 };

    const periodMap = new Map<string, { totalPrecoPago: number; totalValorLiquido: number }>();
    const yearsSet = new Set<number>();
    let totalValorIncidente = 0;
    const cessionarioNome = rpvAcquisitions[0]?.cessionario_nome || null;
    
    rpvAcquisitions.forEach((acq) => {
      if (!acq.pagamento_aquisicao || !acq.preco_pago || !acq.valor_liquido || !acq.valor_incidente) return;
      
      const date = new Date(acq.pagamento_aquisicao);
      const year = date.getFullYear();
      yearsSet.add(year);
      
      // Filtrar por ano se selecionado
      if (selectedRpvYear !== 'all' && year !== parseInt(selectedRpvYear)) return;
      
      const periodKey = rpvTimeView === 'monthly'
        ? `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`
        : date.getFullYear().toString();
      
      const current = periodMap.get(periodKey) || { totalPrecoPago: 0, totalValorLiquido: 0 };
      current.totalPrecoPago += Number(acq.preco_pago);
      current.totalValorLiquido += Number(acq.valor_liquido);
      periodMap.set(periodKey, current);
      
      // Acumular total de valor_incidente para calcular honorários
      totalValorIncidente += Number(acq.valor_incidente);
    });

    // Converter para array e ordenar
    const data = Array.from(periodMap.entries())
      .map(([name, totals]) => {
        let value: number;
        if (rpvView === 'valor') {
          // Valor Pago + Lucro = valor_liquido (que é (Valor líquido - Preço Pago) + Preço Pago)
          value = totals.totalValorLiquido;
        } else {
          // % do Incidente = (total preco_pago / total valor_liquido) * 100
          value = totals.totalValorLiquido > 0 
            ? (totals.totalPrecoPago / totals.totalValorLiquido) * 100 
            : 0;
        }
        return { name, value };
      })
      .sort((a, b) => {
        if (rpvTimeView === 'monthly') {
          const nameA = String(a.name);
          const nameB = String(b.name);
          const partsA = nameA.split('/');
          const partsB = nameB.split('/');
          
          if (partsA.length === 2 && partsB.length === 2) {
            const monthA = parseInt(partsA[0], 10);
            const yearA = parseInt('20' + partsA[1], 10);
            const monthB = parseInt(partsB[0], 10);
            const yearB = parseInt('20' + partsB[1], 10);
            
            if (yearA !== yearB) {
              return yearA - yearB;
            }
            return monthA - monthB;
          }
          
          return nameA.localeCompare(nameB);
        } else {
          const yearA = parseInt(String(a.name), 10);
          const yearB = parseInt(String(b.name), 10);
          return yearA - yearB;
        }
      });
    
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    
    return { data, availableYears, totalValorIncidente, cessionarioNome, count: rpvAcquisitions.length };
  }, [acquisitions, finishedAcquisitions, rpvTimeView, rpvView, selectedRpvYear]);

  type PrecatorioResumoDataResult = {
    data: Array<{ name: string; value: number }>;
    availableYears: number[];
    totalPrecoPago: number;
    totalValorLiquido: number;
    totalValorIncidente: number;
    count: number;
    groupLabel: string;
    cessionarioNome: string | null;
  };

  const precatorioResumoData: PrecatorioResumoDataResult = useMemo(() => {
    const combined = [...(acquisitions || []), ...(finishedAcquisitions || [])];

    const allowedGroups = selectedPrecatorioResumoGroup === 'all'
      ? ALL_PRECATORIO_GROUP_NAMES
      : (PRECATORIO_RESUMO_GROUP_OPTIONS.find((option) => option.value === selectedPrecatorioResumoGroup)?.groupNames || []);

    const allowedNormalized = new Set(allowedGroups.map((group) => normalizeGroupName(group)));

    const filtered = combined.filter((acq) => {
      if (!acq) return false;

      const groupName = normalizeGroupName(acq.grupo);
      if (!allowedNormalized.has(groupName)) return false;

      if (!acq.incidente || !acq.incidente.toLowerCase().includes('precatorio')) return false;

      const paymentDate = acq.pagamento_aquisicao || acq.data_pagamento;
      if (!paymentDate) return false;

      const valorLiquido = Number(acq.valor_liquido || 0);
      const precoPago = Number(acq.preco_pago || 0);
      if (valorLiquido <= 0 && precoPago <= 0) return false;

      const date = new Date(paymentDate);
      if (isNaN(date.getTime())) return false;

      if (selectedPrecatorioResumoYear !== 'all' && date.getFullYear() !== parseInt(selectedPrecatorioResumoYear, 10)) {
        return false;
      }

      return true;
    });

    const yearsSet = new Set<number>();
    const periodMap = new Map<string, { totalPrecoPago: number; totalValorLiquido: number }>();
    let totalPrecoPago = 0;
    let totalValorLiquido = 0;
    let totalValorIncidente = 0;

    filtered.forEach((acq) => {
      const paymentDate = acq.pagamento_aquisicao || acq.data_pagamento;
      if (!paymentDate) return;

      const date = new Date(paymentDate);
      if (isNaN(date.getTime())) return;

      yearsSet.add(date.getFullYear());

      const periodKey = precatorioResumoTimeView === 'monthly'
        ? `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`
        : date.getFullYear().toString();

      const current = periodMap.get(periodKey) || { totalPrecoPago: 0, totalValorLiquido: 0 };
      current.totalPrecoPago += Number(acq.preco_pago || 0);
      current.totalValorLiquido += Number(acq.valor_liquido || 0);
      periodMap.set(periodKey, current);

      totalPrecoPago += Number(acq.preco_pago || 0);
      totalValorLiquido += Number(acq.valor_liquido || 0);
      totalValorIncidente += Number(acq.valor_incidente || 0);
    });

    const data = Array.from(periodMap.entries())
      .map(([name, totals]) => {
        const value = precatorioResumoView === 'valor'
          ? totals.totalValorLiquido
          : totals.totalValorLiquido > 0
            ? (totals.totalPrecoPago / totals.totalValorLiquido) * 100
            : 0;
        return { name, value };
      })
      .sort((a, b) => {
        if (precatorioResumoTimeView === 'monthly') {
          const partsA = a.name.split('/');
          const partsB = b.name.split('/');
          if (partsA.length === 2 && partsB.length === 2) {
            const monthA = parseInt(partsA[0], 10);
            const yearA = parseInt(`20${partsA[1]}`, 10);
            const monthB = parseInt(partsB[0], 10);
            const yearB = parseInt(`20${partsB[1]}`, 10);
            if (yearA !== yearB) return yearA - yearB;
            return monthA - monthB;
          }
        } else {
          const yearA = parseInt(a.name, 10);
          const yearB = parseInt(b.name, 10);
          if (!isNaN(yearA) && !isNaN(yearB)) {
            return yearA - yearB;
          }
        }
        return a.name.localeCompare(b.name);
      });

    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    const groupLabel = selectedPrecatorioResumoGroup === 'all'
      ? 'Todos os grupos'
      : PRECATORIO_RESUMO_GROUP_OPTIONS.find((option) => option.value === selectedPrecatorioResumoGroup)?.label || 'Grupo selecionado';

    return {
      data,
      availableYears,
      totalPrecoPago,
      totalValorLiquido,
      totalValorIncidente,
      count: filtered.length,
      groupLabel,
      cessionarioNome: filtered[0]?.cessionario_nome || null,
    };
  }, [
    acquisitions,
    finishedAcquisitions,
    precatorioResumoTimeView,
    precatorioResumoView,
    selectedPrecatorioResumoYear,
    selectedPrecatorioResumoGroup,
  ]);

  // Dados para o gráfico de Valores Recebidos Geral
  const valoresRecebidosData = useMemo(() => {
    // Usar apenas finishedAcquisitions (já filtrados por cessionário)
    const finalizadas = (finishedAcquisitions || []).filter(acq => 
      acq && 
      acq.data_pagamento && 
      acq.preco_pago && 
      acq.valor_liquido &&
      acq.incidente
    );
    
    if (finalizadas.length === 0) return { data: [], availableYears: [], count: 0 };

    const periodMap = new Map<string, { 
      porIncidente: Map<string, number>;
      totalPrecoPago: number;
      totalLucro: number;
    }>();
    const yearsSet = new Set<number>();
    
    finalizadas.forEach((acq) => {
      if (!acq.data_pagamento || !acq.preco_pago || !acq.valor_liquido || !acq.incidente) return;
      
      const date = new Date(acq.data_pagamento);
      const year = date.getFullYear();
      yearsSet.add(year);
      
      // Filtrar por ano se selecionado
      if (selectedValoresRecebidosYear !== 'all' && year !== parseInt(selectedValoresRecebidosYear)) return;
      
      const periodKey = valoresRecebidosTimeView === 'monthly'
        ? `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`
        : date.getFullYear().toString();
      
      const current = periodMap.get(periodKey) || { 
        porIncidente: new Map<string, number>(),
        totalPrecoPago: 0,
        totalLucro: 0
      };
      
      // Lucro = valor_liquido - preco_pago
      const lucro = Number(acq.valor_liquido) - Number(acq.preco_pago);
      const valorTotal = Number(acq.valor_liquido); // Preço Pago + Lucro
      
      // Agrupar por tipo de incidente
      const incidenteKey = acq.incidente.toLowerCase();
      const currentIncidente = current.porIncidente.get(incidenteKey) || 0;
      current.porIncidente.set(incidenteKey, currentIncidente + valorTotal);
      
      current.totalPrecoPago += Number(acq.preco_pago);
      current.totalLucro += lucro;
      periodMap.set(periodKey, current);
    });

    // Converter para array e ordenar
    const data = Array.from(periodMap.entries())
      .map(([name, totals]) => {
        const incidentes = Array.from(totals.porIncidente.entries()).map(([incidente, valor]) => ({
          incidente,
          valor
        }));
        
        return { 
          name, 
          incidentes,
          totalPrecoPago: totals.totalPrecoPago,
          totalLucro: totals.totalLucro,
          total: totals.totalPrecoPago + totals.totalLucro
        };
      })
      .sort((a, b) => {
        if (valoresRecebidosTimeView === 'monthly') {
          const nameA = String(a.name);
          const nameB = String(b.name);
          const partsA = nameA.split('/');
          const partsB = nameB.split('/');
          
          if (partsA.length === 2 && partsB.length === 2) {
            const monthA = parseInt(partsA[0], 10);
            const yearA = parseInt('20' + partsA[1], 10);
            const monthB = parseInt(partsB[0], 10);
            const yearB = parseInt('20' + partsB[1], 10);
            
            if (yearA !== yearB) {
              return yearA - yearB;
            }
            return monthA - monthB;
          }
          
          return nameA.localeCompare(nameB);
        } else {
          const yearA = parseInt(String(a.name), 10);
          const yearB = parseInt(String(b.name), 10);
          return yearA - yearB;
        }
      });
    
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    
    return { data, availableYears, count: finalizadas.length };
  }, [finishedAcquisitions, valoresRecebidosTimeView, selectedValoresRecebidosYear]);

  // Função para calcular próxima atualização (primeiro dia do próximo mês)
  const getNextUpdateDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  };

  const getDaysUntilUpdate = () => {
    const nextUpdate = getNextUpdateDate();
    const now = new Date();
    const diffTime = nextUpdate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Função para obter a data de referência do snapshot (mês/ano formatado)
  const getSnapshotDate = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${month}/${year}`;
  };

  // Dados para o gráfico de Valores Pendentes (congelados até primeiro dia do próximo mês)
  const valoresPendentesData = useMemo(() => {
    // Função para obter chave de armazenamento baseada no mês atual e cessionário
    const now = new Date();
    // Obter o nome do cessionário das aquisições (ou 'all' se for admin)
    const cessionarioNome = acquisitions[0]?.cessionario_nome || 'all';
    const storageKey = `valoresPendentes_${now.getFullYear()}_${now.getMonth()}_${cessionarioNome}`;
    const stored = localStorage.getItem(storageKey);
    
    // Se já existe dados armazenados para este mês, usar eles
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Garantir que tem snapshotDate (para dados antigos que não tinham)
        if (!parsed.snapshotDate) {
          parsed.snapshotDate = getSnapshotDate();
        }
        // Atualizar o name no array data para usar o snapshotDate correto
        if (parsed.data && parsed.data.length > 0) {
          parsed.data[0].name = parsed.snapshotDate;
        }
        return parsed;
      } catch (e) {
        // Se der erro ao parsear, continuar e recalcular
      }
    }

    // Se não existe, calcular e armazenar
    // Pegar apenas aquisições que NÃO são finalizadas (todos os grupos exceto "Aquisições Finalizadas")
    // Já filtradas por cessionário (acquisitions já vem filtrado)
    const pendentes = (acquisitions || []).filter(acq => 
      acq && 
      acq.preco_pago && 
      acq.valor_liquido &&
      acq.incidente
    );
    
    if (pendentes.length === 0) {
      const emptyData = { 
        data: [], 
        count: 0,
        incidentes: []
      };
      localStorage.setItem(storageKey, JSON.stringify(emptyData));
      return emptyData;
    }

    const incidentMap = new Map<string, { valor: number; quantidade: number }>();
    
    pendentes.forEach((acq) => {
      if (!acq.preco_pago || !acq.valor_liquido || !acq.incidente) return;
      
      // Valor = valor_liquido (preco_pago + lucro)
      const valor = Number(acq.valor_liquido);
      const incidenteKey = acq.incidente.toLowerCase();
      
      const current = incidentMap.get(incidenteKey) || { valor: 0, quantidade: 0 };
      current.valor += valor;
      current.quantidade += 1;
      incidentMap.set(incidenteKey, current);
    });

    // Converter para array
    const incidentes = Array.from(incidentMap.entries()).map(([incidente, dados]) => ({
      incidente,
      valor: dados.valor,
      quantidade: dados.quantidade
    }));

    const total = incidentes.reduce((sum, inc) => sum + inc.valor, 0);
    const totalQuantidade = incidentes.reduce((sum, inc) => sum + inc.quantidade, 0);
    const snapshotDate = getSnapshotDate();

    const data = [
      {
        name: snapshotDate,
        ...incidentes.reduce((acc, inc) => {
          acc[inc.incidente] = inc.valor;
          return acc;
        }, {} as Record<string, number>),
        total: total
      }
    ];

    const result = {
      data,
      incidentes,
      count: totalQuantidade,
      snapshotDate: getSnapshotDate()
    };

    // Armazenar no localStorage
    localStorage.setItem(storageKey, JSON.stringify(result));

    return result;
  }, [acquisitions]);

  // Dados para o gráfico de RPVs Pendentes de Recebimento
  const rpvPendentesData = useMemo(() => {
    // Usar apenas aquisições que NÃO são finalizadas e são RPV
    // Já filtradas por cessionário (acquisitions já vem filtrado)
    const rpvPendentes = (acquisitions || []).filter(acq => 
      acq && 
      acq.incidente?.toLowerCase() === 'rpv' &&
      acq.pagamento_aquisicao
    );
    
    if (rpvPendentes.length === 0) {
      return {
        acumulado: [],
        etapas: [],
        count: 0
      };
    }

    // Dados para o modo acumulado (por data de Pagamento Aquisição)
    const acumuladoMap = new Map<string, number>();
    
    // Dados para o modo etapas (por Fase do Processo)
    const etapasMap = new Map<string, number>();
    
    rpvPendentes.forEach((acq) => {
      if (!acq.pagamento_aquisicao) return;
      
      // Acumulado: agrupar por mês/ano baseado em pagamento_aquisicao
      const date = new Date(acq.pagamento_aquisicao);
      const periodKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
      const currentAcumulado = acumuladoMap.get(periodKey) || 0;
      acumuladoMap.set(periodKey, currentAcumulado + 1);
      
      // Etapas: agrupar por fase_processo
      const fase = acq.fase_processo || 'Sem Fase';
      const currentEtapa = etapasMap.get(fase) || 0;
      etapasMap.set(fase, currentEtapa + 1);
    });

    // Converter acumulado para array e ordenar
    const acumulado = Array.from(acumuladoMap.entries())
      .map(([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => {
        const partsA = a.name.split('/');
        const partsB = b.name.split('/');
        
        if (partsA.length === 2 && partsB.length === 2) {
          const monthA = parseInt(partsA[0], 10);
          const yearA = parseInt('20' + partsA[1], 10);
          const monthB = parseInt(partsB[0], 10);
          const yearB = parseInt('20' + partsB[1], 10);
          
          if (yearA !== yearB) {
            return yearA - yearB;
          }
          return monthA - monthB;
        }
        
        return a.name.localeCompare(b.name);
      });

    // Converter etapas para array e ordenar por números na fase (extrair números e ordenar numericamente)
    const etapas = Array.from(etapasMap.entries())
      .map(([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => {
        // Extrair números da fase (ex: "Fase 1" -> 1, "Fase 2" -> 2, "Etapa 10" -> 10)
        const extractNumber = (str: string): number => {
          const match = str.match(/\d+/);
          return match ? parseInt(match[0], 10) : Infinity; // Se não tiver número, coloca no final
        };
        
        const numA = extractNumber(a.name);
        const numB = extractNumber(b.name);
        
        // Se ambos têm números, ordenar numericamente
        if (numA !== Infinity && numB !== Infinity) {
          return numA - numB;
        }
        
        // Se só um tem número, o com número vem primeiro
        if (numA !== Infinity) return -1;
        if (numB !== Infinity) return 1;
        
        // Se nenhum tem número, ordenar alfabeticamente
        return a.name.localeCompare(b.name);
      });

    return {
      acumulado,
      etapas,
      count: rpvPendentes.length,
    };
  }, [acquisitions]);

  const rpvPendentesAvailableYears = useMemo(() => {
    const years = new Set<number>();
    rpvPendentesData.acumulado.forEach(({ name }) => {
      const parts = name.split('/');
      const year = parts.length === 2 ? Number(`20${parts[1]}`) : Number(name);
      if (!Number.isNaN(year)) {
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [rpvPendentesData.acumulado]);

  const rpvPendentesAcumuladoData = useMemo(() => {
    const baseData = rpvPendentesData.acumulado;
    if (rpvPendentesTimeView === 'annual') {
      const yearMap = new Map<string, number>();
      baseData.forEach(({ name, quantidade }) => {
        const parts = name.split('/');
        const year = parts.length === 2 ? `20${parts[1]}` : name;
        yearMap.set(year, (yearMap.get(year) || 0) + quantidade);
      });
      return Array.from(yearMap.entries())
        .map(([year, quantidade]) => ({ name: year, quantidade }))
        .sort((a, b) => Number(a.name) - Number(b.name));
    }

    if (selectedRpvPendentesYear === 'all') {
      return baseData;
    }

    return baseData.filter(({ name }) => {
      const parts = name.split('/');
      const year = parts.length === 2 ? `20${parts[1]}` : name;
      return year === selectedRpvPendentesYear;
    });
  }, [rpvPendentesData.acumulado, rpvPendentesTimeView, selectedRpvPendentesYear]);

  // Gerar 10 cores dinâmicas para os tipos de incidente
  const generateColors = (count: number) => {
    const colors = [
      "hsl(200, 90%, 40%)",   // Azul
      "hsl(180, 85%, 45%)",   // Ciano/Turquesa (substitui azul claro)
      "hsl(142, 76%, 36%)",   // Verde
      "hsl(280, 70%, 45%)",   // Roxo
      "hsl(0, 70%, 50%)",     // Vermelho
      "hsl(30, 90%, 55%)",    // Laranja
      "hsl(60, 80%, 50%)",    // Amarelo
      "hsl(150, 70%, 45%)",   // Verde água
      "hsl(240, 80%, 60%)",   // Azul escuro
      "hsl(320, 70%, 55%)",   // Rosa
    ];
    
    // Se precisar de mais cores, gerar dinamicamente
    const additionalColors: string[] = [];
    for (let i = 10; i < count; i++) {
      const hue = (i * 137.508) % 360; // Golden angle para distribuição uniforme
      additionalColors.push(`hsl(${hue}, 70%, 50%)`);
    }
    
    return [...colors, ...additionalColors];
  };

  // Mapear cores para cada tipo de incidente (usar o maior conjunto de tipos)
  const allIncidentTypes = useMemo(() => {
    const allTypes = new Set<string>();
    contractsData.incidentTypes.forEach(type => allTypes.add(type));
    valuesData.incidentTypes.forEach(type => allTypes.add(type));
    return Array.from(allTypes);
  }, [contractsData.incidentTypes, valuesData.incidentTypes]);

  const incidentColorsMap = useMemo(() => {
    const colors = generateColors(allIncidentTypes.length);
    const map: Record<string, string> = {};
    allIncidentTypes.forEach((incident, index) => {
      map[incident] = colors[index % colors.length];
    });
    return map;
  }, [allIncidentTypes]);

  const precatorioPendentesData = useMemo(
    () => computePendentesData(
      'aquisições precatórios',
      acquisitions,
      allAcquisitions,
      precatorioPendentesTimeView,
      selectedPrecatorioPendentesYear,
      undefined,
      'equals'
    ),
    [
      acquisitions,
      allAcquisitions,
      precatorioPendentesTimeView,
      selectedPrecatorioPendentesYear,
    ]
  );

  const precatorioAcordoPendentesData = useMemo(
    () => computePendentesData(
      'aquisições precatórios (acordo)',
      acquisitions,
      allAcquisitions,
      precatorioAcordoPendentesTimeView,
      selectedPrecatorioAcordoPendentesYear
    ),
    [
      acquisitions,
      allAcquisitions,
      precatorioAcordoPendentesTimeView,
      selectedPrecatorioAcordoPendentesYear,
    ]
  );

  const precatorioPrioridadePendentesData = useMemo(
    () => computePendentesData(
      'aquisições precatórios prioridade',
      acquisitions,
      allAcquisitions,
      precatorioPrioridadePendentesTimeView,
      selectedPrecatorioPrioridadePendentesYear
    ),
    [
      acquisitions,
      allAcquisitions,
      precatorioPrioridadePendentesTimeView,
      selectedPrecatorioPrioridadePendentesYear,
    ]
  );

  const precatorioSjrpPendentesData = useMemo(
    () => computePendentesData(
      'aquisições precatórios sjrp',
      acquisitions,
      allAcquisitions,
      precatorioSjrpPendentesTimeView,
      selectedPrecatorioSjrpPendentesYear
    ),
    [
      acquisitions,
      allAcquisitions,
      precatorioSjrpPendentesTimeView,
      selectedPrecatorioSjrpPendentesYear,
    ]
  );

  useMonthlyViewYearSync(
    isMobile,
    timeView,
    selectedInvestimentosYear,
    setSelectedInvestimentosYear,
    investimentosData.availableYears
  );
  useMonthlyViewYearSync(
    isMobile,
    contractsTimeView,
    selectedContratosYear,
    setSelectedContratosYear,
    contractsData.availableYears
  );
  useMonthlyViewYearSync(isMobile, valuesTimeView, selectedValoresYear, setSelectedValoresYear, valuesData.availableYears);
  useMonthlyViewYearSync(isMobile, rpvTimeView, selectedRpvYear, setSelectedRpvYear, rpvData.availableYears);
  useMonthlyViewYearSync(
    isMobile,
    rpvPendentesTimeView,
    selectedRpvPendentesYear,
    setSelectedRpvPendentesYear,
    rpvPendentesAvailableYears
  );
  useMonthlyViewYearSync(
    isMobile,
    valoresRecebidosTimeView,
    selectedValoresRecebidosYear,
    setSelectedValoresRecebidosYear,
    valoresRecebidosData.availableYears
  );
  useMonthlyViewYearSync(
    isMobile,
    precatorioPendentesTimeView,
    selectedPrecatorioPendentesYear,
    setSelectedPrecatorioPendentesYear,
    precatorioPendentesData.availableYears
  );
  useMonthlyViewYearSync(
    isMobile,
    precatorioAcordoPendentesTimeView,
    selectedPrecatorioAcordoPendentesYear,
    setSelectedPrecatorioAcordoPendentesYear,
    precatorioAcordoPendentesData.availableYears
  );
  useMonthlyViewYearSync(
    isMobile,
    precatorioPrioridadePendentesTimeView,
    selectedPrecatorioPrioridadePendentesYear,
    setSelectedPrecatorioPrioridadePendentesYear,
    precatorioPrioridadePendentesData.availableYears
  );
  useMonthlyViewYearSync(
    isMobile,
    precatorioSjrpPendentesTimeView,
    selectedPrecatorioSjrpPendentesYear,
    setSelectedPrecatorioSjrpPendentesYear,
    precatorioSjrpPendentesData.availableYears
  );
  useMonthlyViewYearSync(
    isMobile,
    precatorioResumoTimeView,
    selectedPrecatorioResumoYear,
    setSelectedPrecatorioResumoYear,
    precatorioResumoData.availableYears
  );

  const formatWord = (word: string) => {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  };

  const formatPhaseSegment = (segment: string): string[] => {
    const trimmed = segment.trim();
    if (!trimmed) return [];

    const lines: string[] = [];
    const numberMatch = trimmed.match(/^[\d.,]+/);
    let rest = trimmed;

    if (numberMatch) {
      const numberPart = numberMatch[0];
      rest = trimmed.slice(numberPart.length).trim();
      let prefix = numberPart.trim();
      if (rest.startsWith('-')) {
        rest = rest.slice(1).trim();
        prefix = `${numberPart.trim()} -`;
      }

      rest = rest.replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const words = rest ? rest.split(' ') : [];

      if (prefix) {
        if (words.length) {
          const firstWord = words.shift()!;
          lines.push(`${prefix} ${formatWord(firstWord)}`.replace(/\s+/g, ' ').trim());
        } else {
          lines.push(prefix);
        }
      }

      let i = 0;
      while (i < words.length) {
        const word = words[i];
        if (word.toLowerCase() === 'de' && i < words.length - 1) {
          lines.push(`de ${formatWord(words[i + 1])}`);
          i += 2;
        } else {
          lines.push(formatWord(word));
          i += 1;
        }
      }

      return lines.length ? lines : [trimmed];
    }

    rest = rest.replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const words = rest ? rest.split(' ') : [];
    let i = 0;
    while (i < words.length) {
      const word = words[i];
      if (word.toLowerCase() === 'de' && i < words.length - 1) {
        lines.push(`de ${formatWord(words[i + 1])}`);
        i += 2;
      } else {
        lines.push(formatWord(word));
        i += 1;
      }
    }

    return lines.length ? lines : [trimmed];
  };

  const splitEtapaLabel = (value: string): string[] => {
    if (!value) return [];
    const parts = value.split('|').map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return [];
    return parts.flatMap((part) => formatPhaseSegment(part));
  };

  const renderPrecatorioAcordoEtapaTick = ({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
    const lines = splitEtapaLabel(payload?.value || '');
  return (
      <g transform={`translate(${x},${y})`}>
        {lines.map((line, index) => (
          <text
            key={`${line}-${index}`}
            x={0}
            y={index * 14}
            dy={12}
            textAnchor="middle"
            fontSize={12}
            fill="#475467"
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  const renderPendentesCard = ({
    title,
    view,
    onViewChange,
    timeView,
    onTimeViewChange,
    selectedYear,
    onYearChange,
    data,
    emptyMessage,
    isMobile,
  }: {
    title: string;
    view: 'mapa' | 'etapa';
    onViewChange: (value: 'mapa' | 'etapa') => void;
    timeView: 'monthly' | 'annual';
    onTimeViewChange: (value: 'monthly' | 'annual') => void;
    selectedYear: string;
    onYearChange: (value: string) => void;
    data: PendentesData;
    emptyMessage: string;
    isMobile: boolean;
  }) => (
    <Card className="shadow-card mt-6">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">
              {title}
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Tabs value={timeView} onValueChange={(value) => onTimeViewChange(value as 'monthly' | 'annual')}>
                  <TabsList className="flex w-full sm:w-auto flex-row-reverse sm:flex-row text-[14px] md:text-base">
                    <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="monthly">Mensal</TabsTrigger>
                    <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="annual">Anual</TabsTrigger>
                  </TabsList>
                </Tabs>
                {(!isMobile || timeView === 'monthly') && data.availableYears.length > 0 && (
                  <Select value={selectedYear} onValueChange={onYearChange}>
                    <SelectTrigger className="w-[110px] sm:w-[120px] text-[14px] md:text-base">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {(!isMobile || timeView !== 'monthly') && <SelectItem value="all">Todos</SelectItem>}
                      {data.availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
          <Tabs value={view} onValueChange={(value) => onViewChange(value as 'mapa' | 'etapa')}>
            <TabsList className="flex w-full sm:w-auto text-[14px] md:text-base">
              <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="mapa">
                Mapa Orçamentário
              </TabsTrigger>
              <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="etapa">
                Etapa
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className={`w-full ${isMobile ? 'px-1 pt-0 pb-1' : ''}`}>
        <div
          className="w-full"
          style={{ minHeight: isMobile ? `${mobileChartMinHeight}px` : '450px' }}
        >
          <ResponsiveContainer
            width="100%"
            height={isMobile ? Math.max(450, mobileChartMinHeight) : 450}
          >
            {data.totalBase === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-500 px-6 text-center">
                {emptyMessage}
              </div>
            ) : view === 'mapa' ? (
              data.mapaData.length > 0 && data.mapaEntries.length > 0 ? (
                (() => {
                  const colors = generateColors(data.mapaEntries.length);
                  return (
                    <BarChart
                      data={data.mapaData}
                      margin={
                        isMobile
                          ? { top: 20, right: 12, left: 12, bottom: 40 }
                          : { top: 20, right: 80, left: 100, bottom: timeView === 'monthly' ? 80 : 60 }
                      }
                      barCategoryGap="25%"
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="name"
                        angle={timeView === 'monthly' ? -45 : 0}
                        textAnchor={timeView === 'monthly' ? 'end' : 'middle'}
                        height={timeView === 'monthly' ? 80 : 50}
                        interval={0}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        formatter={(value: number | string, key: string) => {
                          const mapa = data.mapaEntries.find((entry) => entry.key === key)?.label || key;
                          return [value, mapa];
                        }}
                        labelFormatter={(label) =>
                          timeView === 'monthly' ? `Período: ${label}` : `Ano: ${label}`
                        }
                      />
                      <Legend
                        formatter={(value) => {
                          const mapa = data.mapaEntries.find((entry) => entry.key === value);
                          return mapa ? mapa.label : value;
                        }}
                      />
                      {data.mapaEntries.map(({ key, label }, index) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          fill={colors[index % colors.length]}
                          name={label}
                          barSize={32}
                        >
                          <LabelList
                            dataKey={key}
                            position="top"
                            fill="#333"
                            fontSize={12}
                            fontWeight="bold"
                            offset={10}
                            formatter={(value: number) => (value === 0 ? '' : value.toString())}
                          />
                        </Bar>
                      ))}
                    </BarChart>
                  );
                })()
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-500 px-6 text-center">
                  Nenhum dado encontrado para o filtro selecionado.
                </div>
              )
            ) : data.etapaData.length > 0 ? (
              <BarChart
                data={data.etapaData}
                margin={
                  isMobile
                    ? { top: 20, right: 12, left: 12, bottom: 60 }
                    : { top: 20, right: 80, left: 100, bottom: 100 }
                }
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  height={100}
                  tick={renderPendentesEtapaTick}
                />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: number) => [`${value}`, 'Quantidade']} />
                <Bar dataKey="quantidade" fill="#ff7300" radius={[0, 0, 0, 0]}>
                  <LabelList
                    dataKey="quantidade"
                    position="top"
                    fill="#333"
                    fontSize={12}
                    fontWeight="bold"
                    offset={10}
                  />
                </Bar>
              </BarChart>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-500 px-6 text-center">
                Nenhuma etapa encontrada para o filtro selecionado.
              </div>
            )}
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-sm">
          <span className="font-semibold">Total: </span>
          <span className="text-orange-600 font-bold">{data.count}</span>
          {selectedYear !== 'all' && (
            <span className="text-gray-600 ml-1">
              / {data.totalBase} no grupo
            </span>
          )}
          {data.totalBase === 0 && (
            <span className="block text-xs text-gray-500">
              {emptyMessage}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderPendentesEtapaTick = renderPrecatorioAcordoEtapaTick;

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">
                Investimentos e Lucros
              </CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
              <Tabs value={timeView} onValueChange={(value) => setTimeView(value as 'monthly' | 'annual')}>
                    <TabsList className="flex w-full sm:w-auto flex-row-reverse sm:flex-row text-[14px] md:text-base">
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="monthly">
                        Mensal
                      </TabsTrigger>
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="annual">
                        Anual
                      </TabsTrigger>
                </TabsList>
              </Tabs>
                  {(!isMobile || timeView === 'monthly') && (
                  <Select value={selectedInvestimentosYear} onValueChange={setSelectedInvestimentosYear}>
                    <SelectTrigger className="w-[110px] sm:w-[120px] text-[14px] md:text-base">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {(!isMobile || timeView !== 'monthly') && <SelectItem value="all">Todos</SelectItem>}
                      {investimentosData.availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  )}
                </div>
              </div>
            </div>
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ativas' | 'finalizadas')}>
                <TabsList className="flex w-full sm:w-auto text-[14px] md:text-base">
                  <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="ativas">Ativos</TabsTrigger>
                  <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="finalizadas">Finalizados</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={investimentosData.data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) =>
                  isMobile
                    ? formatMobileCurrencyTick(value as number)
                    : new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(value as number)
                }
              />
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
        <div
          className={`mt-4 flex ${isMobile ? 'flex-col gap-1 text-xs' : 'justify-between items-center text-sm'}`}
        >
          <span>
            <span className="font-semibold">Investido total: </span>
            <span className="text-orange-600 font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }).format(investimentosData.totals.totalInvestido)}
            </span>
          </span>
          <span>
            <span className="font-semibold">Lucro total: </span>
            <span className="text-emerald-600 font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }).format(investimentosData.totals.totalLucro)}
            </span>
          </span>
        </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
            <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">Distribuição por Tipo de Incidente</CardTitle>
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
        <div className={`mt-4 text-center ${isMobile ? 'text-xs' : 'text-sm'}`}>
          <span className="font-semibold">Total de incidentes: </span>
          <span className="text-orange-600 font-bold">{incidentTotalCount}</span>
        </div>
        </CardContent>
      </Card>
    </div>

      <div className="flex justify-center mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExtraChartsExpanded((prev) => !prev)}
          className="px-3 py-1 text-sm"
        >
          {extraChartsExpanded ? 'Ocultar gráficos' : 'Mostrar mais gráficos'}
        </Button>
      </div>

      {extraChartsExpanded && (
      <>
      {/* Gráfico de Contratos Fechados */}
      <Card className="shadow-card mt-6">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">
                {contractsView === 'volume'
                  ? 'Contratos Fechados - Aquisições'
                  : 'Aquisições por Tipo'}
              </CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Tabs value={contractsTimeView} onValueChange={(value) => setContractsTimeView(value as 'monthly' | 'annual')}>
                    <TabsList className="flex w-full sm:w-auto flex-row-reverse sm:flex-row text-[14px] md:text-base">
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="monthly">
                        Mensal
                      </TabsTrigger>
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="annual">
                        Anual
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {(!isMobile || contractsTimeView === 'monthly') && (
                  <Select value={selectedContratosYear} onValueChange={setSelectedContratosYear}>
                    <SelectTrigger className="w-[110px] sm:w-[120px] text-[14px] md:text-base">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {(!isMobile || contractsTimeView !== 'monthly') && <SelectItem value="all">Todos</SelectItem>}
                      {contractsData.availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  )}
                </div>
              </div>
            </div>
            <Tabs value={contractsView} onValueChange={(value) => setContractsView(value as 'volume' | 'tipo')}>
              <TabsList className="flex w-full sm:w-auto text-[14px] md:text-base">
                <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="volume">Volume</TabsTrigger>
                <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="tipo">Tipo</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className={`w-full ${isMobile ? 'px-1 pt-0 pb-1' : ''}`}>
          <ResponsiveContainer
            width="100%"
            height={
              isMobile
                ? Math.max(contractsView === 'tipo' ? 500 : 450, mobileChartMinHeight)
                : contractsView === 'tipo' ? 500 : 450
            }
          >
            {contractsView === 'volume' ? (
              <ComposedChart
                data={contractsData.data}
                margin={
                  isMobile
                    ? { top: 20, right: 12, left: 12, bottom: 40 }
                    : { top: 60, right: 30, left: 20, bottom: 80 }
                }
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  tickFormatter={(value) =>
                    isMobile ? formatMobileCurrencyTick(value as number) : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value as number)
                  }
                />
                <Tooltip />
                <Legend />
                {contractsData.incidentTypes.map((incident) => {
                  const color = incidentColorsMap[incident] || "hsl(0, 0%, 50%)";
                  return (
                    <Bar 
                      key={incident}
                      dataKey={incident} 
                      stackId="a"
                      fill={color}
                      name={incident.replace(/_/g, ' ').toUpperCase()}
                    >
                      <LabelList 
                        dataKey={incident} 
                        position="inside" 
                        fill="#fff" 
                        fontSize={11}
                        formatter={(value: number) => value > 0 ? value.toString() : ''}
                      />
                    </Bar>
                  );
                })}
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#ff7300" 
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#ff7300', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7 }}
                  name="Total"
                >
                  <LabelList 
                    dataKey="total" 
                    position="top" 
                    fill="#ff7300" 
                    fontSize={12}
                    fontWeight="bold"
                    offset={20}
                    formatter={(value: number) => value > 0 ? value.toString() : ''}
                  />
                </Line>
              </ComposedChart>
            ) : (
              <LineChart
                data={contractsData.data}
                margin={
                  isMobile
                    ? { top: 20, right: 12, left: 12, bottom: 40 }
                    : { top: 80, right: 30, left: 20, bottom: 80 }
                }
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 12 }}
                  domain={contractsTimeView === 'annual' ? ['dataMin - 0.5', 'dataMax + 0.5'] : undefined}
                  padding={contractsTimeView === 'annual' ? { left: 20, right: 20 } : undefined}
                />
                <YAxis domain={['auto', (dataMax: number) => dataMax * 1.5]} />
                <Tooltip />
                <Legend />
                {contractsData.incidentTypes.map((incident) => {
                  const color = incidentColorsMap[incident] || "hsl(0, 0%, 50%)";
                  return (
                    <Line
                      key={incident}
                      type="monotone"
                      dataKey={incident}
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7 }}
                      name={incident.replace(/_/g, ' ').toUpperCase()}
                    >
                      <LabelList 
                        dataKey={incident} 
                        position="top" 
                        fill={color} 
                        fontSize={11}
                        offset={15}
                        formatter={(value: number) => value > 0 ? value.toString() : ''}
                      />
                    </Line>
                  );
                })}
              </LineChart>
            )}
          </ResponsiveContainer>
          <div
            className={`mt-4 flex ${isMobile ? 'flex-col gap-1 text-xs' : 'justify-between items-center text-sm'}`}
          >
            <span>
              <span className="font-semibold">Total de aquisições: </span>
              <span className="text-orange-600 font-bold">
                {new Intl.NumberFormat('pt-BR').format(contractsData.totalVolume)}
              </span>
            </span>
            <span>
              <span className="font-semibold">Períodos exibidos: </span>
              <span className="text-slate-700 font-bold">
                {new Intl.NumberFormat('pt-BR').format(contractsData.data.length)}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Valores Pagos */}
      <Card className="shadow-card mt-6">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">
                {valuesView === 'valores' 
                  ? 'Valores Pagos' 
                  : 'Valores Pagos por Tipo'}
              </CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Tabs value={valuesTimeView} onValueChange={(value) => setValuesTimeView(value as 'monthly' | 'annual')}>
                    <TabsList className="flex w-full sm:w-auto flex-row-reverse sm:flex-row text-[14px] md:text-base">
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="monthly">Mensal</TabsTrigger>
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="annual">Anual</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {(!isMobile || valuesTimeView === 'monthly') && (
                  <Select value={selectedValoresYear} onValueChange={setSelectedValoresYear}>
                    <SelectTrigger className="w-[110px] sm:w-[120px] text-[14px] md:text-base">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {(!isMobile || valuesTimeView !== 'monthly') && <SelectItem value="all">Todos</SelectItem>}
                      {valuesData.availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  )}
                </div>
              </div>
            </div>
            <Tabs value={valuesView} onValueChange={(value) => setValuesView(value as 'valores' | 'tipo')}>
              <TabsList className="flex w-full sm:w-auto text-[14px] md:text-base">
                <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="valores">Valores Pagos</TabsTrigger>
                <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="tipo">Tipo</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className={`w-full ${isMobile ? 'px-1 pt-0 pb-1' : ''}`}>
          <div
            className="w-full"
            style={{
              minHeight: isMobile
                ? `${mobileChartMinHeight}px`
                : valuesView === 'tipo'
                ? '500px'
                : '450px',
            }}
          >
            <ResponsiveContainer
              width="100%"
              height={
                isMobile
                  ? Math.max(valuesView === 'tipo' ? 500 : 450, mobileChartMinHeight)
                  : valuesView === 'tipo'
                  ? 500
                  : 450
              }
            >
            {valuesView === 'valores' ? (
              <ComposedChart
                data={valuesData.data}
                margin={
                  isMobile
                    ? { top: 20, right: 12, left: 12, bottom: 40 }
                    : { top: 50, right: 30, left: 100, bottom: 80 }
                }
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  tickFormatter={(value) => {
                    if (isMobile) {
                      return formatMobileCurrencyTick(value as number);
                    }
                    return new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(value);
                  }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    const formattedValue = new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(value);
                    return [formattedValue, name];
                  }}
                  content={(props: { active?: boolean; payload?: Array<{ value?: number; name?: string; color?: string }>; label?: string }) => {
                    if (!props.active || !props.payload) return null;
                    const total = props.payload.reduce((sum: number, entry) => sum + (entry.value || 0), 0);
                    const formattedTotal = new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(total);
                    
                    return (
                      <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                        <p className="font-semibold mb-2">{props.label}</p>
                        {props.payload.map((entry, index: number) => (
                          <p key={index} style={{ color: entry.color }} className="text-sm">
                            {entry.name}: {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(entry.value || 0)}
                          </p>
                        ))}
                        <p className="font-bold mt-2 pt-2 border-t border-gray-200 text-orange-600">
                          Total: {formattedTotal}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend />
                {valuesData.incidentTypes.map((incident) => {
                  const color = incidentColorsMap[incident] || "hsl(0, 0%, 50%)";
                  return (
                    <Bar 
                      key={incident}
                      dataKey={incident} 
                      stackId="a"
                      fill={color}
                      name={incident.replace(/_/g, ' ').toUpperCase()}
                    />
                  );
                })}
              </ComposedChart>
            ) : (
              <BarChart
                data={valuesData.data}
                margin={
                  isMobile
                    ? { top: 20, right: 12, left: 12, bottom: 40 }
                    : { top: 20, right: 80, left: 100, bottom: 80 }
                }
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 12 }}
                  domain={valuesTimeView === 'annual' ? ['dataMin - 0.5', 'dataMax + 0.5'] : undefined}
                  padding={valuesTimeView === 'annual' ? { left: 20, right: 20 } : undefined}
                />
                <YAxis 
                  domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  tickFormatter={(value) => {
                    if (isMobile) {
                      return formatMobileCurrencyTick(value as number);
                    }
                    return new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(value);
                  }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    const formattedValue = new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(value);
                    return [formattedValue, name];
                  }}
                  content={(props: { active?: boolean; payload?: Array<{ value?: number; name?: string; color?: string }>; label?: string }) => {
                    if (!props.active || !props.payload) return null;
                    const total = props.payload.reduce((sum: number, entry) => sum + (entry.value || 0), 0);
                    const formattedTotal = new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(total);
                    
                    return (
                      <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                        <p className="font-semibold mb-2">{props.label}</p>
                        {props.payload.map((entry, index: number) => (
                          <p key={index} style={{ color: entry.color }} className="text-sm">
                            {entry.name}: {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(entry.value || 0)}
                          </p>
                        ))}
                        <p className="font-bold mt-2 pt-2 border-t border-gray-200 text-orange-600">
                          Total: {formattedTotal}
                        </p>
                      </div>
                    );
                  }}
                />
                {valuesData.incidentTypes.map((incident) => {
                  const color = incidentColorsMap[incident] || "hsl(0, 0%, 50%)";
                  return (
                    <Bar 
                      key={incident}
                      dataKey={incident} 
                      fill={color}
                      name={incident.replace(/_/g, ' ').toUpperCase()}
                      radius={[0, 0, 0, 0]}
                    />
                  );
                })}
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => value.replace(/_/g, ' ').toUpperCase()}
                />
              </BarChart>
            )}
            </ResponsiveContainer>
          </div>
          <div
            className={`mt-4 flex ${isMobile ? 'flex-col gap-1 text-xs' : 'justify-between items-center text-sm'}`}
          >
            <span>
              <span className="font-semibold">Total pago: </span>
              <span className="text-orange-600 font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }).format(valuesData.totalPago)}
              </span>
            </span>
            <span>
              <span className="font-semibold">Períodos exibidos: </span>
              <span className="text-slate-700 font-bold">{valuesData.data.length}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de RPV - Valor Pago + Lucro */}
      <Card className="shadow-card mt-6">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">
                {rpvView === 'valor' 
                  ? `RPV - Valor Pago + Lucro (${rpvData.count})` 
                  : `RPV - % do Incidente (${rpvData.count})`}
              </CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Tabs value={rpvTimeView} onValueChange={(value) => setRpvTimeView(value as 'monthly' | 'annual')}>
                    <TabsList className="flex w-full sm:w-auto flex-row-reverse sm:flex-row text-[14px] md:text-base">
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="monthly">Mensal</TabsTrigger>
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="annual">Anual</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {(!isMobile || rpvTimeView === 'monthly') && (
                  <Select value={selectedRpvYear} onValueChange={setSelectedRpvYear}>
                    <SelectTrigger className="w-[110px] sm:w-[120px] text-[14px] md:text-base">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {(!isMobile || rpvTimeView !== 'monthly') && <SelectItem value="all">Todos</SelectItem>}
                      {rpvData.availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  )}
                </div>
              </div>
            </div>
            <Tabs value={rpvView} onValueChange={(value) => setRpvView(value as 'valor' | 'percentual')}>
              <TabsList className="flex w-full sm:w-auto text-[14px] md:text-base">
                <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="valor">Valor Pago + Lucro</TabsTrigger>
                <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="percentual">% do Incidente</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className={`w-full ${isMobile ? 'px-1 pt-0 pb-1' : ''}`}>
          <div
            className="w-full"
            style={{ minHeight: isMobile ? `${mobileChartMinHeight}px` : '450px' }}
          >
            <ResponsiveContainer
              width="100%"
              height={isMobile ? Math.max(450, mobileChartMinHeight) : 450}
            >
              <BarChart
                data={rpvData.data}
                margin={
                  isMobile
                    ? { top: 20, right: 12, left: 12, bottom: 40 }
                    : { top: 20, right: 80, left: 100, bottom: 20 }
                }
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 12 }}
                  domain={rpvTimeView === 'annual' ? ['dataMin - 0.5', 'dataMax + 0.5'] : undefined}
                  padding={rpvTimeView === 'annual' ? { left: 20, right: 20 } : undefined}
                />
                <YAxis 
                  domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  tickFormatter={(value) => {
                    if (rpvView === 'percentual') {
                      return `${value.toFixed(1)}%`;
                    }
                    if (isMobile) {
                      return formatMobileCurrencyTick(value as number);
                    }
                    return new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(value);
                  }}
                />
                <Tooltip 
                  formatter={(value: number) => {
                    if (rpvView === 'percentual') {
                      return [`${value.toFixed(2)}%`, '% sobre os incidentes:'];
                    }
                    return [new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(value), 'Total:'];
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#ff7300"
                  radius={[0, 0, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Resumo dos totais */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            {/* Lista de períodos e valores */}
            {rpvExpanded && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 space-y-1">
                  {rpvData.data.map((item, index) => (
                    <div key={index} className="flex">
                      <span className="inline-block min-w-[120px]">
                        Total {item.name}: <span className="font-normal">
                          {rpvView === 'valor' ? (
                            new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(item.value)
                          ) : (
                            `${item.value.toFixed(2)}%`
                          )}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={`flex ${isMobile ? 'flex-col gap-2 items-start' : 'justify-between items-center'}`}>
              {rpvView === 'valor' ? (
                <div className={`text-sm ${isMobile ? 'text-[10px] leading-tight' : ''}`}>
                  <span className="font-semibold">Total: </span>
                  <span className="text-orange-600 font-bold">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(
                      rpvData.data.reduce((sum, item) => sum + item.value, 0)
                    )}
                  </span>
                  {rpvData.cessionarioNome === 'Alpha Intermediação de Serviços e Negócios LTDA' && (
                    <span className={`text-gray-600 ${isMobile ? 'block mt-1' : 'ml-2 inline-block'}`}>
                      + 30% de honorários no valor de: {' '}
                      <span className="font-semibold">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(
                          rpvData.totalValorIncidente * 0.3
                        )}
                      </span>
                      {' = '}
                      <span className="font-semibold">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(
                          rpvData.data.reduce((sum, item) => sum + item.value, 0) + (rpvData.totalValorIncidente * 0.3)
                        )}
                      </span>
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm">
                  <span className="font-semibold">
                    % média sobre os incidentes: 
                  </span>
                  <span className="text-orange-600 font-bold">
                    {(() => {
                      // Calcular média ou total dependendo do modo
                      if (rpvTimeView === 'annual') {
                        // Média anual: soma de todas as % / número de períodos
                        const total = rpvData.data.reduce((sum, item) => sum + item.value, 0);
                        const count = rpvData.data.length;
                        return count > 0 ? `${(total / count).toFixed(2)}%` : '0%';
                      } else {
                        // Total mensal: calcular % total (soma de preco_pago / soma de valor_liquido) * 100
                        // Precisamos recalcular com os dados originais
                        const allFilteredAcquisitions = [...(acquisitions || []), ...(finishedAcquisitions || [])];
                        const rpvAcquisitions = allFilteredAcquisitions.filter(acq => 
                          acq && 
                          acq.incidente?.toLowerCase() === 'rpv' && 
                          acq.pagamento_aquisicao && 
                          acq.preco_pago && 
                          acq.valor_liquido
                        );
                        
                        if (selectedRpvYear !== 'all') {
                          const filtered = rpvAcquisitions.filter(acq => {
                            const date = new Date(acq.pagamento_aquisicao);
                            return date.getFullYear() === parseInt(selectedRpvYear);
                          });
                          const totalPrecoPago = filtered.reduce((sum, acq) => sum + Number(acq.preco_pago), 0);
                          const totalValorLiquido = filtered.reduce((sum, acq) => sum + Number(acq.valor_liquido), 0);
                          return totalValorLiquido > 0 ? `${((totalPrecoPago / totalValorLiquido) * 100).toFixed(2)}%` : '0%';
                        } else {
                          const totalPrecoPago = rpvAcquisitions.reduce((sum, acq) => sum + Number(acq.preco_pago), 0);
                          const totalValorLiquido = rpvAcquisitions.reduce((sum, acq) => sum + Number(acq.valor_liquido), 0);
                          return totalValorLiquido > 0 ? `${((totalPrecoPago / totalValorLiquido) * 100).toFixed(2)}%` : '0%';
                        }
                      }
                    })()}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRpvExpanded(!rpvExpanded)}
                className={`ml-auto text-[14px] md:text-base ${isMobile ? 'text-xs px-2 py-1' : ''}`}
              >
                {rpvExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    Ocultar detalhes
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    Mostrar detalhes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Valores Recebidos Geral */}
      <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">
              {valoresRecebidosView === 'geral'
                ? `Valores Recebidos por Incidente (${valoresRecebidosData.count})`
                : `Valores Recebidos (Lucro + Valor Pago) (${valoresRecebidosData.count})`}
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Tabs value={valoresRecebidosTimeView} onValueChange={(value) => setValoresRecebidosTimeView(value as 'monthly' | 'annual')}>
                  <TabsList className="flex w-full sm:w-auto flex-row-reverse sm:flex-row text-[14px] md:text-base">
                    <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="monthly">Mensal</TabsTrigger>
                    <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="annual">Anual</TabsTrigger>
                  </TabsList>
                </Tabs>
                {(!isMobile || valoresRecebidosTimeView === 'monthly') && (
                  <Select value={selectedValoresRecebidosYear} onValueChange={setSelectedValoresRecebidosYear}>
                    <SelectTrigger className="w-[110px] sm:w-[120px] text-[14px] md:text-base">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {(!isMobile || valoresRecebidosTimeView !== 'monthly') && <SelectItem value="all">Todos</SelectItem>}
                      {valoresRecebidosData.availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
          <Tabs value={valoresRecebidosView} onValueChange={(value) => setValoresRecebidosView(value as 'geral' | 'detalhado')}>
            <TabsList className="flex w-full sm:w-auto text-[14px] md:text-base">
              <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="geral">Incidente</TabsTrigger>
              <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="detalhado">Lucro + Valor Pago</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className={`w-full ${isMobile ? 'px-1 pt-0 pb-1' : ''}`}>
          <div
            className="w-full"
            style={{ minHeight: isMobile ? `${mobileChartMinHeight}px` : '450px' }}
          >
            <ResponsiveContainer
              width="100%"
              height={isMobile ? Math.max(450, mobileChartMinHeight) : 450}
            >
              {valoresRecebidosView === 'geral' ? (
                <ComposedChart
                  data={valoresRecebidosData.data}
                  margin={
                    isMobile
                      ? { top: 20, right: 12, left: 12, bottom: 40 }
                      : { top: 20, right: 80, left: 100, bottom: 80 }
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fontSize: 12 }}
                    domain={valoresRecebidosTimeView === 'annual' ? ['dataMin - 0.5', 'dataMax + 0.5'] : undefined}
                    padding={valoresRecebidosTimeView === 'annual' ? { left: 20, right: 20 } : undefined}
                  />
                  <YAxis 
                  domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  tickFormatter={(value) => {
                    if (isMobile) {
                      return formatMobileCurrencyTick(value as number);
                    }
                      return new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(value);
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const formattedValue = new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(value);
                      return [formattedValue, name.replace(/_/g, ' ').toUpperCase()];
                    }}
                    content={(props: { active?: boolean; payload?: Array<{ value?: number; name?: string; color?: string }>; label?: string }) => {
                      if (!props.active || !props.payload || !props.payload.length) return null;
                      
                      const total = props.payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
                      
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                          <p className="font-semibold mb-2">{props.label}</p>
                          {props.payload.map((entry, index) => (
                            <p key={index} style={{ color: entry.color }} className="text-sm">
                              {entry.name?.replace(/_/g, ' ').toUpperCase()}: {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }).format(entry.value || 0)}
                            </p>
                          ))}
                          <p className="font-bold mt-2 pt-2 border-t border-gray-200">
                            Total: {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(total)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    formatter={(value) => value.replace(/_/g, ' ').toUpperCase()}
                  />
                  {(() => {
                    // Obter todos os tipos de incidente únicos
                    const allIncidentTypes = new Set<string>();
                    valoresRecebidosData.data.forEach(item => {
                      item.incidentes.forEach(inc => {
                        allIncidentTypes.add(inc.incidente);
                      });
                    });
                    
                    const incidentTypes = Array.from(allIncidentTypes);
                    const colors = generateColors(incidentTypes.length);
                    const incidentColorsMap: Record<string, string> = {};
                    incidentTypes.forEach((inc, index) => {
                      incidentColorsMap[inc] = colors[index % colors.length];
                    });
                    
                    return incidentTypes.map((incidente) => {
                      const color = incidentColorsMap[incidente] || "hsl(0, 0%, 50%)";
                      return (
                        <Bar
                          key={incidente}
                          dataKey={(data: { incidentes: Array<{ incidente: string; valor: number }> }) => {
                            const inc = data.incidentes.find(i => i.incidente === incidente);
                            return inc ? inc.valor : 0;
                          }}
                          stackId="a"
                          fill={color}
                          name={incidente.replace(/_/g, ' ').toUpperCase()}
                        />
                      );
                    });
                  })()}
                </ComposedChart>
              ) : (
                <BarChart
                  data={valoresRecebidosData.data}
                  margin={
                    isMobile
                      ? { top: 20, right: 12, left: 12, bottom: 40 }
                      : { top: 20, right: 80, left: 100, bottom: 20 }
                  }
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fontSize: 12 }}
                    domain={valoresRecebidosTimeView === 'annual' ? ['dataMin - 0.5', 'dataMax + 0.5'] : undefined}
                    padding={valoresRecebidosTimeView === 'annual' ? { left: 20, right: 20 } : undefined}
                  />
                  <YAxis 
                  domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  tickFormatter={(value) => {
                    if (isMobile) {
                      return formatMobileCurrencyTick(value as number);
                    }
                      return new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(value);
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const formattedValue = new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(value);
                      return [formattedValue, name];
                    }}
                    content={(props: { active?: boolean; payload?: Array<{ value?: number; name?: string; color?: string }>; label?: string }) => {
                      if (!props.active || !props.payload || !props.payload.length) return null;
                      
                      const precoPago = props.payload.find(p => p.name === 'Preço Pago')?.value || 0;
                      const lucro = props.payload.find(p => p.name === 'Lucro')?.value || 0;
                      const total = precoPago + lucro;
                      
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                          <p className="font-semibold mb-2">{props.label}</p>
                          {props.payload.map((entry, index) => (
                            <p key={index} style={{ color: entry.color }} className="text-sm">
                              {entry.name}: {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }).format(entry.value || 0)}
                            </p>
                          ))}
                          <p className="font-bold mt-2 pt-2 border-t border-gray-200">
                            Total: {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(total)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar 
                    dataKey="totalPrecoPago" 
                    fill="#ff7300"
                    name="Preço Pago"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="totalLucro" 
                    fill="hsl(142, 76%, 36%)"
                    name="Lucro"
                    radius={[0, 0, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {/* Resumo dos totais */}
          <div className="mt-4 pt-4">
            {/* Lista de períodos e valores */}
            {valoresRecebidosExpanded && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 space-y-1">
                  {valoresRecebidosData.data.map((item, index) => (
                    <div key={index} className="flex">
                      <span className="inline-block min-w-[120px]">
                        Total {item.name}: <span className="font-normal">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(item.total)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={`flex ${isMobile ? 'flex-col gap-2 items-start' : 'justify-between items-center'}`}>
              <div className={`text-sm ${isMobile ? 'text-xs' : ''}`}>
                <span className="font-semibold">Total: </span>
                <span className="text-orange-600 font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }).format(
                    valoresRecebidosData.data.reduce((sum, item) => sum + item.total, 0)
                  )}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setValoresRecebidosExpanded(!valoresRecebidosExpanded)}
                className={`ml-auto text-[14px] md:text-base ${isMobile ? 'text-xs px-2 py-1' : ''}`}
              >
                {valoresRecebidosExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    Ocultar detalhes
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    Mostrar detalhes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Valores Pendentes */}
      <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">
              {valoresPendentesView === 'valores'
                ? `Valores Pendentes (Pago + Lucro) (${valoresPendentesData.count})`
                : `Quantidade de Aquisições Pendentes (${valoresPendentesData.count})`}
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
              <div className="text-xs text-gray-600 text-right sm:text-left w-full sm:w-auto">
                <div>Dados de: {valoresPendentesData.snapshotDate || getSnapshotDate()}</div>
                <div>Próxima atualização: {getNextUpdateDate().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</div>
                <div className="font-semibold">Faltam {getDaysUntilUpdate()} dia(s)</div>
              </div>
            </div>
          </div>
          <Tabs value={valoresPendentesView} onValueChange={(value) => setValoresPendentesView(value as 'valores' | 'quantidade')}>
            <TabsList className="flex w-full sm:w-auto text-[14px] md:text-base">
              <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="valores">Pago + Lucro</TabsTrigger>
              <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="quantidade">Quantidade</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className={`w-full ${isMobile ? 'px-1 pt-0 pb-1' : ''}`}>
          <div
            className="w-full"
            style={{ minHeight: isMobile ? `${mobileChartMinHeight}px` : '450px' }}
          >
            <ResponsiveContainer
              width="100%"
              height={isMobile ? Math.max(450, mobileChartMinHeight) : 450}
            >
              {valoresPendentesView === 'valores' ? (
                <ComposedChart
                  data={valoresPendentesData.data}
                  margin={
                    isMobile
                      ? { top: 20, right: 12, left: 12, bottom: 40 }
                      : { top: 20, right: 80, left: 100, bottom: 80 }
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                  domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  tickFormatter={(value) => {
                    if (isMobile) {
                      return formatMobileCurrencyTick(value as number);
                    }
                      return new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(value);
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const formattedValue = new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(value);
                      return [formattedValue, name.replace(/_/g, ' ').toUpperCase()];
                    }}
                    content={(props: { active?: boolean; payload?: Array<{ value?: number; name?: string; color?: string }>; label?: string }) => {
                      if (!props.active || !props.payload || !props.payload.length) return null;
                      
                      // Somar apenas os valores das barras (incidentes), não a linha
                      const total = props.payload
                        .filter(p => p.name !== 'Total' && p.name !== 'total')
                        .reduce((sum, entry) => sum + (entry.value || 0), 0);
                      
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                          <p className="font-semibold mb-2">{props.label}</p>
                          {props.payload.filter(p => p.name !== 'Total' && p.name !== 'total').map((entry, index) => (
                            <p key={index} style={{ color: entry.color }} className="text-sm">
                              {entry.name?.replace(/_/g, ' ').toUpperCase()}: {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }).format(entry.value || 0)}
                            </p>
                          ))}
                          <p className="font-bold mt-2 pt-2 border-t border-gray-200">
                            Total: {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(total)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    formatter={(value) => value.replace(/_/g, ' ').toUpperCase()}
                  />
                  {valoresPendentesData.incidentes.map((inc, index) => {
                    const colors = generateColors(valoresPendentesData.incidentes.length);
                    const color = colors[index % colors.length];
                    return (
                      <Bar
                        key={inc.incidente}
                        dataKey={inc.incidente}
                        stackId="a"
                        fill={color}
                        name={inc.incidente.replace(/_/g, ' ').toUpperCase()}
                      />
                    );
                  })}
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#ff7300" 
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#ff7300', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }}
                    name="Total"
                  >
                    <LabelList 
                      dataKey="total" 
                      position="top" 
                      fill="#ff7300" 
                      fontSize={12}
                      fontWeight="bold"
                      offset={10}
                      formatter={(value: number) => {
                        return new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(value);
                      }}
                    />
                  </Line>
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={[
                    {
                      name: valoresPendentesData.snapshotDate || getSnapshotDate(),
                      ...valoresPendentesData.incidentes.reduce((acc, inc) => {
                        acc[inc.incidente] = inc.quantidade;
                        return acc;
                      }, {} as Record<string, number>),
                      total: valoresPendentesData.count
                    }
                  ]} 
                  margin={
                    isMobile
                      ? { top: 20, right: 12, left: 12, bottom: 40 }
                      : { top: 20, right: 80, left: 100, bottom: 80 }
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      return [`${value}`, name.replace(/_/g, ' ').toUpperCase()];
                    }}
                    content={(props: { active?: boolean; payload?: Array<{ value?: number; name?: string; color?: string }>; label?: string }) => {
                      if (!props.active || !props.payload || !props.payload.length) return null;
                      
                      // Somar apenas os valores das barras (incidentes), não a linha
                      const total = props.payload
                        .filter(p => p.name !== 'Total' && p.name !== 'total')
                        .reduce((sum, entry) => sum + (entry.value || 0), 0);
                      
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                          <p className="font-semibold mb-2">{props.label}</p>
                          {props.payload.filter(p => p.name !== 'Total' && p.name !== 'total').map((entry, index) => (
                            <p key={index} style={{ color: entry.color }} className="text-sm">
                              {entry.name?.replace(/_/g, ' ').toUpperCase()}: {entry.value || 0}
                            </p>
                          ))}
                          <p className="font-bold mt-2 pt-2 border-t border-gray-200">
                            Total: {total}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    formatter={(value) => value.replace(/_/g, ' ').toUpperCase()}
                  />
                  {valoresPendentesData.incidentes.map((inc, index) => {
                    const colors = generateColors(valoresPendentesData.incidentes.length);
                    const color = colors[index % colors.length];
                    return (
                      <Bar
                        key={inc.incidente}
                        dataKey={inc.incidente}
                        stackId="a"
                        fill={color}
                        name={inc.incidente.replace(/_/g, ' ').toUpperCase()}
                      />
                    );
                  })}
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#ff7300" 
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#ff7300', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }}
                    name="Total"
                  >
                    <LabelList 
                      dataKey="total" 
                      position="top" 
                      fill="#ff7300" 
                      fontSize={12}
                      fontWeight="bold"
                      offset={10}
                    />
                  </Line>
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de RPVs Pendentes de Recebimento */}
      <Card className="shadow-card hover:shadow-hover transition-shadow bg-gradient-card mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">
            {rpvPendentesView === 'acumulado'
              ? `RPVs Pendentes de Recebimento (${rpvPendentesData.count})`
              : `RPV Pendentes de Recebimento (${rpvPendentesData.count})`}
          </CardTitle>
          <div className="flex flex-row flex-wrap items-center gap-2 justify-start sm:justify-end w-full">
            <Tabs value={rpvPendentesTimeView} onValueChange={(value) => setRpvPendentesTimeView(value as 'monthly' | 'annual')}>
              <TabsList className="flex w-auto flex-row-reverse sm:flex-row text-[14px] md:text-base gap-2">
                <TabsTrigger className="px-2 py-1 text-[14px] md:text-base whitespace-nowrap flex-shrink-0" value="monthly">
                  Mensal
                </TabsTrigger>
                <TabsTrigger className="px-2 py-1 text-[14px] md:text-base whitespace-nowrap flex-shrink-0" value="annual">
                  Anual
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {(!isMobile || rpvPendentesTimeView === 'monthly') && rpvPendentesAvailableYears.length > 0 && (
              <Select
                value={selectedRpvPendentesYear}
                onValueChange={setSelectedRpvPendentesYear}
              >
                <SelectTrigger className="w-auto min-w-[110px] text-[14px] md:text-base">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {(!isMobile || rpvPendentesTimeView !== 'monthly') && (
                    <SelectItem value="all">Todos</SelectItem>
                  )}
                  {rpvPendentesAvailableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
          <Tabs value={rpvPendentesView} onValueChange={(value) => setRpvPendentesView(value as 'acumulado' | 'etapas')}>
            <TabsList className="flex w-full sm:w-auto text-[14px] md:text-base">
              <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="acumulado">Quantidade de pendentes</TabsTrigger>
              <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="etapas">Etapa</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className={`w-full ${isMobile ? 'px-1 pt-0 pb-1' : ''}`}>
          <div
            className="w-full"
            style={{ minHeight: isMobile ? `${mobileChartMinHeight}px` : '450px' }}
          >
            <ResponsiveContainer
              width="100%"
              height={isMobile ? Math.max(450, mobileChartMinHeight) : 450}
            >
              {rpvPendentesView === 'acumulado' ? (
                <BarChart
                  data={rpvPendentesAcumuladoData}
                  margin={
                    isMobile
                      ? { top: 20, right: 12, left: 12, bottom: 40 }
                      : { top: 20, right: 80, left: 100, bottom: 20 }
                  }
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  />
                  <Tooltip 
                    formatter={(value: number) => {
                      return [`${value}`, 'Quantidade:'];
                    }}
                  />
                  <Bar 
                    dataKey="quantidade" 
                    fill="#ff7300"
                    name="Quantidade"
                    radius={[0, 0, 0, 0]}
                  >
                    <LabelList 
                      dataKey="quantidade" 
                      position="top" 
                      fill="#ff7300" 
                      fontSize={12}
                      fontWeight="bold"
                      offset={10}
                    />
                  </Bar>
                </BarChart>
              ) : (
                <BarChart
                  data={rpvPendentesData.etapas}
                  margin={
                    isMobile
                      ? { top: 20, right: 12, left: 12, bottom: 60 }
                      : { top: 20, right: 80, left: 100, bottom: 80 }
                  }
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    domain={['auto', (dataMax: number) => dataMax * 1.4]}
                  />
                  <Tooltip 
                    formatter={(value: number) => {
                      return [`${value}`, 'Quantidade:'];
                    }}
                  />
                  <Bar 
                    dataKey="quantidade" 
                    fill="#ff7300"
                    name="Quantidade"
                    radius={[0, 0, 0, 0]}
                  >
                    <LabelList 
                      dataKey="quantidade" 
                      position="top" 
                      fill="#ff7300" 
                      fontSize={12}
                      fontWeight="bold"
                      offset={10}
                    />
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Precatórios pendentes */}
      {renderPendentesCard({
        title: `Precatórios pendentes (${precatorioPendentesData.count})`,
        view: precatorioPendentesView,
        onViewChange: setPrecatorioPendentesView,
        timeView: precatorioPendentesTimeView,
        onTimeViewChange: setPrecatorioPendentesTimeView,
        selectedYear: selectedPrecatorioPendentesYear,
        onYearChange: setSelectedPrecatorioPendentesYear,
        data: precatorioPendentesData,
        emptyMessage: 'Nenhuma aquisição pendente encontrada no grupo Aquisições Precatórios para o cessionário selecionado.',
        isMobile,
      })}

      {/* Gráfico de Precatórios em Acordo pendentes */}
      {renderPendentesCard({
        title: `Precatórios em acordo pendentes (${precatorioAcordoPendentesData.count})`,
        view: precatorioAcordoPendentesView,
        onViewChange: setPrecatorioAcordoPendentesView,
        timeView: precatorioAcordoPendentesTimeView,
        onTimeViewChange: setPrecatorioAcordoPendentesTimeView,
        selectedYear: selectedPrecatorioAcordoPendentesYear,
        onYearChange: setSelectedPrecatorioAcordoPendentesYear,
        data: precatorioAcordoPendentesData,
        emptyMessage: 'Nenhuma aquisição pendente encontrada no grupo Aquisições Precatórios (Acordo) para o cessionário selecionado.',
        isMobile,
      })}

      {/* Gráfico de Precatórios com Prioridade pendentes */}
      {renderPendentesCard({
        title: `Precatórios com prioridade pendentes (${precatorioPrioridadePendentesData.count})`,
        view: precatorioPrioridadePendentesView,
        onViewChange: setPrecatorioPrioridadePendentesView,
        timeView: precatorioPrioridadePendentesTimeView,
        onTimeViewChange: setPrecatorioPrioridadePendentesTimeView,
        selectedYear: selectedPrecatorioPrioridadePendentesYear,
        onYearChange: setSelectedPrecatorioPrioridadePendentesYear,
        data: precatorioPrioridadePendentesData,
        emptyMessage: 'Nenhuma aquisição pendente encontrada no grupo Aquisições Precatórios Prioridade para o cessionário selecionado.',
        isMobile,
      })}

      {/* Gráfico de Precatórios SJRP pendentes */}
      {renderPendentesCard({
        title: `Precatórios SJRP pendentes (${precatorioSjrpPendentesData.count})`,
        view: precatorioSjrpPendentesView,
        onViewChange: setPrecatorioSjrpPendentesView,
        timeView: precatorioSjrpPendentesTimeView,
        onTimeViewChange: setPrecatorioSjrpPendentesTimeView,
        selectedYear: selectedPrecatorioSjrpPendentesYear,
        onYearChange: setSelectedPrecatorioSjrpPendentesYear,
        data: precatorioSjrpPendentesData,
        emptyMessage: 'Nenhuma aquisição pendente encontrada no grupo Aquisições Precatórios SJRP para o cessionário selecionado.',
        isMobile,
      })}

      {/* Gráfico de Precatórios - Valor Pago + Lucro por Grupo */}
      <Card className="shadow-card mt-6">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="w-full sm:w-auto whitespace-nowrap sm:whitespace-normal overflow-hidden sm:overflow-visible text-ellipsis sm:text-clip text-base sm:text-lg font-semibold leading-tight">
                {precatorioResumoView === 'valor'
                  ? `Precatórios - Valor Pago + Lucro (${precatorioResumoData.count})`
                  : `Precatórios - % do Incidente (${precatorioResumoData.count})`}
              </CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Tabs value={precatorioResumoTimeView} onValueChange={(value) => setPrecatorioResumoTimeView(value as 'monthly' | 'annual')}>
                    <TabsList className="flex w-full sm:w-auto flex-row-reverse sm:flex-row text-[14px] md:text-base">
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="monthly">Mensal</TabsTrigger>
                      <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="annual">Anual</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {(!isMobile || precatorioResumoTimeView === 'monthly') && (
                    <Select value={selectedPrecatorioResumoYear} onValueChange={setSelectedPrecatorioResumoYear}>
                      <SelectTrigger className="w-[120px] text-[14px] md:text-base">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                      {(!isMobile || precatorioResumoTimeView !== 'monthly') && <SelectItem value="all">Todos</SelectItem>}
                        {precatorioResumoData.availableYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <Select
                    value={selectedPrecatorioResumoGroup}
                    onValueChange={(value) => {
                      setSelectedPrecatorioResumoGroup(value as PrecatorioResumoGroupValue);
                      setSelectedPrecatorioResumoYear('all');
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[220px] text-[14px] md:text-base">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRECATORIO_RESUMO_GROUP_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Tabs value={precatorioResumoView} onValueChange={(value) => setPrecatorioResumoView(value as 'valor' | 'percentual')}>
              <TabsList className="flex w-full sm:w-auto text-[14px] md:text-base">
                <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="valor">Valor Pago + Lucro</TabsTrigger>
                <TabsTrigger className="flex-1 sm:flex-none px-2 py-1 text-[14px] md:text-base" value="percentual">% do Incidente</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className={`w-full ${isMobile ? 'px-1 pt-0 pb-1' : ''}`}>
          <div
            className="w-full"
            style={{ minHeight: isMobile ? `${mobileChartMinHeight}px` : '450px' }}
          >
            <ResponsiveContainer
              width="100%"
              height={isMobile ? Math.max(450, mobileChartMinHeight) : 450}
            >
              {precatorioResumoData.count === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-500 px-6 text-center">
                  Nenhuma aquisição com pagamento encontrada para o filtro atual.
                </div>
              ) : precatorioResumoData.data.length > 0 ? (
                <BarChart
                  data={precatorioResumoData.data}
                  margin={
                    isMobile
                      ? { top: 20, right: 12, left: 12, bottom: 40 }
                      : { top: 20, right: 80, left: 100, bottom: 20 }
                  }
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    angle={precatorioResumoTimeView === 'monthly' ? -45 : 0}
                    textAnchor={precatorioResumoTimeView === 'monthly' ? 'end' : 'middle'}
                    height={precatorioResumoTimeView === 'monthly' ? 80 : 50}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    domain={['auto', (dataMax: number) => dataMax * 1.4]}
                    tickFormatter={(value) => {
                      if (precatorioResumoView === 'percentual') {
                        return `${value.toFixed(1)}%`;
                      }
                      if (isMobile) {
                        return formatMobileCurrencyTick(value as number);
                      }
                      return new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(value);
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => {
                      if (precatorioResumoView === 'percentual') {
                        return [`${value.toFixed(2)}%`, '% sobre os incidentes:'];
                      }
                      return [
                        new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(value),
                        'Total:',
                      ];
                    }}
                  />
                  <Bar dataKey="value" fill="#ff7300" radius={[0, 0, 0, 0]} />
                </BarChart>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-500 px-6 text-center">
                  Nenhum registro encontrado para o ano selecionado.
                </div>
              )}
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            {precatorioResumoExpanded && precatorioResumoData.data.length > 0 && (
              <div className="mb-3">
                <div className={`text-xs text-gray-600 space-y-1 ${isMobile ? 'text-[10px]' : ''}`}>
                  {precatorioResumoData.data.map((item, index) => (
                    <div key={index} className="flex">
                      <span className="inline-block min-w-[120px]">
                        Total {item.name}: <span className="font-normal">
                          {precatorioResumoView === 'valor'
                            ? new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(item.value)
                            : `${item.value.toFixed(2)}%`}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={`flex ${isMobile ? 'flex-col gap-2 items-start' : 'justify-between items-center'}`}>
              {precatorioResumoView === 'valor' ? (
                <div className={`text-sm ${isMobile ? 'text-[10px] leading-tight' : ''}`}>
                  <span className="font-semibold">Total: </span>
                  <span className="text-orange-600 font-bold">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      precatorioResumoData.data.reduce((sum, item) => sum + item.value, 0)
                    )}
                  </span>
                  {precatorioResumoData.cessionarioNome === 'Alpha Intermediação de Serviços e Negócios LTDA' && (
                    <span className={`text-gray-600 ${isMobile ? 'block mt-1' : 'ml-2 inline-block'}`}>
                      + 30% de honorários no valor de:{' '}
                      <span className="font-semibold">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(precatorioResumoData.totalValorIncidente * 0.3)}
                      </span>
                      {' = '}
                      <span className="font-semibold">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(
                          precatorioResumoData.data.reduce((sum, item) => sum + item.value, 0) +
                            precatorioResumoData.totalValorIncidente * 0.3
                        )}
                      </span>
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm">
                  <span className="font-semibold">% média sobre os incidentes: </span>
                  <span className="text-orange-600 font-bold">
                    {precatorioResumoData.data.length > 0
                      ? `${(
                          precatorioResumoData.data.reduce((sum, item) => sum + item.value, 0) /
                          precatorioResumoData.data.length
                        ).toFixed(2)}%`
                      : '0%'}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrecatorioResumoExpanded((prev) => !prev)}
                className={`ml-auto text-[14px] md:text-base ${isMobile ? 'text-xs px-2 py-1' : ''}`}
              >
                {precatorioResumoExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    Ocultar detalhes
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    Mostrar detalhes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </>
  );
};

export default OverviewCharts;

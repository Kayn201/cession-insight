// Serviço para integração com Monday.com API

const MONDAY_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjUyMTA4MjQ4NCwiYWFpIjoxMSwidWlkIjo0MDE4NTgwOCwiaWFkIjoiMjAyNS0wNi0wM1QwNDoxOTo0Ny4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MTQwMDk2MDksInJnbiI6InVzZTEifQ.lQf6M346-0iuh7WBQqgENJRZw36ES7oIMAtkB-TmUH4";
const MONDAY_BOARD_ID = "8238865235";
const MONDAY_API_URL = "https://api.monday.com/v2";

// Tipos baseados na estrutura do Monday
export type MondayItem = {
  id: string;
  name: string;
  group: {
    id: string;
    title: string;
  };
  column_values: Array<{
    id: string;
    text: string;
    value: string | null;
    type: string;
  }>;
  created_at: string;
  updated_at: string;
};

export type MondayBoard = {
  id: string;
  name: string;
  groups: Array<{
    id: string;
    title: string;
  }>;
  items: MondayItem[];
};

// Mapeamento de colunas do Monday
const COLUMN_MAPPING = {
  DATA_AQUISICAO: "data",
  PAGAMENTO_AQUISICAO: "date_mksrd1d4",
  INCIDENTE: "status__1",
  CESSIONARIO: "texto1__1",
  HABILITACAO: "status_1__1",
  MAPA_ORCAMENTARIO: "text_mks99k23",
  PESSOAS: "multiple_person_mkrd8hfj",
  PROCESSO: "texto__1",
  FASE_PROCESSO: "status_18__1",
  PROXIMA_VERIFICACAO: "timerange_mkt4aybg",
  VALOR_INCIDENTE: "n_meros__1",
  PRECO_PAGO: "n_meros7__1",
  VALOR_LIQUIDO: "numeric_mkpsy1n0",
  ULTIMA_MOVIMENTACAO: "date_mktccq38",
  PRAZO_PROCESSUAL: "date_mktc7sr3",
  PRAZO_DEMANDA: "date_mktc3f8g",
  DEMANDA: "color_mksenjqz",
  DATA_PAGAMENTO: "date_mkpsy5xb",
  RESUMO: "text_mktckt0m",
};

// Grupo que indica finalização
const FINISHED_GROUP_TITLE = "Aquisições Finalizadas";

// Mapeamento de incidentes
const INCIDENTE_MAP: Record<string, "precatorio" | "rpv" | "precatorio_prioridade" | "precatorio_sjrp"> = {
  "Precatório": "precatorio",
  "RPV": "rpv",
  "Precatório Prioridade": "precatorio_prioridade",
  "Precatório SJRP": "precatorio_sjrp",
};

// Função auxiliar para obter valor de uma coluna
function getColumnValue(item: MondayItem, columnId: string): string | null {
  const column = item.column_values.find((cv) => cv.id === columnId);
  return column?.text || null;
}

// Função para extrair data de uma coluna de data
function extractDate(text: string | null): string | null {
  if (!text) return null;
  // Formato: "2024-11-28"
  const dateMatch = text.match(/^\d{4}-\d{2}-\d{2}/);
  return dateMatch ? dateMatch[0] : null;
}

// Função para extrair data de uma coluna timeline
function extractTimelineDate(text: string | null): string | null {
  if (!text) return null;
  // Formato: "2025-11-04 - 2025-11-11" -> pega a primeira data
  const dateMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] : null;
}

// Função para extrair número de uma coluna numérica
function extractNumber(text: string | null): number {
  if (!text) return 0;
  // Remove espaços e caracteres não numéricos exceto ponto e vírgula
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Função para mapear incidente
function mapIncidente(text: string | null): "precatorio" | "rpv" | "precatorio_prioridade" | "precatorio_sjrp" {
  if (!text) return "precatorio";
  const mapped = INCIDENTE_MAP[text];
  return mapped || "precatorio";
}

// Função para determinar se está finalizado
function isFinished(item: MondayItem): boolean {
  return item.group.title === FINISHED_GROUP_TITLE;
}

// Converter item do Monday para formato do sistema
export function convertMondayItemToAcquisition(item: MondayItem): {
  id: string;
  data_aquisicao: string;
  incidente: "precatorio" | "rpv" | "precatorio_prioridade" | "precatorio_sjrp";
  cessionario_nome: string;
  valor_incidente: number;
  preco_pago: number;
  valor_liquido: number;
  lucro: number;
  status: "ativa" | "finalizada";
  fase_processo: string | null;
  proxima_verificacao: string | null;
  pessoas: string | null;
  data_pagamento: string | null;
  pagamento_aquisicao: string | null;
  processo: string | null;
  habilitacao_cessionario: string | null;
  mapa_orcamentario: string | null;
  ultima_movimentacao: string | null;
  prazo_processual: string | null;
  prazo_demanda: string | null;
  demanda: string | null;
  resumo: string | null;
  titular_acao: string | null;
  grupo: string | null;
} {
  const dataAquisicao = extractDate(getColumnValue(item, COLUMN_MAPPING.DATA_AQUISICAO)) || item.created_at.split("T")[0];
  // Manter DATA_PAGAMENTO como estava antes para não afetar outros gráficos
  const dataPagamento = extractDate(getColumnValue(item, COLUMN_MAPPING.DATA_PAGAMENTO));
  // Campo separado para Pagamento Aquisição (usado apenas no gráfico de Contratos Fechados)
  const pagamentoAquisicao = extractDate(getColumnValue(item, COLUMN_MAPPING.PAGAMENTO_AQUISICAO));
  const proximaVerificacao = extractTimelineDate(getColumnValue(item, COLUMN_MAPPING.PROXIMA_VERIFICACAO));
  
  const valorIncidente = extractNumber(getColumnValue(item, COLUMN_MAPPING.VALOR_INCIDENTE));
  const precoPago = extractNumber(getColumnValue(item, COLUMN_MAPPING.PRECO_PAGO));
  const valorLiquido = extractNumber(getColumnValue(item, COLUMN_MAPPING.VALOR_LIQUIDO));
  const lucro = valorLiquido - precoPago;

  return {
    id: item.id,
    data_aquisicao: dataAquisicao,
    incidente: mapIncidente(getColumnValue(item, COLUMN_MAPPING.INCIDENTE)),
    cessionario_nome: getColumnValue(item, COLUMN_MAPPING.CESSIONARIO) || item.name,
    valor_incidente: valorIncidente,
    preco_pago: precoPago,
    valor_liquido: valorLiquido,
    lucro: lucro,
    status: isFinished(item) ? "finalizada" : "ativa",
    fase_processo: getColumnValue(item, COLUMN_MAPPING.FASE_PROCESSO),
    proxima_verificacao: proximaVerificacao,
    pessoas: getColumnValue(item, COLUMN_MAPPING.PESSOAS),
    data_pagamento: dataPagamento,
    pagamento_aquisicao: pagamentoAquisicao,
    processo: getColumnValue(item, COLUMN_MAPPING.PROCESSO),
    habilitacao_cessionario: getColumnValue(item, COLUMN_MAPPING.HABILITACAO),
    mapa_orcamentario: getColumnValue(item, COLUMN_MAPPING.MAPA_ORCAMENTARIO),
    ultima_movimentacao: extractDate(getColumnValue(item, COLUMN_MAPPING.ULTIMA_MOVIMENTACAO)),
    prazo_processual: extractDate(getColumnValue(item, COLUMN_MAPPING.PRAZO_PROCESSUAL)),
    prazo_demanda: extractDate(getColumnValue(item, COLUMN_MAPPING.PRAZO_DEMANDA)),
    demanda: getColumnValue(item, COLUMN_MAPPING.DEMANDA),
    resumo: getColumnValue(item, COLUMN_MAPPING.RESUMO),
    titular_acao: item.name, // O nome do item é o titular da ação
    grupo: item.group?.title || null, // Grupo do Monday.com
  };
}

// Query GraphQL para buscar board completo
const BOARD_QUERY = `
query($cursor: String) {
  boards(ids: [${MONDAY_BOARD_ID}]) {
    id
    name
    groups {
      id
      title
    }
    items_page(limit: 100, cursor: $cursor) {
      items {
        id
        name
        group {
          id
          title
        }
        column_values {
          id
          text
          value
          type
        }
        created_at
        updated_at
      }
      cursor
    }
  }
}
`;

// Função para buscar todos os items do board com paginação
export async function fetchMondayBoard(): Promise<MondayBoard> {
  const headers = {
    "Authorization": MONDAY_API_KEY,
    "Content-Type": "application/json",
    "API-Version": "2024-01",
  };

  const allItems: MondayItem[] = [];
  let cursor: string | null = null;
  let page = 1;
  let boardInfo: { id: string; name: string; groups: Array<{ id: string; title: string }> } | null = null;

  while (true) {
    const variables: { cursor?: string } = {};
    if (cursor) {
      variables.cursor = cursor;
    }

    const response = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: BOARD_QUERY,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Monday API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`Monday API errors: ${JSON.stringify(data.errors)}`);
    }

    const board = data.data.boards[0];
    if (!board) {
      throw new Error("Board not found");
    }

    // Salvar informações do board na primeira iteração
    if (!boardInfo) {
      boardInfo = {
        id: board.id,
        name: board.name,
        groups: board.groups,
      };
    }

    const items = board.items_page.items || [];
    allItems.push(...items);
    cursor = board.items_page.cursor;

    if (!cursor || items.length === 0) {
      break;
    }

    page++;
  }

  if (!boardInfo) {
    throw new Error("Board information not found");
  }

  return {
    id: boardInfo.id,
    name: boardInfo.name,
    groups: boardInfo.groups,
    items: allItems,
  };
}

// Função para obter lista única de cessionários
export function getUniqueCessionarios(items: MondayItem[]): string[] {
  const cessionarios = new Set<string>();
  items.forEach((item) => {
    const cessionario = getColumnValue(item, COLUMN_MAPPING.CESSIONARIO);
    if (cessionario) {
      cessionarios.add(cessionario);
    }
  });
  return Array.from(cessionarios).sort();
}


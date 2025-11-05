# 🔄 Fluxo de Dados: Monday.com → Dashboard

## 📋 Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONDAY.COM (Fonte de Dados)                  │
│  Board ID: 8238865235                                           │
│  - 292 itens                                                    │
│  - 6 grupos                                                     │
│  - Colunas: Data, Incidente, Cessionário, Valores, etc.        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS POST (GraphQL)
                            │ Authorization: API Key
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              SERVIÇO MONDAY (src/services/monday.ts)            │
│                                                                  │
│  1. fetchMondayBoard()                                          │
│     ├─ Monta query GraphQL                                      │
│     ├─ Faz requisição POST para api.monday.com/v2              │
│     ├─ Processa paginação (100 itens por vez)                  │
│     └─ Retorna: MondayBoard { id, name, groups, items[] }      │
│                                                                  │
│  2. convertMondayItemToAcquisition()                            │
│     ├─ Mapeia colunas do Monday para estrutura interna         │
│     ├─ Extrai valores (datas, números, textos)                 │
│     ├─ Determina status (ativa/finalizada)                     │
│     └─ Retorna: Acquisition[]                                   │
│                                                                  │
│  3. getUniqueCessionarios()                                     │
│     └─ Extrai lista única de cessionários                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Função JavaScript
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              DASHBOARD (src/pages/Dashboard.tsx)                │
│                                                                  │
│  Estado React:                                                  │
│  - allAcquisitions: Acquisition[]                               │
│  - cessionariosList: string[]                                   │
│  - filteredAcquisitions: Acquisition[] (filtrado por user)      │
│                                                                  │
│  Funções de Atualização:                                        │
│  ├─ fetchMondayData()                                           │
│  │   ├─ Chama fetchMondayBoard()                                │
│  │   ├─ Processa dados                                          │
│  │   └─ Atualiza estado (setAllAcquisitions)                    │
│  │                                                               │
│  ├─ handleRefresh() [MANUAL]                                    │
│  │   ├─ setRefreshing(true)                                     │
│  │   ├─ fetchMondayData()                                       │
│  │   └─ setRefreshing(false) + Toast                            │
│  │                                                               │
│  └─ Auto-refresh [AUTOMÁTICO]                                   │
│      └─ setInterval(() => fetchMondayData(), 15min)            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Re-render React
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INTERFACE DO USUÁRIO                         │
│                                                                  │
│  Componentes:                                                   │
│  ├─ Cards de Métricas                                           │
│  │   ├─ Total Investido (Ativas)                                │
│  │   ├─ Lucro Acumulado (Ativas)                                │
│  │   ├─ Aquisições Ativas                                       │
│  │   ├─ Aquisições Finalizadas                                  │
│  │   ├─ Total Investido (Geral)                                 │
│  │   ├─ Valor Líquido Total                                     │
│  │   ├─ Lucro Total                                             │
│  │   └─ Lucro Anual Médio                                       │
│  │                                                               │
│  ├─ Gráficos (OverviewCharts)                                   │
│  │   ├─ Investimentos e Lucros (Bar Chart)                      │
│  │   └─ Distribuição por Incidente (Pie Chart)                  │
│  │                                                               │
│  └─ Tabela (AcquisitionsTable)                                  │
│      └─ Lista de aquisições com filtros                         │
└─────────────────────────────────────────────────────────────────┘
```

## 🔍 Detalhamento da Requisição

### 1. **Query GraphQL Enviada:**

```graphql
query($cursor: String) {
  boards(ids: [8238865235]) {
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
```

### 2. **Resposta da API (Exemplo):**

```json
{
  "data": {
    "boards": [
      {
        "id": "8238865235",
        "name": "Controle de Aquisições 2025 - Fechado",
        "groups": [
          { "id": "topics", "title": "Aquisições RPV" },
          { "id": "group_mkt4g232", "title": "Aquisições Finalizadas" }
        ],
        "items_page": {
          "items": [
            {
              "id": "8256037394",
              "name": "Pedro Magalhaes Valentim",
              "group": { "id": "topics", "title": "Aquisições RPV" },
              "column_values": [
                {
                  "id": "data",
                  "text": "2024-11-28",
                  "value": "{\"date\":\"2024-11-28\"}",
                  "type": "date"
                },
                {
                  "id": "texto1__1",
                  "text": "Alpha Intermediação de Serviços e Negócios LTDA",
                  "value": "\"Alpha...\"",
                  "type": "text"
                },
                {
                  "id": "n_meros7__1",
                  "text": "50000",
                  "value": "\"50000\"",
                  "type": "numbers"
                }
              ]
            }
          ],
          "cursor": "eyJ..."
        }
      }
    ]
  }
}
```

### 3. **Processamento dos Dados:**

```typescript
// Para cada item do Monday:
const acquisition = {
  id: item.id,                              // "8256037394"
  data_aquisicao: extractDate(...),         // "2024-11-28"
  cessionario_nome: getColumnValue(...),    // "Alpha Intermediação..."
  preco_pago: extractNumber(...),           // 50000
  valor_liquido: extractNumber(...),        // 60000
  lucro: 60000 - 50000,                     // 10000
  status: isFinished(item) ? "finalizada" : "ativa",
  // ... outros campos
};
```

## ⏱️ Timeline de Atualização

```
┌─────────────────────────────────────────────────────────────┐
│  Tempo    │ Evento                                          │
├───────────┼─────────────────────────────────────────────────┤
│  T+0s     │ Usuário acessa Dashboard                        │
│  T+0.5s   │ React carrega componente                        │
│  T+1s     │ useEffect dispara fetchMondayData()             │
│  T+1s     │ Requisição HTTP para Monday.com                 │
│  T+2s     │ Monday.com processa query GraphQL               │
│  T+2.5s   │ Monday.com retorna dados (página 1)            │
│  T+2.5s   │ Loop de paginação (páginas 2, 3...)            │
│  T+4s     │ Todos os dados recebidos                        │
│  T+4s     │ Processamento e conversão                       │
│  T+4.5s   │ Estado React atualizado                         │
│  T+4.5s   │ UI re-renderiza                                │
│  T+5s     │ Usuário vê dados na tela                        │
│           │                                                 │
│  T+15min  │ Auto-refresh (silencioso)                       │
│  T+30min  │ Auto-refresh (silencioso)                       │
│  T+45min  │ Auto-refresh (silencioso)                       │
│  ...      │ ...                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Ciclo de Vida Completo

```typescript
// 1. Componente monta
useEffect(() => {
  // 2. Busca dados iniciais
  fetchMondayData();
  
  // 3. Configura auto-refresh
  const interval = setInterval(() => {
    fetchMondayData();
  }, 15 * 60 * 1000);
  
  // 4. Limpa quando desmonta
  return () => clearInterval(interval);
}, []);

// 5. Usuário pode clicar em "Atualizar" a qualquer momento
<Button onClick={handleRefresh}>Atualizar</Button>
```

## 📊 Dados que São Buscados

### Do Monday.com:
- ✅ Todos os itens do board (292 itens)
- ✅ Informações de cada item (nome, grupo, colunas)
- ✅ Valores de colunas (datas, números, textos, status)
- ✅ Metadados (datas de criação/atualização)

### Processados Localmente:
- ✅ Conversão de tipos (string → number, date)
- ✅ Determinação de status (ativa/finalizada)
- ✅ Filtragem por cessionário
- ✅ Cálculos de métricas
- ✅ Agrupamento por cessionário (admin)

### Exibidos na UI:
- ✅ Cards com métricas calculadas
- ✅ Gráficos (bar chart e pie chart)
- ✅ Tabela de aquisições com filtros

## 🎯 Pontos Importantes

1. **Não é Tempo Real**: Dados só atualizam quando:
   - Página carrega
   - Usuário clica "Atualizar"
   - Passam 15 minutos

2. **Paginação**: Busca 100 itens por vez até pegar todos

3. **Processamento Client-Side**: Toda a lógica roda no navegador

4. **Sem Cache**: Cada requisição busca dados frescos do Monday.com

5. **Filtragem Client-Side**: Dados são filtrados após serem recebidos


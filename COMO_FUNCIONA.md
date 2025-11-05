# 🔄 Como Funciona a Atualização de Dados do Monday.com

## 📊 Sistema Atual: Polling (Consulta Periódica)

Atualmente, o sistema **NÃO** é tempo real, mas sim **quase em tempo real** usando uma técnica chamada **Polling** (consulta periódica).

### Como Funciona:

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │────────▶│   Dashboard  │────────▶│ Monday.com  │
│  (Frontend) │  GET    │  (React App) │  API    │    (API)    │
└─────────────┘         └──────────────┘         └─────────────┘
     ▲                           │
     │                           │
     │   Atualiza UI             │
     └───────────────────────────┘
```

## 🔍 Fluxo Detalhado

### 1. **Busca Inicial (Quando a página carrega)**

```typescript
// Quando o usuário faz login ou acessa o dashboard
useEffect(() => {
  fetchMondayData(); // ← Busca dados imediatamente
}, []);
```

**O que acontece:**
1. A função `fetchMondayData()` é chamada
2. Ela chama `fetchMondayBoard()` do serviço Monday
3. Faz uma requisição GraphQL para a API do Monday.com
4. Recebe todos os itens do board (com paginação se necessário)
5. Processa e converte os dados
6. Atualiza o estado do React
7. A UI é re-renderizada com os novos dados

### 2. **Atualização Manual (Botão "Atualizar")**

```typescript
const handleRefresh = async () => {
  setRefreshing(true);
  await fetchMondayData(); // ← Busca dados novamente
  setRefreshing(false);
};
```

**O que acontece:**
- Usuário clica no botão "Atualizar"
- Mesmo processo da busca inicial
- Mostra feedback visual durante o carregamento
- Toast de confirmação quando termina

### 3. **Auto-Refresh (A cada 15 minutos)**

```typescript
// Auto-refresh a cada 15 minutos
const refreshInterval = setInterval(() => {
  if (session) {
    fetchMondayData(); // ← Busca automática
  }
}, 15 * 60 * 1000); // 15 minutos em milissegundos
```

**O que acontece:**
- Um `setInterval` é criado quando o componente monta
- A cada 15 minutos (900.000 milissegundos), busca os dados automaticamente
- Não mostra loading, atualiza silenciosamente
- Limpa o intervalo quando o componente desmonta

## 📡 Como a API do Monday.com é Chamada

### Estrutura da Requisição:

```typescript
// src/services/monday.ts

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_API_KEY = "sua_chave_aqui";

// Query GraphQL
const BOARD_QUERY = `
  query($cursor: String) {
    boards(ids: [8238865235]) {
      id
      name
      groups { id, title }
      items_page(limit: 100, cursor: $cursor) {
        items {
          id
          name
          group { id, title }
          column_values { id, text, value, type }
          created_at
          updated_at
        }
        cursor
      }
    }
  }
`;

// Requisição HTTP
const response = await fetch(MONDAY_API_URL, {
  method: "POST",
  headers: {
    "Authorization": MONDAY_API_KEY,
    "Content-Type": "application/json",
    "API-Version": "2024-01",
  },
  body: JSON.stringify({
    query: BOARD_QUERY,
    variables: { cursor: cursor } // Para paginação
  }),
});
```

### Paginação:

O Monday.com limita a 100 itens por requisição. Para buscar todos os 292 itens:

```typescript
while (true) {
  // Faz requisição
  const data = await fetch(...);
  
  // Adiciona items ao array
  allItems.push(...data.items);
  
  // Pega o cursor para próxima página
  cursor = data.cursor;
  
  // Se não há mais itens, para
  if (!cursor || items.length === 0) break;
  
  // Continua para próxima página
}
```

## ⏱️ Limitações do Sistema Atual

### ❌ **NÃO é Tempo Real:**
- Dados só atualizam quando:
  - A página carrega (1 vez)
  - Usuário clica em "Atualizar" (manual)
  - Passam 15 minutos (automático)

### ⚠️ **Desvantagens:**
1. **Atraso**: Mudanças no Monday podem levar até 15 minutos para aparecer
2. **Requisições desnecessárias**: Busca mesmo sem mudanças
3. **Custo**: Cada requisição consome recursos da API do Monday
4. **Limite de Rate**: APIs têm limites de requisições por minuto/hora

## 🚀 Como Tornar Tempo Real (Melhorias Futuras)

### Opção 1: Webhooks do Monday.com (Recomendado)

```typescript
// Backend (Node.js/Express)
app.post('/webhook/monday', async (req, res) => {
  const { event } = req.body;
  
  if (event.type === 'change_column_value') {
    // Notifica todos os clientes conectados via WebSocket
    io.emit('monday-update', event.data);
  }
  
  res.status(200).send('OK');
});

// Frontend (React)
useEffect(() => {
  const socket = io('ws://seu-servidor');
  
  socket.on('monday-update', (data) => {
    // Atualiza dados imediatamente
    fetchMondayData();
  });
  
  return () => socket.disconnect();
}, []);
```

**Vantagens:**
- ✅ Atualização instantânea quando há mudanças
- ✅ Menos requisições (só quando há mudanças)
- ✅ Melhor performance

**Desvantagens:**
- ❌ Requer backend e WebSocket
- ❌ Configuração mais complexa
- ❌ Precisa configurar webhooks no Monday.com

### Opção 2: Polling Mais Frequente

```typescript
// Atualizar a cada 1 minuto (ao invés de 15)
const refreshInterval = setInterval(() => {
  fetchMondayData();
}, 1 * 60 * 1000); // 1 minuto
```

**Vantagens:**
- ✅ Mais atualizado (até 1 minuto de atraso)
- ✅ Fácil de implementar

**Desvantagens:**
- ❌ Mais requisições à API
- ❌ Pode atingir limites de rate limit
- ❌ Ainda não é tempo real

### Opção 3: Server-Sent Events (SSE)

```typescript
// Backend envia atualizações quando detecta mudanças
const eventSource = new EventSource('/api/monday/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateDashboard(data);
};
```

## 📊 Comparação de Métodos

| Método | Tempo de Atualização | Complexidade | Requer Backend |
|--------|---------------------|--------------|----------------|
| **Polling (Atual)** | 15 minutos | ⭐ Baixa | ❌ Não |
| **Polling Frequente** | 1 minuto | ⭐ Baixa | ❌ Não |
| **Webhooks + WebSocket** | Instantâneo | ⭐⭐⭐ Alta | ✅ Sim |
| **SSE** | Quase instantâneo | ⭐⭐ Média | ✅ Sim |

## 🔧 Como Modificar o Intervalo de Atualização

### Para Testar Mais Rápido:

Edite `src/pages/Dashboard.tsx`:

```typescript
// Linha ~111
// DE:
}, 15 * 60 * 1000); // 15 minutos

// PARA (1 minuto):
}, 1 * 60 * 1000); // 1 minuto

// OU (30 segundos):
}, 30 * 1000); // 30 segundos
```

### Para Desabilitar Auto-Refresh:

```typescript
// Comente o setInterval
// const refreshInterval = setInterval(() => {
//   if (session) {
//     fetchMondayData();
//   }
// }, 15 * 60 * 1000);
```

## 📝 Resumo do Fluxo Completo

```
1. Usuário acessa Dashboard
   ↓
2. React carrega componente
   ↓
3. useEffect dispara fetchMondayData()
   ↓
4. fetchMondayBoard() faz requisição POST para Monday.com
   ↓
5. Monday.com retorna dados em JSON (GraphQL)
   ↓
6. Dados são processados e convertidos
   ↓
7. Estado do React é atualizado (setAllAcquisitions)
   ↓
8. Componente re-renderiza com novos dados
   ↓
9. Usuário vê dados atualizados na tela
   ↓
10. [A cada 15 min] Processo se repete automaticamente
```

## 🎯 Conclusão

O sistema atual funciona bem para a maioria dos casos, mas **não é tempo real**. Se você precisar de atualizações instantâneas, considere implementar Webhooks + WebSocket ou Server-Sent Events.

Para a maioria dos casos de uso, atualizar a cada 15 minutos é suficiente e evita sobrecarregar a API do Monday.com.


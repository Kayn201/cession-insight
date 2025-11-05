# Guia de Teste - Dashboard Financeiro

## 📋 Pré-requisitos

1. Node.js instalado (versão 18 ou superior)
2. NPM ou Yarn instalado
3. Acesso à internet (para conectar com Monday.com e Supabase)

## 🚀 Passo 1: Instalar Dependências

```bash
cd cession-insight
npm install
```

## 🚀 Passo 2: Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

O servidor será iniciado em `http://localhost:5173` (ou outra porta se 5173 estiver ocupada).

## ✅ Passo 3: Testar o Sistema

### 3.1 - Primeiro Acesso (Criar Administrador)

1. Acesse `http://localhost:5173`
2. Você será redirecionado para `/first-access`
3. Preencha o formulário:
   - **Nome Completo**: Seu nome completo
   - **Nome de Usuário**: Nome de usuário
   - **Email**: Seu email
   - **Senha**: Mínimo 6 caracteres
   - **Confirmar Senha**: Mesma senha
4. Clique em "Criar Administrador Geral"
5. Você será redirecionado automaticamente para o Dashboard

### 3.2 - Testar Dashboard (Usuário Admin)

Após criar o primeiro usuário, você verá:

#### ✅ Funcionalidades a Testar:

1. **Botão de Atualizar**
   - Clique no botão "Atualizar" no topo da página
   - Verifique se os dados são atualizados do Monday.com
   - O botão deve mostrar "Atualizando..." durante o processo

2. **Auto-refresh**
   - Aguarde 15 minutos (ou altere o intervalo no código para testar mais rápido)
   - Os dados devem ser atualizados automaticamente

3. **Métricas do Dashboard**
   - Verifique se os cards mostram:
     - Total Investido (Ativas) - soma de todos os grupos exceto "Aquisições Finalizadas"
     - Lucro Acumulado (Ativas) - lucro das ativas
     - Aquisições Ativas - quantidade de itens ativos
     - Aquisições Finalizadas - quantidade do grupo finalizado
     - Total Investido (Geral) - todas as aquisições
     - Valor Líquido Total
     - Lucro Total
     - Lucro Anual Médio

4. **Visualização de Cessionários (Admin)**
   - Como admin, você deve ver todos os cessionários
   - Cada cessionário deve estar separado por uma linha
   - Se você também for cessionário, seus dados devem aparecer primeiro

5. **Gráficos**
   - **Investimentos e Lucros**:
     - Teste o filtro "Mensal" / "Anual"
     - Teste o filtro "Ativos" / "Finalizados"
     - Para finalizados: deve usar data de pagamento
     - Para ativos: deve usar data de aquisição
   - **Distribuição por Tipo de Incidente**:
     - Deve mostrar a distribuição correta

6. **Tabela de Aquisições**
   - Teste as abas: "Aquisições Ativas", "Aquisições Finalizadas", "Aquisições Total"
   - Teste os filtros por tipo de incidente (Precatórios, RPV, etc.)
   - Verifique se as colunas estão corretas:
     - Data
     - Incidente
     - Cessionário
     - Responsável
     - Valor Pago
     - Valor Líquido
     - Lucro
     - Fase
     - Próx. Verificação

### 3.3 - Testar Gerenciamento de Usuários

1. Clique no botão "Usuários" no topo (visível apenas para admin)
2. Você verá a lista de usuários cadastrados
3. Clique em "Novo Usuário"
4. Preencha o formulário:
   - **Nome Completo**: Nome do novo usuário
   - **Nome de Usuário**: Username
   - **Email**: Email do novo usuário
   - **Senha**: Senha mínima 6 caracteres
   - **Função**: Escolha "Usuário" ou "Administrador"
   - **Cessionário**: 
     - Se for "Usuário": deve aparecer um dropdown com cessionários do Monday.com
     - Se for "Administrador": campo desabilitado
5. Clique em "Criar Usuário"
6. Verifique se o usuário aparece na lista

### 3.4 - Testar Login (Após criar outro usuário)

1. Clique em "Sair" no Dashboard
2. Você será redirecionado para `/auth`
3. Faça login com:
   - Email do usuário criado
   - Senha do usuário
4. Se for usuário comum (não admin):
   - Deve ver apenas os dados do seu cessionário
   - Não deve ver botão "Usuários"
   - Dados devem ser filtrados corretamente

### 3.5 - Testar Filtros e Cálculos

#### Cálculos para Ativas:
- **Total Investido (Ativas)**: Soma de "Preço Pago" de todos os grupos EXCETO "Aquisições Finalizadas"
- **Lucro Acumulado (Ativas)**: Soma de "Lucro" de todos os grupos EXCETO "Aquisições Finalizadas"
- **Aquisições Ativas**: Quantidade de itens em todos os grupos EXCETO "Aquisições Finalizadas"

#### Cálculos Gerais:
- **Total Investido (Geral)**: Soma de "Preço Pago" de TODOS os grupos incluindo finalizadas
- **Valor Líquido Total**: Soma de "Valor líquido do incidente" de todos os grupos
- **Lucro Total**: Valor Líquido Total - Total Investido (Geral)
- **Rentabilidade Média**: (Lucro Total / Total Investido Geral) * 100

#### Lucro Anual Médio:
- Baseado apenas nas aquisições finalizadas que têm "Data do pagamento"
- Calcula: lucro / (anos decorridos entre data de aquisição e data de pagamento)
- Média de todos esses valores

## 🐛 Troubleshooting

### Erro: "Cannot connect to Monday.com"
- Verifique se a API key do Monday está correta em `src/services/monday.ts`
- Verifique sua conexão com a internet
- Verifique se o board ID está correto

### Erro: "Cannot connect to Supabase"
- Verifique as credenciais do Supabase em `src/integrations/supabase/client.ts`
- Verifique se as tabelas foram criadas corretamente no Supabase

### Dados não aparecem
- Verifique o console do navegador (F12) para erros
- Clique no botão "Atualizar" manualmente
- Verifique se o Monday.com tem dados no board

### Erro ao criar usuário
- Verifique se o email não está duplicado
- Verifique se a senha tem no mínimo 6 caracteres
- Verifique se o Supabase está configurado corretamente

## 📝 Checklist de Testes

- [ ] Primeiro acesso criado com sucesso
- [ ] Login funciona corretamente
- [ ] Dashboard carrega dados do Monday.com
- [ ] Botão "Atualizar" funciona
- [ ] Auto-refresh a cada 15 minutos funciona
- [ ] Métricas calculadas corretamente
- [ ] Gráficos mostram dados corretos
- [ ] Filtros de gráficos funcionam (Mensal/Anual, Ativos/Finalizados)
- [ ] Tabela de aquisições mostra dados corretos
- [ ] Admin vê todos os cessionários separados
- [ ] Usuário comum vê apenas seus dados
- [ ] Gerenciamento de usuários funciona
- [ ] Dropdown de cessionários carrega do Monday.com
- [ ] Cálculos de lucro anual médio estão corretos

## 🔍 Verificar Dados no Console

Abra o console do navegador (F12) e verifique:
- Se há erros de conexão
- Se os dados estão sendo carregados corretamente
- Se os cálculos estão sendo feitos

## 📊 Dados Esperados

Com base no board Monday.com (ID: 8238865235):
- Total de itens: ~292
- Grupos: 6 (incluindo "Aquisições Finalizadas")
- Cessionários: Lista única de cessionários do board

## ⚙️ Configurações Avançadas

Para testar o auto-refresh mais rapidamente, altere no arquivo `src/pages/Dashboard.tsx`:

```typescript
// Alterar de 15 minutos para 1 minuto (para teste)
const refreshInterval = setInterval(() => {
  if (session) {
    fetchMondayData();
  }
}, 1 * 60 * 1000); // 1 minuto ao invés de 15
```

## 🎯 Próximos Passos

Após testar tudo:
1. Verifique se todos os cálculos estão corretos
2. Verifique se a performance está boa
3. Teste em diferentes navegadores
4. Teste com diferentes usuários e permissões


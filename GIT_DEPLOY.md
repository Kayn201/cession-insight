# 📦 Guia: Git + Deploy Automático

## 🔄 Passo 1: Inicializar Git (se ainda não tiver)

```bash
cd cession-insight
git init
```

## 📝 Passo 2: Adicionar Arquivos ao Git

```bash
# Ver quais arquivos serão adicionados
git status

# Adicionar todos os arquivos (exceto os que estão no .gitignore)
git add .

# OU adicionar arquivos específicos
git add src/
git add package.json
git add vite.config.ts
# etc...
```

## 💾 Passo 3: Fazer Commit

```bash
git commit -m "Adiciona dashboard financeiro com integração Monday.com"
```

## 🔗 Passo 4: Conectar com Repositório Remoto

### 4.1 - Criar repositório no GitHub/GitLab/Bitbucket

1. Acesse seu provedor Git (GitHub, GitLab, etc.)
2. Crie um novo repositório
3. **NÃO inicialize com README** (se for o primeiro push)

### 4.2 - Conectar repositório local com remoto

```bash
# Adicionar repositório remoto
git remote add origin https://github.com/seu-usuario/dash-financeiro.git

# OU se usar SSH
git remote add origin git@github.com:seu-usuario/dash-financeiro.git

# Verificar se foi adicionado
git remote -v
```

## 🚀 Passo 5: Fazer Push

```bash
# Primeiro push (definir branch principal)
git branch -M main
git push -u origin main

# Próximos pushes (mais simples)
git push
```

## 🔄 Passo 6: Deploy Automático com Webhook

### Opção A: Script de Deploy no Servidor (Recomendado)

Crie um script `deploy.sh` no servidor:

```bash
#!/bin/bash
# Salvar em: /var/www/deploy/dash-financeiro-deploy.sh

cd /var/www/dash-financeiro
git pull origin main
cd cession-insight
npm install
npm run build
cp -r dist/* /var/www/dash.gruponitatori.com.br/
echo "✅ Deploy concluído em $(date)"
```

Torne executável:
```bash
chmod +x /var/www/deploy/dash-financeiro-deploy.sh
```

### Opção B: Webhook com Nginx + PHP Script

1. **Criar endpoint de webhook no servidor:**

```bash
sudo mkdir -p /var/www/webhooks
sudo nano /var/www/webhooks/dash-financeiro.php
```

Conteúdo do PHP:
```php
<?php
// /var/www/webhooks/dash-financeiro.php

$secret = 'seu_secret_aqui'; // Mude para algo seguro
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

// Verificar assinatura (opcional, mas recomendado)
if ($signature && hash_equals($signature, hash_hmac('sha256', $payload, $secret))) {
    // Executar deploy
    exec('/var/www/deploy/dash-financeiro-deploy.sh 2>&1', $output, $return);
    http_response_code(200);
    echo json_encode(['status' => 'success', 'output' => $output]);
} else {
    http_response_code(403);
    echo json_encode(['status' => 'forbidden']);
}
```

2. **Configurar Nginx para o webhook:**

Adicione ao arquivo de configuração do Nginx:

```nginx
location /webhook/dash-financeiro {
    root /var/www;
    fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root/webhooks/dash-financeiro.php;
    include fastcgi_params;
}
```

### Opção C: GitHub Actions (Deploy Automático)

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Server

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        cd cession-insight
        npm install
    
    - name: Build
      run: |
        cd cession-insight
        npm run build
    
    - name: Deploy to server
      uses: appleboy/scp-action@master
      with:
        host: 209.145.55.74
        username: root
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        source: "cession-insight/dist/*"
        target: "/var/www/dash.gruponitatori.com.br/"
```

## 🔄 Fluxo Completo de Atualização

### 1. Fazer Mudanças Locais

```bash
# Editar arquivos...
# Testar localmente: npm run dev
```

### 2. Commit e Push

```bash
git add .
git commit -m "Descrição das mudanças"
git push
```

### 3. Deploy Automático

**Se usar webhook:**
- O webhook é acionado automaticamente
- O servidor faz pull e rebuild

**Se usar GitHub Actions:**
- A action é executada automaticamente
- Build e deploy acontecem automaticamente

**Se usar manualmente:**
```bash
ssh root@209.145.55.74
cd /var/www/dash-financeiro
git pull
cd cession-insight
npm run build
cp -r dist/* /var/www/dash.gruponitatori.com.br/
```

## 📋 Comandos Git Úteis

```bash
# Ver status dos arquivos
git status

# Ver diferenças
git diff

# Ver histórico
git log --oneline

# Desfazer mudanças não commitadas
git checkout -- arquivo.ts

# Desfazer último commit (mantém arquivos)
git reset --soft HEAD~1

# Ver branches
git branch

# Criar nova branch
git checkout -b nova-feature

# Voltar para main
git checkout main

# Mesclar branch
git merge nova-feature
```

## 🔐 Segurança: O que NÃO commitar

Verifique se o `.gitignore` tem:

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

**IMPORTANTE:** As credenciais do Monday.com e Supabase estão hardcoded no código. Para produção:

1. **Opção 1:** Manter como está (funciona, mas não é ideal)
2. **Opção 2:** Usar variáveis de ambiente e não commitar o `.env`

## 🎯 Workflow Recomendado

```
1. Fazer mudanças locais
   ↓
2. Testar localmente (npm run dev)
   ↓
3. git add .
   ↓
4. git commit -m "mensagem"
   ↓
5. git push
   ↓
6. Deploy automático (webhook/Actions)
   OU
   Deploy manual no servidor
```

## 🔧 Configurar Webhook no GitHub

1. Vá em: **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL:** `https://dash.gruponitatori.com.br/webhook/dash-financeiro`
3. **Content type:** `application/json`
4. **Secret:** (use o mesmo secret do PHP)
5. **Events:** Selecione "Just the push event"
6. **Active:** ✓

## 📝 Checklist de Deploy

- [ ] Código testado localmente
- [ ] Commit feito
- [ ] Push realizado
- [ ] Webhook configurado (se usar)
- [ ] Deploy executado no servidor
- [ ] Site funcionando
- [ ] Testar criação de usuário
- [ ] Testar login
- [ ] Verificar dados do Monday.com


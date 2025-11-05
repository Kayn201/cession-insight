# 🚀 Guia de Deploy - Dashboard Financeiro

## 📋 Pré-requisitos no Servidor

1. **Node.js** (versão 18 ou superior)
2. **Nginx** ou **Apache** instalado
3. **SSH** acesso ao servidor
4. **Git** instalado (ou você pode usar SCP/SFTP)

## 🛠️ Passo 1: Build do Projeto Local

```bash
cd cession-insight
npm install
npm run build
```

Isso criará uma pasta `dist/` com os arquivos otimizados para produção.

## 📤 Passo 2: Enviar Arquivos para o Servidor

### Opção A: Usando SCP

```bash
# Do seu computador local
cd cession-insight
scp -r dist/* root@209.145.55.74:/var/www/dash.gruponitatori.com.br/
```

### Opção B: Usando Git (Recomendado)

1. **No servidor:**
```bash
ssh root@209.145.55.74
cd /var/www
git clone seu-repositorio-git dash-financeiro
cd dash-financeiro/cession-insight
npm install
npm run build
```

## 🔧 Passo 3: Configurar Nginx

Crie o arquivo de configuração do Nginx:

```bash
sudo nano /etc/nginx/sites-available/dash.gruponitatori.com.br
```

Cole o seguinte conteúdo:

```nginx
server {
    listen 80;
    server_name dash.gruponitatori.com.br;
    
    # Redirecionar HTTP para HTTPS (opcional, mas recomendado)
    # return 301 https://$server_name$request_uri;

    root /var/www/dash.gruponitatori.com.br;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache de assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
```

### Se quiser usar HTTPS (Recomendado):

```nginx
server {
    listen 80;
    server_name dash.gruponitatori.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dash.gruponitatori.com.br;

    ssl_certificate /etc/letsencrypt/live/dash.gruponitatori.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dash.gruponitatori.com.br/privkey.pem;

    root /var/www/dash.gruponitatori.com.br;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
```

## 📝 Passo 4: Configurar o Servidor

### 1. Criar diretório no servidor:

```bash
ssh root@209.145.55.74
mkdir -p /var/www/dash.gruponitatori.com.br
chown -R www-data:www-data /var/www/dash.gruponitatori.com.br
```

### 2. Ativar o site no Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/dash.gruponitatori.com.br /etc/nginx/sites-enabled/
sudo nginx -t  # Testar configuração
sudo systemctl reload nginx
```

### 3. Copiar arquivos build:

```bash
# Copiar arquivos da pasta dist/ para o diretório do servidor
cp -r dist/* /var/www/dash.gruponitatori.com.br/
```

## 🔐 Passo 5: Configurar HTTPS (Opcional mas Recomendado)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d dash.gruponitatori.com.br

# O Certbot vai configurar automaticamente o Nginx
```

## 🔄 Passo 6: Script de Deploy Automático

Crie um script `deploy.sh` para facilitar futuros deploys:

```bash
#!/bin/bash

echo "🚀 Iniciando deploy..."

# Build local
echo "📦 Fazendo build..."
npm run build

# Copiar para servidor
echo "📤 Enviando para servidor..."
scp -r dist/* root@209.145.55.74:/var/www/dash.gruponitatori.com.br/

echo "✅ Deploy concluído!"
```

Torne o script executável:
```bash
chmod +x deploy.sh
```

## 🐳 Alternativa: Usando Docker (Recomendado)

Se preferir usar Docker, crie um `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

E um `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 📦 Deploy Rápido - Passo a Passo Resumido

```bash
# 1. No seu computador local
cd cession-insight
npm run build

# 2. Enviar para servidor
scp -r dist/* root@209.145.55.74:/var/www/dash.gruponitatori.com.br/

# 3. No servidor (via SSH)
ssh root@209.145.55.74
sudo nano /etc/nginx/sites-available/dash.gruponitatori.com.br
# (Cole a configuração do Nginx acima)

sudo ln -s /etc/nginx/sites-available/dash.gruponitatori.com.br /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## ⚙️ Configurações Importantes

### Variáveis de Ambiente

O projeto já tem as credenciais do Supabase e Monday.com hardcoded, mas se quiser usar variáveis de ambiente:

1. Crie um arquivo `.env.production`:
```
VITE_SUPABASE_URL=https://lbldvpsjtsavgjoaycoz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_aqui
```

2. No `vite.config.ts`, certifique-se de que as variáveis estão configuradas corretamente.

## 🔍 Verificação

Após o deploy, verifique:

1. Acesse: `http://dash.gruponitatori.com.br` (ou `https://` se configurou SSL)
2. Verifique o console do navegador (F12) para erros
3. Teste a criação do primeiro usuário
4. Teste o login
5. Verifique se os dados do Monday.com estão carregando

## 🐛 Troubleshooting

### Erro 404 em rotas
- Certifique-se de que o Nginx tem `try_files $uri $uri/ /index.html;`

### Erro de CORS
- Verifique se as APIs (Monday.com, Supabase) permitem requisições do seu domínio

### Erro de conexão com Supabase
- Verifique se as credenciais estão corretas
- Verifique se o Supabase permite conexões do seu IP

### Arquivos não carregam
- Verifique permissões: `chmod -R 755 /var/www/dash.gruponitatori.com.br`
- Verifique se o usuário `www-data` tem acesso

## 📝 Notas Importantes

1. **Credenciais**: As credenciais do Monday.com e Supabase estão hardcoded no código. Para produção, considere usar variáveis de ambiente.

2. **Segurança**: 
   - Use HTTPS em produção
   - Configure firewall adequadamente
   - Mantenha o servidor atualizado

3. **Backup**: Faça backup regular dos dados do Supabase

4. **Monitoramento**: Considere configurar logs e monitoramento do servidor


#!/bin/bash

# Script de Deploy para dash.gruponitatori.com.br
# IP: 209.145.55.74

echo "🚀 Iniciando deploy do Dashboard Financeiro..."
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script dentro da pasta cession-insight"
    exit 1
fi

# Build do projeto
echo "📦 Fazendo build do projeto..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erro no build. Verifique os erros acima."
    exit 1
fi

echo "✅ Build concluído!"
echo ""

# Verificar se a pasta dist existe
if [ ! -d "dist" ]; then
    echo "❌ Erro: Pasta dist não encontrada após o build"
    exit 1
fi

echo "📤 Enviando arquivos para o servidor..."
echo "   Servidor: root@209.145.55.74"
echo "   Destino: /var/www/dash.gruponitatori.com.br/"
echo ""

# Copiar arquivos para o servidor
scp -r dist/* root@209.145.55.74:/var/www/dash.gruponitatori.com.br/

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy concluído com sucesso!"
    echo ""
    echo "🌐 Acesse: http://dash.gruponitatori.com.br"
    echo ""
    echo "📝 Próximos passos (se ainda não fez):"
    echo "   1. Configure o Nginx (veja DEPLOY.md)"
    echo "   2. Configure SSL/HTTPS (recomendado)"
    echo "   3. Teste o acesso ao dashboard"
else
    echo ""
    echo "❌ Erro ao enviar arquivos para o servidor"
    echo "   Verifique:"
    echo "   - Conexão SSH com o servidor"
    echo "   - Permissões de acesso"
    echo "   - Diretório de destino existe"
    exit 1
fi


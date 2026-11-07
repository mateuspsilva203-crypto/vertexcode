# VertexCode — site + banco de leads

## Como rodar no seu computador

1. Instale o Node.js (versão 18 ou mais nova): https://nodejs.org
2. Abra a pasta no terminal e rode:

```
npm install
```

3. Crie o arquivo `.env` copiando o `.env.example` e troque o `ADMIN_TOKEN` por uma senha grande:

```
copy .env.example .env      (Windows)
cp .env.example .env        (Mac/Linux)
```

4. Inicie:

```
npm start
```

- Site: http://localhost:3000
- Painel de leads: http://localhost:3000/admin.html (senha = `ADMIN_TOKEN`)
- Banco de dados: `data/leads.db` (SQLite, é só um arquivo; faça backup dele)

## Como funciona

Cliente preenche nome, empresa, contato e e-mail → o site grava no banco (`POST /api/leads`) → abre o WhatsApp com a mensagem pronta.
Se o banco estiver fora do ar, o cliente ainda é levado ao WhatsApp.

## Estrutura

```
public/        site (index.html, css, js, img) + admin.html
server.js      API e servidor
data/          banco SQLite (criado automaticamente)
.env           suas configurações (não compartilhe)
```

## Colocar no ar

O site só salva leads se estiver rodando junto do `server.js`. Hospedagem estática simples (só HTML) não grava no banco. Opções: uma VPS, Render, Railway, Fly.io ou similar com Node. Em hospedagens com disco temporário, aponte `DB_PATH` para um volume persistente.

Se o site ficar em um domínio e a API em outro, coloque a URL da API em `API_URL` no `public/js/main.js` e o domínio do site em `ALLOWED_ORIGINS` no `.env`.

## Usar outro banco (MySQL, Postgres, Supabase...)

Só a parte do `server.js` que usa `db.prepare(...)` precisa ser trocada; o site e o formulário continuam iguais.

## Segurança já incluída

Validação no servidor, consultas parametrizadas, limite de 5 envios por IP a cada 10 min, campo isca contra robôs, listagem protegida por senha e painel que não executa HTML digitado pelos clientes.
Use HTTPS em produção, pois a senha do painel trafega no cabeçalho.

# Lista de Presentes - Cha de Cozinha

Aplicacao simples com frontend estatico servido por Nginx e API Node.js para integrar com Google Sheets.

## Regras implementadas

- Leitura da planilha `Sheet1`, colunas A:C
- Ignora cabecalho (dados a partir da linha 2)
- Exibe no frontend apenas presentes disponiveis:
  - coluna A preenchida
  - coluna B vazia
  - coluna C vazia ou `FALSE`
- Ao reservar:
  - grava nome na coluna B
  - grava `TRUE` na coluna C
  - presente deixa de aparecer na lista

## Executar com Docker (container unico)

Na raiz do projeto:

```bash
docker build -t lista-cha .
docker run --rm --env-file .env -p 8080:80 lista-cha
```

Abra no navegador: `http://localhost:8080`

## Executar com Docker Compose

Na raiz do projeto:

```bash
docker compose up --build
```

Para rodar em background:

```bash
docker compose up --build -d
```

Para parar:

```bash
docker compose down
```

## Variaveis de ambiente

Arquivo `.env` (ja existente):

```env
SHEETS_ID=...
```

Opcional:

- `SHEET_NAME` (padrao `Sheet1`)
- `SERVICE_ACCOUNT_FILE` (caminho do json de credencial)

## Endpoints

- `GET /api/health`
- `GET /api/gifts`
- `POST /api/reserve`

Payload de reserva:

```json
{
  "gift": "Nome do presente",
  "name": "Seu nome"
}
```

## Observacao de seguranca

A chave de service account nao deve ser versionada. O `.gitignore` foi configurado para isso.

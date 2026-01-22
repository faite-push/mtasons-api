# MTA Sons - API

API backend para a aplicação MTA Sons, responsável pelo processamento de áudio, download de vídeos do YouTube e gerenciamento de streams.

## Tecnologias

- Node.js
- Express
- FFmpeg (Processamento de áudio)
- yt-dlp (Download de vídeos)
- SQLite (via better-sqlite3)

## Pré-requisitos

- Node.js instalado
- FFmpeg instalado no sistema (ou configurado automaticamente pelo script)
- yt-dlp (gerenciado automaticamente)

## Instalação

1. Clone o repositório
2. Entre na pasta da API:
   ```bash
   cd mtasons-api
   ```
3. Instale as dependências:
   ```bash
   npm install
   # ou
   pnpm install
   ```

## Configuração

Copie o arquivo `.env.example` para `.env` e ajuste as variáveis conforme necessário:

```bash
cp .env.example .env
```

### Variáveis de Ambiente

- `PORT`: Porta do servidor (Padrão: 5000)
- `FRONTEND_URL`: URL do frontend para CORS
- `API_BASE_URL`: URL base pública da API
- `STORAGE_PATH`: Caminho para salvar os arquivos de áudio
- `API_SECRET`: Chave secreta para autenticação interna

## Executando

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

## Funcionalidades Principais

- **Busca de Vídeos**: Integração com YouTube API e fallback para yt-dlp
- **Download e Conversão**: Download de vídeos e conversão para MP3
- **Streaming de Áudio**: Endpoint otimizado com suporte a Range Requests (`/stream/:filename`)
- **Processamento de Áudio**: Efeitos de Bass Boost e Volume Boost
- **Playlists**: Gerenciamento de playlists e top hits

## Estrutura de Pastas

- `/src`: Código fonte
  - `/controllers`: Lógica dos endpoints
  - `/routes`: Definição de rotas
  - `/utils`: Utilitários (YouTube dl, FFmpeg)
- `/storage`: Arquivos de áudio processados (ignorada no git)
- `/ffmpeg`: Binários do FFmpeg (se baixados localmente)

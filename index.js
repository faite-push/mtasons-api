require("dotenv").config();
const express = require('express');
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const app = express();

const { verificaAtualizacaoYtDlp, BASE_STORAGE_PATH } = require('./src/utils/youtube.utils');
const { updatePlaylist, incrementViewsMiddleware } = require('./src/controllers/music.controller');

process.on("uncaughtException", (err) => {
  console.error("[ERRO DETECTADO]: " + err.message);
  console.error("Stack Trace: " + err.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  if (reason instanceof Error) {
    console.error("[ERRO DETECTADO]:", reason.message);
    console.error("Stack Trace: " + reason.stack);
  } else {
    console.error("[ERRO DETECTADO]:", reason);
  }
});

app.use(cors());
app.use(express.json({ limit: '90mb' }));
app.use(express.urlencoded({ limit: '90mb', extended: true }));

console.log("[STATIC] Configurado para servir arquivos de:", path.resolve(BASE_STORAGE_PATH));

app.get('/stream/:filename', (req, res) => {
  const filePath = path.join(BASE_STORAGE_PATH, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
      'Access-Control-Allow-Origin': '*',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
      'Access-Control-Allow-Origin': '*',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Mantemos o static como fallback/debug
app.use('/msc', (req, res, next) => {
  console.log(`[STATIC REQUEST] ${req.method} ${req.url}`);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Range");
  next();
}, express.static(BASE_STORAGE_PATH, {
  setHeaders: (res, filePath) => {
    res.setHeader('Accept-Ranges', 'bytes');
    if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }
  }
}));

app.use(incrementViewsMiddleware);

const routesDir = path.join(__dirname, "src", "routes");
for (const file of fs.readdirSync(routesDir)) {
  if (!file.endsWith(".js")) continue;
  const archive = require(path.join(routesDir, file));
  app.use("/", archive);
};

const startSystem = async () => {
  await verificaAtualizacaoYtDlp();

  await updatePlaylist();

  setInterval(updatePlaylist, 5 * 60 * 1000);
  setInterval(verificaAtualizacaoYtDlp, 7 * 24 * 60 * 60 * 1000);
};

try {
  app.listen({
    host: "0.0.0.0",
    port: process.env.PORT || 3000,
  }, async () => {
    console.log(`"[API]" - Server running on port ${process.env.PORT || 3000}`);
    await startSystem();
  });
} catch (err) {
  console.error("Erro ao iniciar servidor:", err);
}
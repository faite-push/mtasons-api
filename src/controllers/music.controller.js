const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { getVideoInfo, searchYouTube, downloadVideoAsMP3, BASE_STORAGE_PATH, INTROS_DIR } = require('../utils/youtube.utils');
const { Innertube } = require('youtubei.js');

const NOME1 = 'mtasons';
const NOME2 = 'mtasons-com-br';
const DOWNLOAD_CACHE = new Map();
const PLAYLIST_PATH = path.join(BASE_STORAGE_PATH, 'playlist.json');
const VIEWS_FILE_PATH = path.join(BASE_STORAGE_PATH, 'views.json');

const getApiUrl = () => process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
function readViews() {
    if (fs.existsSync(VIEWS_FILE_PATH)) {
        try {
            const data = fs.readFileSync(VIEWS_FILE_PATH, 'utf-8');
            return JSON.parse(data);
        } catch (e) { return { totalViews: 0 }; }
    }
    return { totalViews: 0 };
}
function saveViews(views) {
    const dir = path.dirname(VIEWS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VIEWS_FILE_PATH, JSON.stringify(views), 'utf-8');
}

exports.health = async (req, res) => {
    res.json({
        status: "ok",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        views: readViews().totalViews
    });
};

exports.search = async (req, res) => {
    const { src } = req.query;
    if (!src) return res.status(400).send({ error: "Parâmetro 'src' é obrigatório" });

    
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = src.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    try {
        if (videoId) {
            const videoInfo = await getVideoInfo(videoId);
            if (videoInfo) return res.send([videoInfo]);
        }

        const videos = await searchYouTube(src);
        const filtered = videos.filter(v => v.duration < 900);
        res.send(filtered);

    } catch (error) {
        console.error("Erro na busca:", error);
        res.status(500).send({ error: "Falha na busca", details: error.message });
    }
};

exports.play = async (req, res) => {
    const { id, retry } = req.query;
    if (!id) return res.status(400).send({ error: "Parâmetro 'id' é obrigatório" });

    try {
        if (retry && DOWNLOAD_CACHE.has(id)) {
            DOWNLOAD_CACHE.delete(id);
            console.log(`[Retry] Cache limpo para o vídeo ${id}`);
        }

        const apiUrl = getApiUrl();
        const mp3URL = await downloadVideoAsMP3(id, NOME1, NOME2, apiUrl);
        const fileName = `${NOME1}-${id}-${NOME2}.mp3`;
        const filePath = path.join(BASE_STORAGE_PATH, fileName);

        if (!fs.existsSync(filePath)) throw new Error("Arquivo não encontrado no sistema de arquivos");

        const stats = fs.statSync(filePath);
        if (stats.size < 10240) {
            fs.unlinkSync(filePath);
            throw new Error("Arquivo corrompido (tamanho inválido)");
        }

        res.send({
            success: true,
            url: mp3URL,
            filename: fileName,
            filesize: stats.size,
            downloadUrl: `${apiUrl}/download?id=${id}`,
            info: {
                videoId: id,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[PLAY] Erro para o vídeo ${id}:`, error);
        res.status(500).send({
            success: false,
            error: "Falha no processamento",
            message: error.message,
            retryUrl: `${getApiUrl()}/play?id=${id}&retry=true`,
            alternativeUrl: `https://www.youtube.com/watch?v=${id}`,
            timestamp: new Date().toISOString()
        });
    }
};

exports.download = async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).send({ error: "Parâmetro 'id' é obrigatório" });

    const fileName = `${NOME1}-${id}-${NOME2}.mp3`;
    const filePath = path.join(BASE_STORAGE_PATH, fileName);

    try {
        if (!fs.existsSync(filePath)) throw new Error("Arquivo não encontrado");

        const stats = fs.statSync(filePath);
        if (stats.size < 10240) throw new Error("Arquivo inválido");

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error(`[DOWNLOAD] Erro ao servir ${fileName}:`, error);
        res.status(404).send({
            success: false,
            error: "Arquivo não disponível",
            message: error.message,
            playUrl: `${getApiUrl()}/play?id=${id}`
        });
    }
};

exports.addBass = async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).send({ error: "Parâmetro 'id' é obrigatório" });

    try {
        const outputFile = `${NOME1}-${id}-${NOME2}-grave.mp3`;
        const outputPathFull = path.join(BASE_STORAGE_PATH, outputFile);
        const outputURL = `${getApiUrl()}/msc/${outputFile}`;

        if (fs.existsSync(outputPathFull)) {
            return res.send({ mp3mix: outputURL, message: "Arquivo já existe, retornando do cache" });
        }

        res.send({ mp3mix: outputURL, message: "Processando em segundo plano" });

        (async () => {
            try {
                const originalFile = `${NOME1}-${id}-${NOME2}.mp3`;
                const originalPath = path.join(BASE_STORAGE_PATH, originalFile);

                if (!fs.existsSync(originalPath)) {
                    await downloadVideoAsMP3(id, NOME1, NOME2, getApiUrl());
                }

                if (fs.existsSync(outputPathFull)) return;

                const tempOutputPath = path.join(BASE_STORAGE_PATH, `temp-grave-${id}.mp3`);
                await new Promise((resolve, reject) => {
                    ffmpeg(originalPath)
                        .audioFilter("equalizer=f=40:width_type=h:width=100:g=20,volume=12dB")
                        .on("error", reject)
                        .on("end", async () => {
                            if (fs.existsSync(tempOutputPath)) {
                                fs.renameSync(tempOutputPath, outputPathFull);
                                console.log(`[Grave] Processamento concluído para ${id}`);
                                resolve();
                            } else {
                                reject(new Error("Arquivo processado não foi criado"));
                            }
                        })
                        .save(tempOutputPath);
                });
            } catch (error) {
                console.error("[Grave] Erro no processamento:", error);
            }
        })();

    } catch (error) {
        console.error("[Grave] Erro no endpoint:", error);
    }
};

exports.addVolume = async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).send({ error: "Parâmetro 'id' é obrigatório" });

    try {
        const outputFile = `${NOME1}-${id}-${NOME2}-volume.mp3`;
        const outputPathFull = path.join(BASE_STORAGE_PATH, outputFile);
        const outputURL = `${getApiUrl()}/msc/${outputFile}`;

        if (fs.existsSync(outputPathFull)) {
            return res.send({ mp3mix: outputURL, message: "Arquivo já existe, retornando do cache" });
        }

        res.send({ mp3mix: outputURL, message: "Processando em segundo plano" });

        (async () => {
            try {
                const originalFile = `${NOME1}-${id}-${NOME2}.mp3`;
                const originalPath = path.join(BASE_STORAGE_PATH, originalFile);

                if (!fs.existsSync(originalPath)) {
                    await downloadVideoAsMP3(id, NOME1, NOME2, getApiUrl());
                }
                if (fs.existsSync(outputPathFull)) return;

                const tempOutputPath = path.join(BASE_STORAGE_PATH, `temp-volume-${id}.mp3`);
                await new Promise((resolve, reject) => {
                    ffmpeg(originalPath)
                        .audioFilter("volume=12dB")
                        .on("error", reject)
                        .on("end", () => {
                            if (fs.existsSync(tempOutputPath)) {
                                fs.renameSync(tempOutputPath, outputPathFull);
                                console.log(`[Volume] Processamento concluído para ${id}`);
                                resolve();
                            } else {
                                reject(new Error("Arquivo processado não foi criado"));
                            }
                        })
                        .save(tempOutputPath);
                });
            } catch (error) {
                console.error("[Volume] Erro no processamento:", error);
            }
        })();

    } catch (error) {
        console.error("[Volume] Erro no endpoint:", error);
    }
};

exports.getPlaylist = async (req, res) => {
    try {
        if (!fs.existsSync(PLAYLIST_PATH)) {
            await exports.updatePlaylist();
        }
        const data = fs.readFileSync(PLAYLIST_PATH, "utf-8");
        res.send(JSON.parse(data));
    } catch (error) {
        res.status(500).send({ error: "Falha ao ler playlist", message: error.message });
    }
};

exports.updatePlaylist = async () => {
    try {
        const youtube = await Innertube.create();
        const playlistId = "RDCLAK5uy_lyO8CdV-pHd2Vu54Qzf-cFYvKJB4GiILY";
        const playlist = await youtube.getPlaylist(playlistId);

        if (!playlist || !playlist.videos) throw new Error("Falha ao obter videos da playlist");

        const videos = playlist.videos;
        const results = videos.slice(0, 20).map(video => {
            const title = video.title.text || (video.title.runs?.map(run => run.text).join(" ") || "Título desconhecido");
            const duration = video.duration?.seconds || (video.duration_seconds || 0);
            const thumbUrl = video.thumbnails[0]?.url || "";
            return {
                id: video.id,
                title: title,
                author: video.author?.name || "Autor desconhecido",
                duration: duration,
                richThumb: thumbUrl
            };
        });

        const specificVideos = [
            {
                id: "eZRFaXl6n3E",
                title: "Seis - FECHADÃO COM BMR (prod.Magnão & Dj gui) BRASIL MUNDO REAL",
                author: "Magnao BMR",
                duration: 116,
                richThumb: "https://i.ytimg.com/vi/eZRFaXl6n3E/hqdefault.jpg"
            },
            {
                id: "9vusWQYVoZc",
                title: "COMO BAIXAR E ENTRAR NO TS3 DO BMR ( E SE RECRUTAR EM ALGUMA ORGs ) 2025 ( BRASIL MUNDO REAL ) MTA",
                author: "Magnao BMR",
                duration: 621,
                richThumb: "https://i.ytimg.com/vi/9vusWQYVoZc/hqdefault.jpg"
            }
        ];

        const allResults = [...specificVideos, ...results];

        const dir = path.dirname(PLAYLIST_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(PLAYLIST_PATH, JSON.stringify(allResults, null, 2), "utf-8");
        console.log(`[Playlist] Atualizada (${new Date().toLocaleTimeString()})`);
    } catch (error) {
        console.error("[Playlist] Erro ao atualizar:", error.message);
    }
};

exports.incrementViewsMiddleware = (req, res, next) => {
    if (req.url !== '/incrementViews') {
        try {
            const views = readViews();
            views.totalViews += 1;
            saveViews(views);
        } catch (error) {
            console.error('Erro ao incrementar visualizações:', error);
        }
    }
    next();
};

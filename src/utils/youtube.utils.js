const fs = require('fs');
const https = require('https');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const { Client } = require('youtubei');
const StreamZip = require('node-stream-zip');


const youtube = new Client();
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0",
];
const GEO_COUNTRIES = ['US', 'BR', 'DE', 'GB', 'CA'];


const BASE_STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');
const YT_DL_PATH = path.join(__dirname, '../../yt-dlp.exe');
const FFMPEG_DIR = path.join(__dirname, '../../ffmpeg');

const FFMPEG_PATH = path.join(FFMPEG_DIR, 'bin', 'ffmpeg.exe');
const COOKIES_PATH = path.join(__dirname, '../../cookies.txt');
const INTROS_DIR = path.join(__dirname, '../../intros');


if (!fs.existsSync(BASE_STORAGE_PATH)) {
    fs.mkdirSync(BASE_STORAGE_PATH, { recursive: true });
}


if (fs.existsSync(FFMPEG_PATH)) {
    ffmpeg.setFfmpegPath(FFMPEG_PATH);
}

function getProxyConfig(currentProxyUrl) {
    if (!currentProxyUrl) {
        return { http: undefined, https: undefined };
    }
    return { http: currentProxyUrl, https: currentProxyUrl };
}

function checkCookiesFile() {
    try {
        if (!fs.existsSync(COOKIES_PATH)) return false;
        const content = fs.readFileSync(COOKIES_PATH, 'utf8');
        const requiredDomains = ['youtube.com', 'google.com'];
        const requiredCookies = ['LOGIN_INFO', 'YSC', 'PREF'];
        return requiredDomains.some(domain => content.includes(domain)) &&
            requiredCookies.every(cookie => content.includes(cookie));
    } catch (error) {
        console.error("Erro ao verificar cookies:", error);
        return false;
    }
}

async function baixarArquivo(url, destino) {
    return new Promise((resolve, reject) => {
        const fazerDownload = (downloadUrl) => {
            const arquivo = fs.createWriteStream(destino);
            https.get(downloadUrl, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    return fazerDownload(response.headers.location);
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Falha ao baixar o arquivo (status code: ${response.statusCode})`));
                    return;
                }
                response.pipe(arquivo);
                arquivo.on('finish', () => {
                    arquivo.close();
                    resolve();
                });
                arquivo.on('error', (err) => {
                    fs.unlink(destino, () => { });
                    reject(err);
                });
            }).on('error', (err) => reject(err));
        };
        fazerDownload(url);
    });
}

function unzipWithPowershell(source, dest) {
    return new Promise((resolve, reject) => {
        const command = `powershell -Command "Expand-Archive -Path '${source}' -DestinationPath '${dest}' -Force"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Erro ao extrair zip com PowerShell: ${error.message}`);
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

async function baixarEExtrairFFmpeg() {





    if (fs.existsSync(FFMPEG_PATH)) return;


    if (fs.existsSync(FFMPEG_DIR)) {
        const findFile = (dir, filename) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    const result = findFile(fullPath, filename);
                    if (result) return result;
                } else if (file === filename) {
                    return fullPath;
                }
            }
            return null;
        };
        const found = findFile(FFMPEG_DIR, 'ffmpeg.exe');
        if (found) {



        }
    }

    console.log('[FFMPEG] FFMPEG não encontrado. Iniciando download...');
    const zipPath = path.join(__dirname, '../../ffmpeg.zip');


    const url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

    try {
        await baixarArquivo(url, zipPath);
        console.log('[FFMPEG] Download concluído. Extraindo...');

        if (!fs.existsSync(FFMPEG_DIR)) fs.mkdirSync(FFMPEG_DIR, { recursive: true });

        await unzipWithPowershell(zipPath, FFMPEG_DIR);

        fs.unlinkSync(zipPath);
        console.log('[FFMPEG] Extração concluída com sucesso!');


        const files = fs.readdirSync(FFMPEG_DIR);
        const folderName = files.find(f => f.toLowerCase().includes('ffmpeg') && fs.statSync(path.join(FFMPEG_DIR, f)).isDirectory());

        if (folderName) {
            const binDir = path.join(FFMPEG_DIR, folderName, 'bin');

            console.log(`[FFMPEG] Localizado em: ${binDir}`);
        }

    } catch (error) {
        console.error('[FFMPEG] Erro ao baixar/instalar FFMPEG:', error);
    }
}


function getFFmpegBinPath() {
    if (fs.existsSync(FFMPEG_PATH)) return path.dirname(FFMPEG_PATH);

    if (fs.existsSync(FFMPEG_DIR)) {

        const queue = [FFMPEG_DIR];
        while (queue.length > 0) {
            const current = queue.shift();
            try {
                const entries = fs.readdirSync(current, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(current, entry.name);
                    if (entry.isDirectory()) {
                        queue.push(fullPath);
                    } else if (entry.name === 'ffmpeg.exe') {
                        return path.dirname(fullPath);
                    }
                }
            } catch (e) { }
        }
    }
    return null;
}

async function obterUltimaVersaoYtDlp() {
    return new Promise((resolve) => {
        https.get('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/vnd.github.v3+json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.tag_name.replace(/^v/, ''));
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function verificaAtualizacaoYtDlp() {

    await baixarEExtrairFFmpeg();

    console.log('[YT-DLP] Verificando versão atual...');
    let versaoAtual = null;
    try {
        if (fs.existsSync(YT_DL_PATH)) {
            versaoAtual = execSync(`"${YT_DL_PATH}" --version`).toString().trim();
            console.log(`[YT-DLP] Versão atual: ${versaoAtual}`);
        } else {
            console.log('[YT-DLP] Executável não encontrado.');
        }
    } catch (e) {
        console.warn('[YT-DLP] Erro ao verificar versão:', e.message);
    }

    console.log('[YT-DLP] Obtendo última versão do GitHub...');
    const ultimaVersao = await obterUltimaVersaoYtDlp();
    if (!ultimaVersao) {
        console.error('[YT-DLP] Falha ao obter a versão mais recente.');
        return;
    }

    if (versaoAtual !== ultimaVersao) {
        console.log(`[YT-DLP] Atualização disponível: ${versaoAtual || 'nenhuma'} → ${ultimaVersao}`);
        const urlDownload = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
        await baixarArquivo(urlDownload, YT_DL_PATH);
        console.log('[YT-DLP] yt-dlp.exe atualizado com sucesso!');
    } else {
        console.log('[YT-DLP] Já está na versão mais recente.');
    }
}


function runYtDlp(url, flags = {}) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(YT_DL_PATH)) {
            return reject(new Error(`Youtube-dl binary not found at ${YT_DL_PATH}`));
        }

        const args = [url];

        for (const [key, value] of Object.entries(flags)) {
            if (key === 'execPath') continue;
            const flag = '--' + key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

            if (value === true) {
                args.push(flag);
            } else if (value !== undefined && value !== false && value !== null) {
                args.push(flag, value.toString());
            }
        }


        const ffmpegBinDir = getFFmpegBinPath();
        if (ffmpegBinDir) {
            args.push('--ffmpeg-location', ffmpegBinDir);
        }

        const child = spawn(YT_DL_PATH, args);
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                if (flags.dumpSingleJson && stdout) {
                    try {
                        resolve(JSON.parse(stdout));
                    } catch (e) {
                        resolve({ _raw: stdout });
                    }
                } else {
                    resolve(stdout);
                }
            } else {
                reject(new Error(`Process failed with code ${code}: ${stderr}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

async function getVideoInfo(videoId) {
    let videoInfo = null;
    try {
        const result = await runYtDlp(`https://www.youtube.com/watch?v=${videoId}`, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificates: true,
            forceIpv4: true,
            socketTimeout: 30000,
            referer: "https://www.youtube.com/",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        });
        if (result) {
            videoInfo = {
                id: videoId,
                title: result.title || "Título desconhecido",
                author: result.uploader || "Canal desconhecido",
                authorId: result.uploader_id || "",
                duration: result.duration ? Math.floor(result.duration) : 0,
                richThumb: result.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                views: result.view_count || 0
            };
        }
    } catch (error) {
        console.error("Erro no yt-dlp simplificado:", error.message);
    }

    if (!videoInfo) {
        try {
            const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const html = await response.text();
            const titleMatch = html.match(/<meta name="title" content="([^"]*)"/);
            const channelMatch = html.match(/<link itemprop="name" content="([^"]*)"/);
            const durationMatch = html.match(/"approxDurationMs":"(\d+)"/);

            videoInfo = {
                id: videoId,
                title: titleMatch ? titleMatch[1] : "Título desconhecido",
                author: channelMatch ? channelMatch[1] : "Canal desconhecido",
                authorId: "",
                duration: durationMatch ? Math.floor(parseInt(durationMatch[1]) / 1000) : 0,
                richThumb: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                views: 0
            };
        } catch (error) {
            console.error("Erro no scraping direto:", error.message);
        }
    }
    return videoInfo;
}

async function searchYouTube(query, cache) {
    const originalQuery = query;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const searchResults = await youtube.search(originalQuery, {
            type: "video",
            limit: 20,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!searchResults.items || searchResults.items.length === 0) {
            console.warn("Nenhum resultado do youtubei, usando fallback com yt-dlp...");
            return await fallbackWithYtDlp(originalQuery);
        }

        const queryWords = originalQuery.toLowerCase().split(" ").filter(word => word.length > 0);
        const videos = searchResults.items
            .filter(video => video && video.id && video.title)
            .map(video => ({
                id: video.id,
                title: video.title,
                author: video.channel?.name || "Canal desconhecido",
                authorId: video.channel?.id || "",
                duration: video.duration || 0,
                richThumb: video.thumbnails?.[0]?.url || "",
                views: video.viewCount || 0
            }))
            .filter(video => {
                const videoTitleLower = video.title.toLowerCase();
                return queryWords.some(word => videoTitleLower.includes(word));
            })
            .sort((a, b) => b.views - a.views);

        if (videos.length === 0) {
            return await fallbackWithYtDlp(originalQuery);
        }
        return videos;
    } catch (error) {
        console.error("Erro na busca com youtubei:", error);
        return await fallbackWithYtDlp(originalQuery);
    }
}

async function fallbackWithYtDlp(query) {
    try {
        const result = await runYtDlp(`ytsearch20:${query}`, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            preferFreeFormats: true,
            noCheckCertificates: true,
            cookies: checkCookiesFile() ? COOKIES_PATH : undefined
        });
        if (!result || !result.entries) return [];

        const queryWords = query.toLowerCase().split(" ").filter(w => w.length > 0);
        return result.entries.map(entry => ({
            id: entry.id,
            title: entry.title,
            author: entry.uploader || "Desconhecido",
            authorId: entry.uploader_id || "",
            duration: entry.duration || 0,
            richThumb: entry.thumbnail || "",
            views: entry.view_count || 0
        }))
            .filter(video => {
                const videoTitleLower = video.title.toLowerCase();
                return queryWords.some(word => videoTitleLower.includes(word));
            })
            .sort((a, b) => b.views - a.views);
    } catch (error) {
        console.error("Erro no fallback com yt-dlp:", error);
        return [];
    }
}

async function adicionarIntroducaoFixa(mp3FilePath, outputFilePath) {
    try {
        const absoluteMp3Path = path.resolve(mp3FilePath);
        const absoluteIntroDir = path.resolve(INTROS_DIR);
        const absoluteOutputPath = path.resolve(outputFilePath);

        if (!fs.existsSync(absoluteMp3Path)) throw new Error(`O arquivo de entrada "${absoluteMp3Path}" não existe.`);

        const introducaoPath = path.join(absoluteIntroDir, '1.mp3');


        const ffmpegBinDir = getFFmpegBinPath();
        const ffmpegExecutable = ffmpegBinDir ? path.join(ffmpegBinDir, 'ffmpeg.exe') : 'ffmpeg';

        if (!fs.existsSync(introducaoPath)) {
            console.warn(`Introdução não encontrada em ${introducaoPath}. Ignorando adição de intro.`);

            await new Promise(resolve => setTimeout(resolve, 500));
            try {
                fs.renameSync(absoluteMp3Path, absoluteOutputPath);
            } catch (err) {

                if (err.code === 'EBUSY') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    fs.copyFileSync(absoluteMp3Path, absoluteOutputPath);
                    setTimeout(() => {
                        try { fs.unlinkSync(absoluteMp3Path); } catch (e) { }
                    }, 2000);
                } else {
                    throw err;
                }
            }
            return;
        }

        const command = `"${ffmpegExecutable}" -y -i "${introducaoPath}" -i "${absoluteMp3Path}" -filter_complex "concat=n=2:v=0:a=1" -codec:a libmp3lame -q:a 4 "${absoluteOutputPath}"`;
        await new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Erro ao executar ffmpeg: ${error.message}`);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });


        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            fs.unlinkSync(absoluteMp3Path);
        } catch (err) {
            if (err.code === 'EBUSY') {

                setTimeout(() => {
                    try { fs.unlinkSync(absoluteMp3Path); } catch (e) { }
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Erro ao adicionar introdução:', error);
        throw error;
    }
}

function getProxyConfig(currentProxyUrl) {
    if (!currentProxyUrl) {
        return { http: undefined, https: undefined };
    }
    return {
        http: currentProxyUrl,
        https: currentProxyUrl,
    };
}

async function downloadVideoAsMP3(videoId, nome1, nome2, apiUrl) {
    const fileName = `${nome1}-${videoId}-${nome2}.mp3`;
    const filePath = path.join(BASE_STORAGE_PATH, fileName);

    const tempFilePath = path.join(BASE_STORAGE_PATH, `${nome1}-${videoId}-${nome2}-temp.mp3`);


    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > 10240) {
            console.log(`[Download] Arquivo ${fileName} já existe e é válido. Retornando do cache.`);
            const cleanApiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
            return `${cleanApiUrl}/stream/${fileName}`;
        }
        console.log(`[Download] Arquivo ${fileName} existe mas está corrompido ou muito pequeno. Removendo.`);
        fs.unlinkSync(filePath);
    }
    if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
    }



    const PROXY_LIST = process.env.PROXY_URL
        ? [`http://${process.env.PROXY_URL}`]
        : [null];

    const headers = {
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'X-Requested-With': 'XMLHttpRequest',
    };

    let lastOverallError = null;
    let proxyAttemptSuccessful = false;


    for (const currentProxyUrl of PROXY_LIST) {
        const proxyConfig = getProxyConfig(currentProxyUrl);
        const proxyLog = currentProxyUrl ? `com proxy: ${currentProxyUrl}` : "SEM proxy";
        console.log(`[Download] Tentando ${proxyLog}`);

        const downloadStrategies = [
            {
                name: "Padrão (Cookies/Proxy)",
                options: (userAgent, geoCountry) => ({
                    extractAudio: true,
                    audioFormat: "mp3",
                    audioQuality: "192K",
                    format: "bestaudio/best",
                    noCheckCertificates: true,
                    forceIpv4: true,
                    socketTimeout: 30000,
                    retries: 2,
                    referer: "https://www.youtube.com/",
                    userAgent: userAgent,
                    output: tempFilePath,
                    cookies: checkCookiesFile() ? COOKIES_PATH : undefined,
                    concurrentFragments: 5,
                    fragmentRetries: 5,
                    bufferSize: "1024K",


                    proxy: proxyConfig.http
                })
            },
            {
                name: "Geo-Bypass (Sem Cookies)",
                options: (userAgent, geoCountry) => ({
                    extractAudio: true,
                    audioFormat: "mp3",
                    audioQuality: "192K",
                    format: "bestaudio/best",
                    noCheckCertificates: true,
                    forceIpv4: true,
                    socketTimeout: 30000,
                    retries: 2,
                    referer: "https://www.youtube.com/",
                    userAgent: userAgent,
                    output: tempFilePath,
                    proxy: proxyConfig.http,
                    geoBypass: true,
                    geoBypassCountry: geoCountry,
                    concurrentFragments: 5,
                    fragmentRetries: 5,
                    bufferSize: "1024K",
                })
            },
            {
                name: "Sem Proxy (Com Cookies)",
                options: (userAgent, geoCountry) => ({
                    extractAudio: true,
                    audioFormat: "mp3",
                    audioQuality: "192K",
                    format: "bestaudio/best",
                    noCheckCertificates: true,
                    forceIpv4: true,
                    socketTimeout: 30000,
                    retries: 2,
                    referer: "https://www.youtube.com/",
                    userAgent: userAgent,
                    output: tempFilePath,
                    cookies: checkCookiesFile() ? COOKIES_PATH : undefined,

                    geoBypass: !!geoCountry,
                    geoBypassCountry: geoCountry || undefined,
                    concurrentFragments: 5,
                    fragmentRetries: 5,
                    bufferSize: "1024K",
                })
            },
            {
                name: "Formato Genérico + FFmpeg",
                options: (userAgent, geoCountry) => ({
                    extractAudio: true,
                    format: "bestaudio",
                    noCheckCertificates: true,
                    forceIpv4: true,
                    socketTimeout: 45000,
                    retries: 3,
                    referer: "https://www.youtube.com/",
                    userAgent: userAgent,

                    output: tempFilePath.replace(".mp3", ".%(ext)s"),
                    cookies: checkCookiesFile() ? COOKIES_PATH : undefined,
                    proxy: proxyConfig.http,
                    geoBypass: !!geoCountry,
                    geoBypassCountry: geoCountry || undefined,
                    concurrentFragments: 8,
                    fragmentRetries: 8,
                    bufferSize: "2048K",
                }),
                postProcess: true
            }
        ];

        let lastStrategyError = null;


        for (const strategy of downloadStrategies) {
            const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
            const geoCountry = GEO_COUNTRIES[Math.floor(Math.random() * GEO_COUNTRIES.length)];


            const currentOptions = {
                ...strategy.options(userAgent, geoCountry),


            };

            console.log(`[Download] Tentando estratégia: ${strategy.name} (UA: ${userAgent.substring(0, 20)}..., Geo: ${geoCountry || 'N/A'}) ${proxyLog}`);


            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);


            const genericTempPath = tempFilePath.replace(".mp3", ".");
            try {
                const filesInOutput = fs.readdirSync(BASE_STORAGE_PATH);
                const possibleGenericFile = filesInOutput.find(f =>
                    f.startsWith(path.basename(genericTempPath).slice(0, -1)) &&
                    f !== path.basename(filePath) &&
                    f !== path.basename(tempFilePath)
                );
                if (possibleGenericFile) {
                    fs.unlinkSync(path.join(BASE_STORAGE_PATH, possibleGenericFile));
                }
            } catch (err) { }

            try {
                const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
                await runYtDlp(videoURL, currentOptions);
                console.log(`[Download] Estratégia "${strategy.name}" bem-sucedida para ${videoId} ${proxyLog}.`);

                let finalDownloadedPath = tempFilePath;

                if (strategy.postProcess) {

                    const files = fs.readdirSync(BASE_STORAGE_PATH);

                    const baseNameNoExt = path.basename(tempFilePath, '.mp3');
                    const downloadedFile = files.find(f => f.startsWith(baseNameNoExt) && f !== path.basename(filePath));

                    if (downloadedFile) {
                        finalDownloadedPath = path.join(BASE_STORAGE_PATH, downloadedFile);
                        console.log(`[Download] Arquivo genérico baixado: ${finalDownloadedPath}`);
                    } else {
                        throw new Error("Arquivo genérico não encontrado após download.");
                    }


                    const tempMp3PathAfterConversion = path.join(BASE_STORAGE_PATH, `${nome1}-${videoId}-${nome2}-converted.mp3`);
                    console.log(`[Download] Convertendo ${finalDownloadedPath} para MP3: ${tempMp3PathAfterConversion}`);

                    await new Promise((resolve, reject) => {
                        ffmpeg(finalDownloadedPath)
                            .audioQuality(192)
                            .toFormat('mp3')
                            .on('error', (err) => {
                                console.error(`[Download] Erro na conversão FFmpeg: ${err.message}`);
                                reject(err);
                            })
                            .on('end', () => {
                                console.log(`[Download] Conversão FFmpeg concluída.`);
                                resolve();
                            })
                            .save(tempMp3PathAfterConversion);
                    });


                    try { fs.unlinkSync(finalDownloadedPath); } catch (e) { }
                    finalDownloadedPath = tempMp3PathAfterConversion;
                }

                if (!fs.existsSync(finalDownloadedPath)) {
                    throw new Error(`Arquivo temporário ${finalDownloadedPath} NÃO foi encontrado após execução.`);
                }

                const stats = fs.statSync(finalDownloadedPath);
                if (stats.size < 10240) {
                    fs.unlinkSync(finalDownloadedPath);
                    throw new Error(`Arquivo temporário ${finalDownloadedPath} criado, mas está corrompido (muito pequeno).`);
                }


                await adicionarIntroducaoFixa(finalDownloadedPath, filePath);
                console.log(`[Download] Introdução adicionada e arquivo final salvo em: ${filePath}`);

                proxyAttemptSuccessful = true;
                const cleanApiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
                return `${cleanApiUrl}/stream/${fileName}`;

            } catch (error) {
                lastStrategyError = error;
                console.error(`[Download] Estratégia "${strategy.name}" falhou para ${videoId} ${proxyLog}: ${error.message}`);


                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                try {
                    const genericTempPattern = tempFilePath.replace(".mp3", ".");
                    const baseGeneric = path.basename(genericTempPattern).slice(0, -1);
                    const filesInOutput = fs.readdirSync(BASE_STORAGE_PATH);
                    const possibleGenericFile = filesInOutput.find(f => f.startsWith(baseGeneric) && f !== path.basename(filePath));
                    if (possibleGenericFile) {
                        fs.unlinkSync(path.join(BASE_STORAGE_PATH, possibleGenericFile));
                    }
                } catch (e) { }
            }
        }

        if (proxyAttemptSuccessful) break;

        lastOverallError = lastStrategyError;
        console.error(`[Download] Todas as estratégias falharam para ${proxyLog}. Tentando próximo proxy...`);
    }

    if (!proxyAttemptSuccessful) {
        console.error(`[Download] Todas as tentativas falharam para ${videoId}.`);
        throw new Error(`Falha no processamento do vídeo após múltiplas tentativas: ${lastOverallError ? lastOverallError.message : "Erro desconhecido"}`);
    }
}

module.exports = {
    verificaAtualizacaoYtDlp,
    getVideoInfo,
    searchYouTube,
    downloadVideoAsMP3,
    BASE_STORAGE_PATH,
    COOKIES_PATH,
    INTROS_DIR
};

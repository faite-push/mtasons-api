const express = require('express');
const router = express.Router();
const musicController = require('../controllers/music.controller');

router.get('/health', musicController.health);
router.get('/busca-youtube', musicController.search);
router.get('/play', musicController.play);
router.get('/download', musicController.download);
router.get('/grave', musicController.addBass);
router.get('/volume', musicController.addVolume);
router.get('/hitbrasil', musicController.getPlaylist);

router.post('/incrementViews', (req, res) => {
    const { totalViews } = require('../controllers/music.controller').health(req, { json: (d) => d });
    const fs = require('fs');
    const path = require('path');
    const { BASE_STORAGE_PATH } = require('../utils/youtube.utils');
    const VIEWS_FILE_PATH = path.join(BASE_STORAGE_PATH, 'views.json');
    try {
        let views = { totalViews: 0 };
        if (fs.existsSync(VIEWS_FILE_PATH)) {
            views = JSON.parse(fs.readFileSync(VIEWS_FILE_PATH, 'utf-8'));
        }
        views.totalViews += 1;
        fs.writeFileSync(VIEWS_FILE_PATH, JSON.stringify(views), 'utf-8');
        res.send({ totalViews: views.totalViews });
    } catch (e) {
        res.status(500).send({ error: 'Erro ao processar visualizações.' });
    }
});

module.exports = router;

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory cache + save to file
let skinData = {};
let capeData = {};

const presence = require('./presence-store').createPresenceStore();

const SKINS_FILE = path.join(__dirname, 'skins.json');
const CAPES_FILE = path.join(__dirname, 'capes.json');

// Load existing data if available
if (fs.existsSync(SKINS_FILE)) {
    try {
        skinData = JSON.parse(fs.readFileSync(SKINS_FILE, 'utf8'));
        console.log('Loaded skins from disk:', Object.keys(skinData).length);
    } catch (e) {
        console.error('Failed to read skins.json:', e);
    }
}
if (fs.existsSync(CAPES_FILE)) {
    try {
        capeData = JSON.parse(fs.readFileSync(CAPES_FILE, 'utf8'));
        console.log('Loaded capes from disk:', Object.keys(capeData).length);
    } catch (e) {
        console.error('Failed to read capes.json:', e);
    }
}

// Atomic file writer to prevent corruption during concurrent requests
function saveJsonAtomic(filePath, data) {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    try {
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, filePath);
    } catch (e) {
        console.error(`Error saving ${filePath}:`, e);
        try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (_) {}
    }
}

let skinSaveTimeout = null;
function scheduleSaveSkins() {
    if (skinSaveTimeout) clearTimeout(skinSaveTimeout);
    skinSaveTimeout = setTimeout(() => {
        saveJsonAtomic(SKINS_FILE, skinData);
        skinSaveTimeout = null;
    }, 300);
}

let capeSaveTimeout = null;
function scheduleSaveCapes() {
    if (capeSaveTimeout) clearTimeout(capeSaveTimeout);
    capeSaveTimeout = setTimeout(() => {
        saveJsonAtomic(CAPES_FILE, capeData);
        capeSaveTimeout = null;
    }, 300);
}

const PLAYER_NAME_REGEX = /^[a-zA-Z0-9_]{1,16}$/;

// Health check endpoint (for keep-alive pingers like cron-job.org / UptimeRobot)
app.get('/health', (req, res) => {
    presence.cleanup();
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        skinsCount: Object.keys(skinData).length,
        capesCount: Object.keys(capeData).length,
        onlineCount: presence.count()
    });
});

app.get('/', (req, res) => {
    res.send('Raven Backend is running.');
});

// GET /api/skins -> returns { "wzn": { skin: "demonlishing", type: "classic" }, ... }
app.get('/api/skins', (req, res) => {
    res.json(skinData);
});

// POST /api/skin -> updates a player's skin
app.post('/api/skin', (req, res) => {
    const { player, targetSkin, skinType } = req.body;
    
    if (!player || typeof player !== 'string' || !PLAYER_NAME_REGEX.test(player)) {
        return res.status(400).json({ error: 'Invalid player name' });
    }

    if (targetSkin === null || targetSkin === '') {
        delete skinData[player]; // reset
    } else {
        if (typeof targetSkin !== 'string' || !PLAYER_NAME_REGEX.test(targetSkin)) {
            return res.status(400).json({ error: 'Invalid skin name' });
        }
        const validatedType = (skinType === 'slim') ? 'slim' : 'default';
        skinData[player] = { skin: targetSkin, type: validatedType };
    }

    scheduleSaveSkins();
    res.json({ success: true, player, data: skinData[player] });
});

// GET /api/capes -> returns { "wzn": "http...", ... }
app.get('/api/capes', (req, res) => {
    res.json(capeData);
});

// POST /api/cape -> updates a player's cape
app.post('/api/cape', (req, res) => {
    const { player, capeUrl } = req.body;
    
    if (!player || typeof player !== 'string' || !PLAYER_NAME_REGEX.test(player)) {
        return res.status(400).json({ error: 'Invalid player name' });
    }

    if (capeUrl === null || capeUrl === '') {
        delete capeData[player]; // reset
    } else {
        if (typeof capeUrl !== 'string' || capeUrl.length > 300) {
            return res.status(400).json({ error: 'Invalid cape url' });
        }
        capeData[player] = capeUrl;
    }

    scheduleSaveCapes();
    res.json({ success: true, player, capeUrl: capeData[player] });
});

// Presence remains compatible with clients that don't send the new timer fields.
app.post('/api/heartbeat', (req, res) => {
    if (!presence.heartbeat(req.body || {})) return res.status(400).json({ error: 'Invalid player name' });
    res.json({ success: true, count: presence.count() });
});

app.get('/api/online', (req, res) => {
    const players = presence.online();
    res.json({ count: players.length, players });
});

app.post('/api/offline', (req, res) => {
    presence.offline(req.body || {});
    res.json({ success: true });
});
app.listen(PORT, () => {
    console.log(`Raven Backend rodando na porta ${PORT}`);
});

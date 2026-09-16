const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory cache + save to file
let skinData = {};
let capeData = {};

// Load existing data if available
if (fs.existsSync('skins.json')) {
    try {
        skinData = JSON.parse(fs.readFileSync('skins.json', 'utf8'));
        console.log('Loaded skins from disk.');
    } catch (e) {
        console.error('Failed to read skins.json:', e);
    }
}
if (fs.existsSync('capes.json')) {
    try {
        capeData = JSON.parse(fs.readFileSync('capes.json', 'utf8'));
        console.log('Loaded capes from disk.');
    } catch (e) {
        console.error('Failed to read capes.json:', e);
    }
}

// GET /api/skins -> returns { "wzn": { skin: "demonlishing", type: "classic" }, ... }
app.get('/api/skins', (req, res) => {
    res.json(skinData);
});

// POST /api/skin -> updates a player's skin
app.post('/api/skin', (req, res) => {
    const { player, targetSkin, skinType } = req.body;
    
    if (!player || typeof player !== 'string' || player.length > 16) {
        return res.status(400).json({ error: 'Invalid player name' });
    }

    if (targetSkin === null || targetSkin === '') {
        delete skinData[player]; // reset
    } else {
        if (typeof targetSkin !== 'string' || targetSkin.length > 16) {
            return res.status(400).json({ error: 'Invalid skin name' });
        }
        skinData[player] = { skin: targetSkin, type: skinType || 'default' };
    }

    // save asynchronously to file
    fs.writeFile('skins.json', JSON.stringify(skinData), (err) => {
        if (err) console.error('Failed to write skins.json:', err);
    });

    res.json({ success: true, player, data: skinData[player] });
});

// GET /api/capes -> returns { "wzn": "http...", ... }
app.get('/api/capes', (req, res) => {
    res.json(capeData);
});

// POST /api/cape -> updates a player's cape
app.post('/api/cape', (req, res) => {
    const { player, capeUrl } = req.body;
    
    if (!player || typeof player !== 'string' || player.length > 16) {
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

    // save asynchronously to file
    fs.writeFile('capes.json', JSON.stringify(capeData), (err) => {
        if (err) console.error('Failed to write capes.json:', err);
    });

    res.json({ success: true, player, capeUrl: capeData[player] });
});

app.listen(PORT, () => {
    console.log(`Raven Backend rodando na porta ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory cache + save to file
let skinData = {};

// Load existing data if available
if (fs.existsSync('skins.json')) {
    try {
        skinData = JSON.parse(fs.readFileSync('skins.json', 'utf8'));
        console.log('Loaded skins from disk.');
    } catch (e) {
        console.error('Failed to read skins.json:', e);
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

app.listen(PORT, () => {
    console.log(`Raven Backend rodando na porta ${PORT}`);
});

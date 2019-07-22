// Dependencies
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const url = require('url');
const app = express();

const config = require('./config.js');

// Get canned responses
const responseFile = require('./responses.json');
let responses = {
    "POST": [],
    "GET": [],
    "PUT": [],
    "PATCH": []
};
responseFile.forEach((entry) => {
    Object.keys(responses).forEach((requestType) => {
        if (requestType === entry.request.method) {
            let requestUrl = new URL(entry.request.url);
            responses[requestType][requestUrl.pathname] = entry.response;
        }
    });
});

app.all('*', (req, res) => {
    let requestType = req.method;
    let cannedResponse = responses[requestType][req.url];
    let statusCode = parseInt(cannedResponse.status_code);

    res.setHeader("Content-Type", "application/json");
    res.status(statusCode);
    res.send(cannedResponse.content);
});

const httpServer = http.createServer(app);

httpServer.listen(80, () => {
    console.log('HTTP Server running on port 80');
});

// Certificate
if (config.isEncryptedServer) {
    const privateKey = fs.readFileSync('/etc/letsencrypt/live/doublecolossus.com/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('/etc/letsencrypt/live/doublecolossus.com/cert.pem', 'utf8');
    const ca = fs.readFileSync('/etc/letsencrypt/live/doublecolossus.com/chain.pem', 'utf8');

    const credentials = {
        key: privateKey,
        cert: certificate,
        ca: ca
    };

    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(443, () => {
        console.log('HTTPS Server running on port 443');
    });
}

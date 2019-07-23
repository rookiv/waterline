// Dependencies
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const url = require('url');
const app = express();

// Post handling
app.use(express.urlencoded());
app.use(express.json());

const config = require('./config.js');

// Get canned responses
const responseFile = require('./responses.json');
let responses = {
    'POST': [],
    'GET': [],
    'PUT': [],
    'PATCH': []
};
responseFile.forEach((entry) => {
    Object.keys(responses).forEach((requestType) => {
        if (requestType === entry.request.method) {
            let requestUrl = new URL(entry.request.url);
            responses[requestType][requestUrl.pathname + requestUrl.search] = entry.response;
        }
    });
});

let instances = {};
let sessions = {};

/* Routes */

//Welcome
app.get('/', (req, res) => {
    const {version} = require('./package.json');
    res.send('Waterline version: ' + version);
});

// Poll
app.get('/presence/connect', (req, res) => {
    let message = '["welcome",{"success":true,"data":{"connection_id":"180182b9-ee86-4442-8ba5-2df0aad31e20","connected_at":"Sun, 31 Mar 2019 13:06:12 GMT"}}]\\n';
    res.writeHead(200, {'Content-Type': 'application/x-json-stream'});
    res.write(message);

    let iteration = 300;
    let poll = setInterval(() => {
        iteration--;
        if (iteration <= 0) {
            res.end();
            clearInterval(poll);
        } else {
            res.write('\n');
        }
    }, 1000);
});

// Create instance and add metadata
app.get('/o/_instances/:instanceId/metadata', (req, res) => {
    let displayId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    let instanceId = req.params.instanceId;

    instances[instanceId] = {
        'name': displayId
    };

    let response = {
        'attributes': {},
        'display_name': displayId,
        'owner': '25721053-ebe8-59f1-95b3-de39bc253c7f'
    };

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(response);
    res.end();
});

// Associate instance with session
app.post('/o/_instances/:instanceId/associate_with_session', (req, res) => {
    let sessionId = req.body.session_id;
    let instanceId = req.params.instanceId;

    instances[instanceId].sessionId = sessionId;

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write({});
    res.end();
});

// Create session
app.post('/o/_sessions/create', (req, res) => {
    let sessionId = req.body.session_id;
    let address = req.body.join_params.serverAddress;
    let port = req.body.join_params.serverPort;
    let joinChallengeKey = req.body.join_params.joinChallengeKey;
    let matchChallengeKey = req.body.join_params.matchChallengeKey;
    let serverProfile = req.body.attributes.serverProfile;
    let state = req.body.attributes.state;
    let name = req.body.name;
    let region = req.body.region;
    let slotCount = req.body.slot_count;
    let disableJoining = req.body.attributes.disableJoining;
    let gameMode = req.body.attributes.gameMode;
    let isPublic = req.body.attributes.public;
    let timeString = (new Date()).toUTCString();

    sessions[sessionId] = {
        'address': address,
        'port': port,
        'joinChallengeKey': joinChallengeKey,
        'matchChallengeKey': matchChallengeKey,
        'serverProfile': serverProfile,
        'state': state,
        'name': name,
        'region': region,
        'slotCount': slotCount,
        'disableJoining': disableJoining,
        'gameMode': gameMode,
        'isPublic': isPublic,
        'timeString': timeString
    };

    let response = {
        "_created_at": timeString,
        "_id": sessionId,
        "_modified_at": timeString,
        "_type": "_sessions",
        "attributes": {
            "disableJoining": disableJoining,
            "gameMode": gameMode,
            "ip": address,
            "public": isPublic,
            "serverProfile": serverProfile,
            "state": state
        },
        "filled_slots": 0,
        "host": "25721053-ebe8-59f1-95b3-de39bc253c7f",
        "last_keepalive": timeString,
        "name": name,
        "password_protected": false,
        "purpose": isPublic ? "public" : "private",
        "region": region,
        "reservation_count": 0,
        "slot_count": slotCount,
        "state": "created"
    };

    res.writeHead(201, {'Content-Type': 'application/json', 'Content-Location': '/o/_sessions/' + sessionId});
    res.write(response);
    res.end();
});

// Update session
app.patch('/o/_sessions/:sessionId/metadata', (req, res) => {
});

// Keep session alive
app.post('/o/_sessions/:sessionId/touch', (req, res) => {
});


// Canned responses
app.all('*', (req, res) => {
    let requestType = req.method;
    let cannedResponse = responses[requestType][req.url];

    if (!cannedResponse) {
        console.log(req.url)
        res.status(404).send('Not found');
        return;
    }

    let statusCode = parseInt(cannedResponse.status_code);
    res.writeHead(statusCode, {'Content-Type': 'application/json'});
    res.write(cannedResponse.content);
    res.end();
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

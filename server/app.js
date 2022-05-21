const fs = require('fs');
const path = require("path");
const bodyParser = require('body-parser');
const { gitlogPromise } = require('gitlog');
const {SERVER_VERSION_PATH} = require('../src/shared');
const express = require('express');
const expressApp = express();
const rateLimit = require('express-rate-limit');

const app = (serveStatic) => {
    expressApp.use(bodyParser.json());
    expressApp.use(bodyParser.urlencoded({ extended: false }));
    const limiter = rateLimit({
        windowMs: 60*1000, // 1 minute
        max: 60,
        standardHeaders: true,
    });

    expressApp.use(limiter);

    expressApp.get(SERVER_VERSION_PATH, (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        gitlogPromise({repo: __dirname, number: 1})
            .then(gitLog => {
                const lastLog = gitLog[0];
                res.send({"current": lastLog.abbrevHash});
            });
    });
    const absoluteStaticPath = path.resolve(serveStatic);
    if (fs.existsSync(absoluteStaticPath)) {
        expressApp.use(express.static(absoluteStaticPath));

        expressApp.get('/*', (req, res) => {
            res.sendFile(path.join(absoluteStaticPath, 'index.html'));
        });
    } else {
        expressApp.get('*', (req, res) => {
           res.status(500);
            res.send('Cannot serve static files - destination does not exist');
        });
    }

    return expressApp;
};

module.exports = app;

const app = require('./app');
const stdio = require("stdio");
const opts = stdio.getopt({
    'serve': { key: 's', args: 1, required: true, description: 'Folder to serve static files from'},
    'port': { key: 'p', args: 1, default: 3001, description: 'Port to listen on'}
});

app(opts.serve).listen(opts.port, () => {
    console.log(`Stellar Claim listening on port ${opts.port}.`)
})

process.on('SIGINT', function() {
    console.log("stopping");
    process.exit(0);
});

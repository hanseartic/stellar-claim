
const port = process.env.APP_PORT??3000
require('./app').listen(port, () => {
    console.log(`Claim APP listening on port ${port}.`)
})

process.on('SIGINT', function() {
    console.log("stopping");
    process.exit(0);
});

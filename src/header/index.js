
const getFromStorage = (key) => new Promise((resolve, reject) => {
    const network = localStorage.getItem(key);
    if (null !== network) resolve(network);
    else reject();
});

const header = (() => {
    const headerTemplate = document.createElement('template')
    const { default: header } = require('./header.html');
    headerTemplate.innerHTML = header;

    getFromStorage('is-testnet').then(isTestnet => {
            const e = document.getElementById('is-testnet-toggle');
            e.checked = !!JSON.parse(isTestnet);
        }
    ).catch(() => {});

    headerTemplate.content.getElementById('is-testnet-toggle')
        .addEventListener(
            'change',
            (e) => localStorage.setItem('is-testnet', e.target.checked));
    return Array.from(headerTemplate.content.childNodes);
})()
export default header

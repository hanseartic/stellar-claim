'use strict';
import FreighterAPI from "@stellar/freighter-api";
import { Keypair } from "stellar-sdk";
import './stellar_account.css';

let selected_network = 'TESTNET';

const loadFromFreighterButton = (inputField) => {
    if (!FreighterAPI.isConnected()) {
        console.debug('freighter is not connected');
        return;
    }
    FreighterAPI.getNetwork().then(network => selected_network = network);
    const button = document.createElement('button');

    const buttonClickedHandler = (event) => {
        event.target.classList.add('loadSpin');
        event.target.blur();
        FreighterAPI.getPublicKey()
            .then(key => {
                inputField.value = key;
                inputField.dispatchEvent(new Event('change', {bubbles: true, cancelable: false}));
            })
            .finally(() => event.target.classList.remove('loadSpin'));
    }
    button.addEventListener('click', buttonClickedHandler);

    window.addEventListener('focus', () => {button.classList.remove('loadSpin')});
    return button;
}

export default (() => {
    const div = document.createElement('div');
    div.id = 'stellar_account';
    const inputField = document.createElement('input');
    inputField.placeholder = 'e.g. ' + Keypair.random().publicKey();
    inputField.id = 'account_id';
    inputField.maxLength = 56;
    inputField.size = 60;
    inputField.addEventListener('change', (event) => {
        event.target.blur();
        div.dispatchEvent(new CustomEvent('accountIDChanged', { detail: event.target.value }))
    });

    div.appendChild(inputField);
    const freighterButton = loadFromFreighterButton(inputField);
    if (freighterButton) div.appendChild(freighterButton);

    return div;
})();

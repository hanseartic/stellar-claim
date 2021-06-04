import FreighterAPI from "@stellar/freighter-api";
import {Asset, BASE_FEE, Keypair, Memo, Networks, Operation, Server, TransactionBuilder} from "stellar-sdk";
import Tabulator from "tabulator-tables";
import './stellar_account.css';
import 'tabulator-tables/dist/css/bootstrap/tabulator_bootstrap.min.css';
import stellar_logo from './stellar_logo_black.png';

const server_urls = {
    PUBLIC: 'https://horizon.stellar.org',
    TESTNET: 'https://horizon-testnet.stellar.org',
};
let selected_network = 'TESTNET';

const loadFromFreighterButton = (input_field) => {
    if (!FreighterAPI.isConnected()) {
        console.debug('freighter is not connected');
        return;
    }
    FreighterAPI.getNetwork().then(network => selected_network = network);
    const button = document.createElement('button');

    button.onclick = () => {
        button.classList.add('loadSpin');
        FreighterAPI.getPublicKey()
            .then(key => {
                input_field.value = key;
                input_field.dispatchEvent(new Event('change', {bubbles: true, cancelable: false}));
            })
            .finally(() => button.classList.remove('loadSpin'));
    }
    window.onfocus = () => {button.classList.remove('loadSpin')};
    return button;
}

let input_field;
export function accountComponent() {
    const div = document.createElement('div');
    div.id = 'stellar_account';

    input_field = document.createElement('input');
    input_field.placeholder = 'e.g. ' + Keypair.random().publicKey();
    input_field.id = 'account_id';
    input_field.maxLength = 56;
    input_field.size = 60;

    div.appendChild(input_field);
    const freighterButton = loadFromFreighterButton(input_field);
    if (freighterButton) div.appendChild(freighterButton);

    return div;
}

let xdr_field;
export function claimableBalancesComponent() {
    let claimable_balances_data = [];
    const div = document.createElement('div');
    div.id = 'claimable_balances';
    const balances_table = document.createElement('table');
    balances_table.id = 'list_of_balances';
    balances_table.classList.add(['table-striped']);
    div.appendChild(balances_table);
    xdr_field = document.createElement('textarea');
    xdr_field.classList.add('hidden');
    div.appendChild(xdr_field);

    const loadData = () => new Server(server_urls[selected_network]).claimableBalances().call()
        .then(({records}) => {
            tabulator.setData(records);
        });

    const table_footer = document.createElement('div');
    table_footer.classList.add('tabulator-footer');
    const claim_button = document.createElement('button');
    claim_button.innerText = 'Claim selected balances';
    claim_button.disabled = true;
    table_footer.appendChild(claim_button);

    const claimableBalancesSelected = (data, rows) => {
        if (data.length === 0) {
            claim_button.disabled = true;
            return;
        }
        claim_button.disabled = false;
    };

    const tabulator = new Tabulator(balances_table, {
        selectable: true,
        tableBuilt: loadData,
        maxHeight: 600,
        reactiveData: true,
        layout: 'fitDataStretch',
        layoutColumnsOnNewData:true,
        data: claimable_balances_data,
        columns: [
            //{formatter: 'rowSelection', titleFormatter: 'rowSelection', align: 'center', headerSort: false, width: '15px'},
            {title: 'Amount', field: 'amount', formatter: 'money'},
            {title: 'Asset', field: 'asset', formatter: 'stellar_asset', formatterParams: {network: selected_network}},
        ],
        selectableCheck: isRowSelectableCheck,
        rowSelectionChanged: claimableBalancesSelected,
        footerElement: table_footer,
    });

   claim_button.onclick = claimBalancesAction.bind(tabulator);

    input_field.onchange = (ev) => {
        new Server(server_urls[selected_network]).claimableBalances().claimant(ev.target.value).call()
            .then(({records}) => tabulator.setData(records));
    };
    return div;
}

function isRowSelectableCheck(row) {
    if (input_field.value.length !== 56) return false;
    return !!row.getData().claimants.map(claimant => claimant.destination).find(d => d === input_field.value);
}

function claimBalancesAction(ev) {
    const accountId = input_field.value;
    const tabulator = this;
    const selected_balances = tabulator.getSelectedData();
    const server = new Server(server_urls[selected_network]);
    server.loadAccount(accountId)
        .then(account => ({
            balances: account.balances,
            tb: new TransactionBuilder(account, {fee: BASE_FEE, networkPassphrase: Networks[selected_network]})}))
        .then(({balances, tb: transactionBuilder}) => {
            const existingTrustlines = balances
                .filter(balance => balance.asset_type !== 'native')
                .map(asset => asset.asset_code + ':' + asset.asset_issuer);

            const missingTrustlines = selected_balances
                    .map(balance => balance.asset)                                 // consider each asset
                    .filter((value, index, self) => self.indexOf(value) === index) // once
                    .filter(asset => asset !== 'native')                           // that is not XLM
                    .filter(asset => existingTrustlines.indexOf(asset));           // and has no trust-line yet

            missingTrustlines.forEach(asset => {
                transactionBuilder.addOperation(Operation.changeTrust({
                    asset: getAssetFromString(asset),
                }));
            });

            selected_balances.forEach(balance => {
                transactionBuilder.addOperation(Operation.claimClaimableBalance({
                    balanceId: balance.id,
                }))
            });

            const transactionXDR = transactionBuilder.setTimeout(0).addMemo(Memo.text('via collect')).build().toXDR();
            xdr_field.value = transactionXDR;
            return transactionXDR;
        })
        .then(unsignedTransactionXDR => FreighterAPI.signTransaction(unsignedTransactionXDR, selected_network))
        .then(signedTransactionXDR => server.submitTransaction(TransactionBuilder.fromXDR(signedTransactionXDR, Networks[selected_network])))
        .then(() => server.claimableBalances().claimant(accountId).call())
        .then(({records}) => tabulator.setData(records))
        .catch(reason => console.warn(reason));
}

Tabulator.prototype.extendModule("format", "formatters", {
    stellar_asset:function(cell, formatterParams){
        const network = (formatterParams.network ?? 'PUBLIC').toLowerCase();
        const asset = getAssetFromString(cell.getValue());
        let url = 'https://stellar.expert/explorer/'+network+'/asset/'+asset.getCode();
        if (asset.isNative()) {
            return '<span class="asset_definition" title="Lumens issued by stellar"><img src="'+stellar_logo+'" alt="Logo for lumens" width="30px"/><div>' +
                '<div class="asset_code"><a href="'+url+'">XLM</a></div>' +
                '<div class="asset_issuer"></div>' +
                '</div></span>';
        }
        url += '-'+asset.getIssuer();
        return '<span class="asset_definition" title="'+asset.getCode()+' issued by '+asset.getIssuer().shorten(15)+'"><div>' +
            '<div class="asset_code"><a href="'+url+'">'+asset.getCode()+'</a></div>' +
            '<div class="asset_issuer"></div>' +
          '</div></span>';
    },
});

const getAssetFromString = (assetString) => {
    if (assetString === 'native') return Asset.native();
    return new Asset(...assetString.split(':'))
};

String.prototype.shorten = function (shortenTo) {
    if (shortenTo + 1 >= this.length) return this;
    return this.slice(0, Math.floor(shortenTo/2)) + '…' + this.slice(-Math.ceil(shortenTo/2));
};

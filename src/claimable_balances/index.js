'use strict';
import { BASE_FEE, Keypair, Memo, Networks, Operation, Server, TransactionBuilder} from "stellar-sdk";
import {getStellarAssetFromString} from '../helpers';
import Tabulator from "tabulator-tables";
import FreighterAPI from "@stellar/freighter-api";
import stellar_logo from "../stellar_logo_black.png";

const serverUrls = {
    PUBLIC: 'https://horizon.stellar.org',
    TESTNET: 'https://horizon-testnet.stellar.org',
};
let server = null;

export default class ClaimableBalances {
    tabulator = null;
    constructor(publicNetwork) {
        this.usePublicNetwork(publicNetwork);
        this.component = claimableBalancesComponent(this, 'list_of_balances');
        //this.setAccountId(accountId);
    }

    getComponent() {
        return this.component;
    }

    getUsedNetwork() {
        return this.network;
    }

    usePublicNetwork(usePublicNetwork) {
        this.network = !!usePublicNetwork ? 'PUBLIC' : 'TESTNET';
        this.server = new Server(serverUrls[this.network]);
        server = this.server;
        return this;
    }

    setAccountId(accountId) {
        try {
            this.accountId = (accountId && accountId.length === 56) ? Keypair.fromPublicKey(accountId).publicKey(): null;
        } catch (err) {
            console.warn(err);
            this.accountId = null;
        }
        this.updateClaimableBalances();
        return this;
    }

    updateClaimableBalances() {
        const params = {limit:15,};
        if (this.accountId) {
            params.claimant = this.accountId;
        }
        this.tabulator.setData(serverUrls[this.network]+'/claimable_balances/', params);
    }
}

function claimableBalancesComponent(claimableBalancesComponent, balancesTableId) {
    const div = document.createElement('div');
    div.id = 'claimable_balances';
    const balancesTable = document.createElement('table');
    balancesTable.id = balancesTableId;
    balancesTable.classList.add('table-striped');
    div.appendChild(balancesTable);
    const xdr_area = document.createElement('div');
    let xdr_description = document.createElement('p');
    xdr_description.innerText = 'The transaction could not be signed.';
    xdr_area.appendChild(xdr_description);
    xdr_description = document.createElement('p');
    xdr_description.innerText = 'You find the unsigned transaction in the textarea below. You can copy it and sign in the lab';
    xdr_area.appendChild(xdr_description);
    const xdr_field = document.createElement('textarea');
    xdr_field.classList.add('hidden');
    xdr_field.readOnly = true;
    xdr_area.appendChild(xdr_field)
    //div.appendChild(xdr_area);

    const balancesTableFooter = document.createElement('div');
    balancesTableFooter.classList.add('tabulator-footer');
    const claimButton = document.createElement('div');
    claimButton.classList.add('btn-claim', 'disabled');

    claimButton.innerHTML = '<i class="fas fa-wallet"></i> Claim selected balances <span class="indicator"><i class="fas fa-spinner spin-it"></i><i class="fas fa-smile-beam i-success"></i><i class="fas fa-surprise i-failed"></i></span>';

    balancesTableFooter.appendChild(claimButton);

    const isRowSelectableCheck = (row) => {
        if (!claimableBalancesComponent.accountId) return false;
        return !!row.getData().claimants.map(claimant => claimant.destination).find(d => d === claimableBalancesComponent.accountId);
    };
    const rowSelectionChangedHandler = (data, rows) => {
        if (data.length > 0) claimButton.classList.remove('disabled');
        else claimButton.classList.add('disabled');
    };

    let nextPage = '';
    let currentPage = 0;
    const tabulator = new Tabulator(balancesTable, {
        ajaxURL: serverUrls[claimableBalancesComponent.network] + '/claimable_balances',
        ajaxParams: {limit: 15,},
        selectable: true,
        maxHeight: 600,
        reactiveData: true,
        layout: 'fitDataStretch',
        layoutColumnsOnNewData:true,
        columns: [
            //{formatter: 'rowSelection', titleFormatter: 'rowSelection', align: 'center', headerSort: false, width: '15px'},
            {title: 'Amount', field: 'amount', formatter: 'money', },
            {title: 'Asset', field: 'asset', formatter: 'stellar_asset', formatterParams: {getNetwork: () => claimableBalancesComponent.getUsedNetwork()}},
            {title: 'From', field: 'sponsor', formatter: 'address', formatterParams: {getNetwork: () => claimableBalancesComponent.getUsedNetwork()}},
        ],
        selectableCheck: isRowSelectableCheck,
        rowSelectionChanged: rowSelectionChangedHandler,
        footerElement: balancesTableFooter,
        ajaxURLGenerator: (url, config, params) => {
            const urlParams = params;
            currentPage = params.page;
            if (currentPage > 1 && nextPage) urlParams.cursor = nextPage;
            nextPage='';
            delete urlParams['page'];
            return url + '?' + Object.keys(urlParams).map(key => key + '=' + urlParams[key]).join('&');
        },
        ajaxProgressiveLoad: "scroll",
        ajaxResponse: (url, params, response) => {
            let nextLink = response._links.next.href;
            if (nextLink)
                nextLink = nextLink.substring(nextLink.indexOf('?')+1);
            nextPage = new URLSearchParams(nextLink).get('cursor');

            const records = response._embedded.records;

            return {data: records, last_page:currentPage + (records.length<params.limit?0:1),};
        },
    });

    const setButtonState = (state) => {
        claimButton.classList.remove('claiming', 'failed', 'success');
        claimButton.classList.add(state);
    }

    claimableBalancesComponent.tabulator = tabulator;
    claimButton.addEventListener('click',
        ev => ev.target.classList.contains('disabled')
            || div.dispatchEvent(
                new CustomEvent('claimBalances', {
                    detail: {
                        ev: ev,
                        balances: tabulator.getSelectedData(),
                        accountId: claimableBalancesComponent.accountId,
                        network: claimableBalancesComponent.getUsedNetwork(),
                    },
                    bubbles: true,
                }))
    );
    div.addEventListener('claimBalances', ev => {
        setButtonState('claiming');
        claimBalancesAction(ev);
    });
    div.addEventListener('claimTxUnsignedReady', ev => console.log(ev));
    div.addEventListener('claimBalanceFailed', ev => {
        setButtonState('failed');
        setTimeout(() => {
            setButtonState();
        }, 2500);
    });
    div.addEventListener('claimTxSigningFailed', ev => {
        setButtonState('failed');
        xdr_field.value = ev.detail.xdr;
    });
    div.addEventListener('claimTxSubmitted', ev => {
        setButtonState('success');
        setTimeout(() => {
            setButtonState();
        }, 2500);
        claimableBalancesComponent.updateClaimableBalances();
    });
    return div;
}

function claimBalancesAction(ev) {
    console.log(ev.detail);
    ev.detail.ev.target.classList.add('animate');
    const accountId = ev.detail.accountId;
    const selectedBalances = ev.detail.balances;
    const selectedNetwork = ev.detail.network;
    if (!selectedBalances.length) return;
    if (!accountId) return;
    server.loadAccount(accountId)
        .then(account => ({
            balances: account.balances,
            tb: new TransactionBuilder(account, {fee: BASE_FEE, networkPassphrase: Networks[selectedNetwork]})}))
        .then(({balances, tb: transactionBuilder}) => {
            const existingTrustlines = balances
                .filter(balance => balance.asset_type !== 'native')
                .map(asset => asset.asset_code + ':' + asset.asset_issuer);

            const missingTrustlines = selectedBalances
                .map(balance => balance.asset)                                 // consider each asset
                .filter((value, index, self) => self.indexOf(value) === index) // once
                .filter(asset => asset !== 'native')                           // that is not XLM
                .filter(asset => existingTrustlines.indexOf(asset));           // and has no trust-line yet

            missingTrustlines.forEach(asset => {
                transactionBuilder.addOperation(Operation.changeTrust({
                    asset: getStellarAssetFromString(asset),
                }));
            });

            selectedBalances.forEach(balance => {
                transactionBuilder.addOperation(Operation.claimClaimableBalance({
                    balanceId: balance.id,
                }))
            });

            const transactionXDR = transactionBuilder.setTimeout(0).addMemo(Memo.text('balances.lumens.space')).build().toXDR();
            ev.target.dispatchEvent(new CustomEvent('claimTxUnsignedReady', {detail: transactionXDR, bubbles: true}));
            return transactionXDR;
        })
        .then(unsignedTransactionXDR => FreighterAPI.signTransaction(unsignedTransactionXDR, selectedNetwork)
            .catch(r => {
                ev.target.dispatchEvent(new CustomEvent('claimTxSigningFailed', {detail: {reason: r, xdr: unsignedTransactionXDR} , bubbles: true}));
                return Promise.reject(r);
            }))
        .then(signedTransactionXDR => server.submitTransaction(TransactionBuilder.fromXDR(signedTransactionXDR, Networks[selectedNetwork])))
        .then(() => ev.target.dispatchEvent(new CustomEvent('claimTxSubmitted', {bubbles: true})))
        .catch(reason => {
            ev.target.dispatchEvent(new CustomEvent('claimBalanceFailed', {detail: reason}));
            console.warn(reason);
        });
}

Tabulator.prototype.extendModule("format", "formatters", {
    address: function (cell, formatterParams) {
        const network = (formatterParams.getNetwork() ?? 'PUBLIC').toLowerCase();
        const shortAddress = cell.getValue().shorten(formatterParams.addressLength||8);
        return `<a href="https://stellar.expert/explorer/${network}/account/${cell.getValue()}">${shortAddress}</a>`;
    },
    stellar_asset:function (cell, formatterParams) {
        const network = (formatterParams.getNetwork() ?? 'PUBLIC').toLowerCase();
        const asset = getStellarAssetFromString(cell.getValue());
        let url =  `https://stellar.expert/explorer/${network}/asset/${asset.getCode()}`;
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

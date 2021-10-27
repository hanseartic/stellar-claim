import React from 'react';

import ClaimableBalancesOverview from "../Components/ClaimableBalancesList";
import AccountSelector, {AccountState} from "../Components/AccountSelector";
import {Button} from "antd";
import {WalletOutlined} from "@ant-design/icons";
import useApplicationState from "../useApplicationState";
import {
    AccountResponse,
    BASE_FEE,
    Horizon,
    Memo,
    Networks,
    Operation,
    Server,
    ServerApi,
    TransactionBuilder,
} from "stellar-sdk";
import StellarHelpers, {
    getStellarAsset,
} from '../StellarHelpers';

import {submitTransaction} from "../Components/WalletHandling";

type BalanceLineAsset = Horizon.BalanceLineAsset;
type BalanceLineNative = Horizon.BalanceLineNative;
type BalanceLine = Horizon.BalanceLine;
type ClaimableBalanceRecord = ServerApi.ClaimableBalanceRecord;


const generateClaimTransactionForAccountOnNetwork = (selectedBalances: ClaimableBalanceRecord[], account: AccountResponse, networkPassphrase: string) => {
    const existingTrustLineCodes = account.balances
        .filter((asset: BalanceLine): asset is (BalanceLineAsset|BalanceLineNative) =>
            asset.asset_type !== 'liquidity_pool_shares'
        )
        .map(asset => asset.asset_type === 'native'
            ?'native'
            :`${asset.asset_code}:${asset.asset_issuer}`
        );
    const missingTrustLineCodes = selectedBalances
        .map(balance => balance.asset)                                 // consider each asset
        .filter((value, index, trustlines) => trustlines.indexOf(value) === index) // once
        .filter(asset => existingTrustLineCodes.indexOf(asset) < 0);   // that has no trust-line yet

    const transactionBuilder = new TransactionBuilder(account, {fee: BASE_FEE, networkPassphrase: networkPassphrase});

    selectedBalances.forEach(balance => {
        const missingTrustLineIndex = missingTrustLineCodes.indexOf(balance.asset);
        if (missingTrustLineIndex >= 0) {
            transactionBuilder.addOperation(Operation.changeTrust({
                asset: getStellarAsset(balance.asset),
            }));
            missingTrustLineCodes.splice(missingTrustLineIndex, 1);
        }
        transactionBuilder.addOperation(Operation.claimClaimableBalance({
            balanceId: balance.id,
        }));
    });
    const tx = transactionBuilder.setTimeout(0).addMemo(Memo.text('balances.lumens.space')).build();
    return tx.toXDR();
};

export default function ClaimBalances() {
    const {accountInformation, balancesClaiming, selectedBalances, setBalancesClaiming, setAccountInformation} = useApplicationState();
    const {getSelectedNetwork, horizonUrl} = StellarHelpers();

    const claimBalances = (): void => {
        if (accountInformation.state !== AccountState.valid) return;
        let account = accountInformation.account!;
        setBalancesClaiming(true);
        const unsignedXDR = generateClaimTransactionForAccountOnNetwork(selectedBalances, account, Networks[getSelectedNetwork()])

        submitTransaction(unsignedXDR, account, horizonUrl().href, getSelectedNetwork())
            .then(() => {
                new Server(horizonUrl().href)
                    .loadAccount(account.id)
                    .then(account => setAccountInformation({account: account}));
            })
            .finally(() => {
                setTimeout(() => setBalancesClaiming(false), 200);
            });
    };

    return (<>
        <AccountSelector />
        <ClaimableBalancesOverview />
        <Button
            block
            loading={balancesClaiming}
            disabled={!selectedBalances || selectedBalances.length === 0}
            icon={<WalletOutlined />}
            onClick={() => claimBalances()}
        >
            Claim selected balances
        </Button>
    </>);
}

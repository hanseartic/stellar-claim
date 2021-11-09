import React from 'react';
import BigNumber from "bignumber.js";
import ClaimableBalancesOverview from "../Components/ClaimableBalancesList";
import AccountSelector, {AccountState} from "../Components/AccountSelector";
import {Button, Col, notification, Popover, Row} from "antd";
import {ClearOutlined, WalletOutlined} from "@ant-design/icons";
import useApplicationState from "../useApplicationState";
import {
    AccountResponse,
    Asset,
    BASE_FEE,
    Horizon,
    Memo,
    Networks,
    Operation,
    Server,
    ServerApi,
    TransactionBuilder,
    xdr,
} from "stellar-sdk";
import StellarHelpers, {
    getStellarAsset,
} from '../StellarHelpers';

import {submitTransaction} from "../Components/WalletHandling";

type BalanceLineAsset = Horizon.BalanceLineAsset;
type BalanceLineNative = Horizon.BalanceLineNative;
type BalanceLine = Horizon.BalanceLine;
type ClaimableBalanceRecord = ServerApi.ClaimableBalanceRecord;


const getMissingBalanceLines = (accountBalances: Horizon.BalanceLine[], assetCodes: string[]): string[] => {
    const existingTrustLineCodes = accountBalances
        .filter((asset: BalanceLine): asset is (BalanceLineAsset|BalanceLineNative) =>
            asset.asset_type !== 'liquidity_pool_shares'
        )
        .map(asset => asset.asset_type === 'native'
            ?'native'
            :`${asset.asset_code}:${asset.asset_issuer}`
        );

    // consider each asset once
    // that has no trust-line yet
    return assetCodes
        .filter((value, index, trustlines) => trustlines.indexOf(value) === index)
        .filter(asset => existingTrustLineCodes.indexOf(asset) < 0);
};

const generateClaimTransactionForAccountOnNetwork = (selectedBalances: ClaimableBalanceRecord[], account: AccountResponse, networkPassphrase: string) => {
    const missingTrustLineCodes = getMissingBalanceLines(account.balances, selectedBalances.map(b => b.asset));

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
    const tx = transactionBuilder.setTimeout(0).addMemo(Memo.text('via balances.lumens.space')).build();
    return tx.toXDR();
};

const generateCleanCBTransactionForAccountOnNetwork = (
    selectedBalances: ClaimableBalanceRecord[],
    account: AccountResponse,
    networkPassphrase: string,
    serverUrl: string
) => {
    const missingTrustLineCodes = getMissingBalanceLines(account.balances, selectedBalances.map(b => b.asset));
    const transactionBuilder = new TransactionBuilder(account, {fee: BASE_FEE, networkPassphrase: networkPassphrase});
    const server = new Server(serverUrl);
    const conversionCosts = new BigNumber(BASE_FEE).times(4);
    return Promise.all(selectedBalances.map(balance => server
        .strictSendPaths(getStellarAsset(balance.asset), balance.amount, [Asset.native()])
        .call()
        .then(({records}) =>
            records.find(r => new BigNumber(r.destination_amount).times(10000000).greaterThan(conversionCosts))
        )
        .then(sendPath => {
            const path = sendPath?.path
                ? sendPath.path.map(p => getStellarAsset(p.asset_code+':'+p.asset_issuer))
                : [];
            return {
                claimableBalanceId: balance.id,
                asset: balance.asset,
                amount: balance.amount,
                path: path,
                minProceeds: new BigNumber(sendPath?.destination_amount??0).times(0.95).round(7).toString(),
                trash: sendPath === undefined,
            }
        })
    )).then(balances => {
        balances.forEach(balance => {
            const currentAsset = getStellarAsset(balance.asset);
            if (missingTrustLineCodes.includes(balance.asset)) {
                transactionBuilder.addOperation(Operation.changeTrust({
                    asset: currentAsset,
                }));
            }
            transactionBuilder.addOperation(Operation.claimClaimableBalance({
                balanceId: balance.claimableBalanceId,
            }));
            if (balance.trash) {
                transactionBuilder.addOperation(Operation.payment({
                    asset: currentAsset,
                    destination: currentAsset.getIssuer(),
                    amount: balance.amount,
                }))
            } else {
                transactionBuilder.addOperation(Operation.pathPaymentStrictSend({
                    sendAsset: currentAsset,
                    destAsset: Asset.native(),
                    destination: account.accountId(),
                    sendAmount: balance.amount,
                    destMin: balance.minProceeds,
                    path: balance.path,
                }))
            }
            if (missingTrustLineCodes.includes(balance.asset)) {
                transactionBuilder.addOperation(Operation.changeTrust({
                    asset: getStellarAsset(balance.asset),
                    limit: "0",
                }));
            }
        });
        return transactionBuilder
            .setTimeout(0)
            .addMemo(Memo.text('stellarclaim:🗑💱💰'))
            .build()
            .toXDR();
    })
}


export default function ClaimBalances() {
    const {accountInformation, balancesClaiming, selectedBalances, setBalancesClaiming, setAccountInformation} = useApplicationState();
    const {getSelectedNetwork, horizonUrl} = StellarHelpers();

    const cleanBalances = async () => {
        if (accountInformation.state !== AccountState.valid) return;
        let account = accountInformation.account!;
        setBalancesClaiming(true);
        const unsignedXDR = await generateCleanCBTransactionForAccountOnNetwork(selectedBalances, account, Networks[getSelectedNetwork()], horizonUrl().href);
        console.log(unsignedXDR);
        submitTransaction(unsignedXDR, account, horizonUrl().href, getSelectedNetwork())
            .then(submitTransactionResponse => {
                if (submitTransactionResponse) {
                    const tr = xdr.TransactionResult.fromXDR(submitTransactionResponse.result_xdr, 'base64');
                    const pathPayments = tr.result().results()
                        .filter(r => r.value().switch().name === 'pathPaymentStrictSend');

                    const proceedings = pathPayments
                        .map(pp => pp.tr().pathPaymentStrictSendResult().value())
                        .filter((result): result is xdr.PathPaymentStrictSendResultSuccess => true)
                        .map(result => result.last().amount().toString())
                        .map(amount => new BigNumber(amount).div(10000000))
                        .reduce((prev, current) => prev.add(current), new BigNumber(0))
                        .minus(new BigNumber(tr.feeCharged().toString()).div(10000000));
                    notification.info({
                        message: `Cleaning claimable balances yielded proceedings of ${proceedings} XLM.`,
                    });
                }
            })
            .then(() => {
                new Server(horizonUrl().href)
                    .loadAccount(account.id)
                    .then(account => setAccountInformation({account: account}));
            })
            .finally(() => {
                setTimeout(() => setBalancesClaiming(false), 200);
            });
    };

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

    const trashCoinPopover = (<>
        Claimable balances sent out to spam and notify about random projects can clutter your list of claimable balances.

        Instead of waiting for them to disappear, you can take action and remove them. In detail this will
        <ul>
            <li>establish a trustline to the asset</li>
            <li>claim the claimable balance</li>
            <li>check if there is a market and the asset can be sold for more than the network fees. yes: flip, no: burn</li>
            <li>remove the trustline to avoid spending base-reserve on spam-assets</li>
        </ul>
    </>);

    return (<>
        <AccountSelector />
        <ClaimableBalancesOverview />
        <Row>
            <Col flex={1}>
                <Button
                    block
                    loading={balancesClaiming}
                    disabled={!selectedBalances || selectedBalances.length === 0}
                    icon={<WalletOutlined />}
                    onClick={() => claimBalances()}
                >
                    Claim selected balances
                </Button>
            </Col>
            <Col flex={1}>
            <Popover placement="topRight" title="Clean out the spam" content={trashCoinPopover}>
                    <Button
                    block
                    loading={balancesClaiming}
                    disabled={!selectedBalances || selectedBalances.length === 0}
                    icon={<ClearOutlined />}
                    onClick={() => cleanBalances()}
                >
                    Clean selected balances
                </Button>
            </Popover>
            </Col>
        </Row>
    </>);
}

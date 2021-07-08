import React from 'react';

import ClaimableBalancesOverview from "../ClaimableBalancesList";
import AccountSelector, {AccountState} from "../AccountSelector";
import {Button, Col, notification, Row} from "antd";
import {WalletOutlined} from "@ant-design/icons";
import useApplicationState from "../useApplicationState";
import {
    AccountResponse,
    BASE_FEE,
    Horizon,
    Memo,
    NetworkError,
    Networks,
    Operation,
    Server,
    ServerApi,
    TransactionBuilder,
    xdr,
} from "stellar-sdk";
import StellarHelpers, {
    getStellarAsset,
    reasonIsSignatureWeightInsufficient,
    verifyTransactionSignaturesForAccount
} from '../StellarHelpers';
import freighterApi, {signTransaction} from '@stellar/freighter-api';

type TransactionFailed = Horizon.ErrorResponseData.TransactionFailed;
type TransactionResponse = Horizon.TransactionResponse;
type ClaimableBalanceRecord = ServerApi.ClaimableBalanceRecord;


const generateClaimTransactionForAccountOnNetwork = (selectedBalances: ClaimableBalanceRecord[], account: AccountResponse, networkPassphrase: string) => {
    const existingTrustLineCodes = account.balances
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
            missingTrustLineCodes.slice(missingTrustLineIndex, 1);
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
        signTransaction(unsignedXDR, getSelectedNetwork())
            .catch(reason => {
                freighterApi.getNetwork().then(network => {
                    if (network !== getSelectedNetwork()) {
                        notification['warn']({message: 'The network selected in Freighter ('+network+') does not match currently selected network ('+getSelectedNetwork()+').'});
                    } else {
                        notification['warn']({message: 'Freighter: '+ reason});
                    }
                });
                throw reason;
            })
            .then(signedXDR => TransactionBuilder.fromXDR(signedXDR, Networks[getSelectedNetwork()]))
            .then(tx => verifyTransactionSignaturesForAccount(tx , account))
            .then(tx => new Server(horizonUrl().href).submitTransaction(tx))
            .then(submitTransactionResponse => {
                type RealTransactionResponse = (TransactionResponse&{successful:boolean});
                if ((submitTransactionResponse as RealTransactionResponse).successful) {
                    return true;
                }
                const result = xdr.TransactionResult.fromXDR(submitTransactionResponse.result_xdr, 'base64');
                throw result.result().results();
            })
            .then(success => {
                if (success) {
                    notification.success({
                        message: 'The transaction was successfully submitted.',
                    });
                }
                new Server(horizonUrl().href)
                    .loadAccount(account.id)
                    .then(account => setAccountInformation({account: account}));
            })
            .catch(reason => {
                if (typeof reason === 'string') {
                    return;
                }
                if (reasonIsSignatureWeightInsufficient(reason)) {
                    notification.error({
                        message: 'Transaction signature weight not sufficient',
                        description: `The signature's weight (${reason.signaturesWeight}) does not meet the required threshold for this transaction (${reason.requiredThreshold}). Consider using another key for signing. Multisig is not yet supported.`,
                        duration: 20,
                    });
                    return;
                }
                if ('response' in reason && 'message' in reason) {
                    const networkError = reason as NetworkError;
                    const responseData = networkError.response.data as TransactionFailed;

                    notification.error({
                        message: networkError.response.data?.title??networkError.message,
                        description: responseData.extras.result_codes.operations.map((v, k) => (<div key={k}>{v}</div>))
                    });
                    return;
                }
            })
            .finally(() => {
                setTimeout(() => setBalancesClaiming(false), 200);
            });
    };

    return (<>
        <Row>
            <Col span={4}/>
            <Col span={16}>
                <AccountSelector />
            </Col>
            <Col span={4}/>
        </Row>
        <Row>
            <Col span={4}/>
            <Col span={16}>
                <ClaimableBalancesOverview />
            </Col>
            <Col span={4}/>
        </Row>
        <Row>
            <Col span={4}/>
            <Col span={16}>
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
            <Col span={4}/>
        </Row>
    </>);
}

import freighterApi, {signTransaction} from "@stellar/freighter-api";
import {notification} from "antd";
import {AccountResponse, Horizon, NetworkError, Networks, Server, TransactionBuilder, xdr} from "stellar-sdk";
import {reasonIsSignatureWeightInsufficient, verifyTransactionSignaturesForAccount} from "../StellarHelpers";
import React from "react";

type TransactionFailed = Horizon.ErrorResponseData.TransactionFailed;
type TransactionResponse = Horizon.TransactionResponse;

export const submitTransaction = (unsignedXDR: string, account: AccountResponse, serverUrl: string, selectedNetwork: "PUBLIC" | "TESTNET") => {
    const server = new Server(serverUrl);
    return signTransaction(unsignedXDR, selectedNetwork)
        .catch(reason => {
            freighterApi.getNetwork().then(network => {
                if (network !== selectedNetwork) {
                    notification['warn']({message: 'The network selected in Freighter ('+network+') does not match currently selected network ('+selectedNetwork+').'});
                } else {
                    notification['warn']({message: 'Freighter: '+ reason});
                }
            });
            throw reason;
        })
        .then(signedXDR => TransactionBuilder.fromXDR(signedXDR, Networks[selectedNetwork]))
        .then(tx => verifyTransactionSignaturesForAccount(tx , account))
        .then(tx => server.submitTransaction(tx))
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
                    description: responseData.extras.result_codes.operations?.map((v, k) => (<div key={k}>{v}</div>))??''
                });
                return;
            }
        })
}
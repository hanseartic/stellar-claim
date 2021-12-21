import freighterApi, {signTransaction} from "@stellar/freighter-api";
import {notification} from "antd";
import {AccountResponse, Horizon, NetworkError, Networks, Server, TransactionBuilder, xdr} from "stellar-sdk";
import {reasonIsSignatureWeightInsufficient, verifyTransactionSignaturesForAccount} from "../StellarHelpers";
import React from "react";
import axios, {AxiosResponse} from 'axios'

type TransactionFailed = Horizon.ErrorResponseData.TransactionFailed;
type TransactionResponse = Horizon.TransactionResponse;

const lobstrMarker = "GA2T6GR7VXXXBETTERSAFETHANSORRYXXXPROTECTEDBYLOBSTRVAULT";

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
            type RealTransactionResponse = (TransactionResponse & { successful: boolean });
            return (submitTransactionResponse as RealTransactionResponse);
        })
        .then(submitTransactionResponse => {
            if (submitTransactionResponse.successful) {
                return submitTransactionResponse;
            }
            const result = xdr.TransactionResult.fromXDR(submitTransactionResponse.result_xdr, 'base64');
            throw result.result().results();
        })
        .then(submitTransactionResponse => {
            if (submitTransactionResponse.successful) {
                notification.success({
                    message: 'The transaction was successfully submitted.',
                });
            }
            return submitTransactionResponse;
        })
        .catch(reason => {
            if (typeof reason === 'string') {
                return;
            }
            if (reasonIsSignatureWeightInsufficient(reason)) {
                if (account.signers.find(s => s.key === lobstrMarker && s.weight === 1)) {
                    axios.post('https://vault.lobstr.co/api/transactions/', { xdr: reason.xdr})
                        .then((res: AxiosResponse) => {
                            console.log(res.status)
                            if (res.status === 200 || res.status === 204) {
                                notification.info({
                                    message: "Transaction was sent to LOBSTR vault",
                                    description: "The current signature weight was not sufficient. Transaction was send to LOBSTR vault for additional signatures.",
                                    duration: 20,
                                })
                            }
                        })
                        .catch(e => notification.error({
                            message: "Could not acquire more signatures from LOBSTR vault",
                            description: e
                        }));
                } else {
                    notification.error({
                        message: 'Transaction signature weight not sufficient',
                        description: <>{`The signature's weight (${reason.signaturesWeight}) does not meet the required threshold for this transaction (${reason.requiredThreshold}).`}<br/>
                            Consider using another key for signing. Multisig is not yet supported.<br/>The XDR
                            is: <code>{reason.xdr}</code></>,
                        duration: 20,
                    });
                }
                return;
            }

            if ('response' in reason && 'message' in reason) {
                const networkError = reason as NetworkError;
                const responseData = networkError.response.data as TransactionFailed;

                if (networkError.response.status === 504) {
                    notification.error({
                        message: 'Gateway timed out',
                        description: (networkError.response.data?.title??networkError.message)
                            + 'This would mostly happen, when the fee offered was not high enough. Please try again.',
                    });
                    return;
                }
                notification.error({
                    message: networkError.response.data?.title??networkError.message,
                    description: responseData.extras.result_codes.operations?.map((v, k) => (<div key={k}>{v}</div>))??''
                });
                return;
            }
        })
}

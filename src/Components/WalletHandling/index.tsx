import freighterApi, {signTransaction} from "@stellar/freighter-api";
import {notification} from "antd";
import {AccountResponse, Horizon, NetworkError, Networks, Server, TransactionBuilder, xdr} from "stellar-sdk";
import {
    reasonIsSignatureWeightInsufficient,
    verifyTransactionSignaturesForAccount
} from "../../StellarHelpers";
import React from "react";
import {WaitForTransactionMessage, WaitForTransactionResponse} from "./waitForTransactionWorker";

type TransactionFailed = Horizon.ErrorResponseData.TransactionFailed;
type TransactionResponse = Horizon.TransactionResponse;
type RealTransactionResponse = (Partial<TransactionResponse & { successful: boolean, vault: boolean }>);

const lobstrMarker = "GA2T6GR7VXXXBETTERSAFETHANSORRYXXXPROTECTEDBYLOBSTRVAULT";

export const submitTransaction = (unsignedXDR: string, account: AccountResponse, serverUrl: string, selectedNetwork: "PUBLIC" | "TESTNET"): Promise<RealTransactionResponse|undefined> => {
    const server = new Server(serverUrl);
    return signTransaction(unsignedXDR, { network: selectedNetwork })
        .catch(reason => {
            freighterApi.getNetworkDetails().then(({ network }) => {
                if (network !== selectedNetwork) {
                    notification.warning({message: 'The network selected in Freighter ('+network+') does not match currently selected network ('+selectedNetwork+').'});
                } else {
                    notification.warning({message: 'Freighter: '+ reason});
                }
            });
            throw reason;
        })
        .then(signedXDR => TransactionBuilder.fromXDR(signedXDR, Networks[selectedNetwork]))
        .then(tx => verifyTransactionSignaturesForAccount(tx , account))
        .then(tx => server.submitTransaction(tx))
        .then(submitTransactionResponse => {
            return (submitTransactionResponse as RealTransactionResponse);
        })
        .then(submitTransactionResponse => {
            if (submitTransactionResponse.successful) {
                return submitTransactionResponse;
            }
            const result = xdr.TransactionResult.fromXDR(submitTransactionResponse.result_xdr!, 'base64');
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
                    return fetch('https://vault.lobstr.co/api/transactions/',{
                        method: "POST",
                        headers: {"content-type": "application/json"},
                        redirect: "follow",
                        body: JSON.stringify({xdr: reason.xdr}),
                    })
                        .then(res => {
                            if (res.status === 201) {
                                notification.info({
                                    message: "Transaction was sent to LOBSTR vault",
                                    description: "The current signature weight was not sufficient. Transaction was send to LOBSTR vault for additional signatures.",
                                    duration: null,
                                    key: "notification:sentToVault",
                                });
                            }
                            return {successful: true, vault: true};
                        })
                        .catch(e => {
                            notification.error({
                                message: "Could not acquire more signatures from LOBSTR vault",
                                description: e
                            });
                            return {vault: true, successful: false};
                        });
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
        .then(r => {
            if (r && ('vault' in r)) {
                return new Promise((resolve, reject) => {
                    const worker = new Worker(new URL('./waitForTransactionWorker.tsx', import.meta.url), {type: "module"});
                    worker.onmessage = ((ev: MessageEvent<WaitForTransactionResponse>) => {
                        resolve({...ev.data, successful: true});
                        worker.terminate();
                    });
                    worker.postMessage(
                        {
                            network: selectedNetwork,
                            accountId: account.id,
                        } as WaitForTransactionMessage
                    );
                })
            }
            return r;
        })
}

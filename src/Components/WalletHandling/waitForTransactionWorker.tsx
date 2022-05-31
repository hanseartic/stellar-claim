import {Networks, Server, ServerApi} from "stellar-sdk";
import { horizonUrls } from "../../StellarHelpers";

export type WaitForTransactionMessage = {
    network: keyof typeof Networks;
    accountId: string;
};

export type WaitForTransactionResponse = {
    accountId: string;
    xdr: string;
    result_xdr: string;
    hash: string;
}

onmessage = (messageEvent: MessageEvent<WaitForTransactionMessage>) => {
    const { accountId, network } = messageEvent.data;
    const serverUrlNetwork = (network === "PUBLIC")
        ? "LOBSTR"
        : network;
    const server = new Server(horizonUrls[serverUrlNetwork]);

    server.transactions().forAccount(accountId).limit(1).order("desc").call()
        .then(({records}) => records[0].paging_token)
        .then(cursor => {
            server.transactions()
                .forAccount(accountId)
                .cursor(cursor)
                .stream({
                    onerror: console.warn,
                    reconnectTimeout: 500,
                    onmessage: (transaction) => {
                        // there is a type error in the API of stream
                        const tx = transaction as unknown as ServerApi.TransactionRecord;
                        const isRelevant = tx.source_account === accountId;
                        if (isRelevant) {
                            postMessage({accountId, xdr: tx.envelope_xdr, result_xdr: tx.result_xdr, hash: tx.hash} as WaitForTransactionResponse);
                        }
                    }
                });
        });
};

export {};

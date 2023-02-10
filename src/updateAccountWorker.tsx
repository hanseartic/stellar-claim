import { Networks, Server } from "stellar-sdk";
import { horizonUrls } from "./StellarHelpers";

export type AccountFetcherMessage = {
    network: keyof typeof Networks;
    accountId: string;
    interval: number;
};
export type AccountFetcherResponse = {
    accountId: string;
    xdr: string;
    result_xdr: string;
    hash: string;
}

let timeout: NodeJS.Timeout;

onmessage = (messageEvent: MessageEvent<AccountFetcherMessage>) => {
    const { accountId, network, interval } = messageEvent.data;
    const server = new Server(horizonUrls[network]);
    console.log(messageEvent.data);

    const pollAccount = (txCursor?: string) => {
        const transactionBuilder = server.transactions().forAccount(accountId);
        if (txCursor) {
            transactionBuilder.cursor(txCursor);
        }
        return transactionBuilder.call()
            .then(({records}) => {
                if (records.length >= 1) {
                    if (!txCursor) {
                        records = records.slice(-1);
                    }
                    records.forEach(tx => {
                        postMessage({accountId, xdr: tx.envelope_xdr, result_xdr: tx.result_xdr, hash: tx.hash} as AccountFetcherResponse);
                    });
                    return;
                }
                return Promise.reject("no new transaction");
            });
    };

    if (interval === 0) {
        console.log("reloading account from worker");
        pollAccount().catch(() => {});
        return;
    }

    if (timeout) {
        clearTimeout(timeout);
        timeout.unref();
    }

    server.transactions().forAccount(accountId).limit(1).order("desc").call()
        .then(({records}) => records[0].paging_token)
        .then(cursor => {
            timeout = setTimeout(function doPoll(txCursor: string) {
                pollAccount(txCursor)
                    .then(() => {
                        clearTimeout(timeout);
                    })
                    .catch(() => {
                        timeout = setTimeout(doPoll, interval, txCursor);
                    });
            }, interval, cursor);
        });
};
export {};

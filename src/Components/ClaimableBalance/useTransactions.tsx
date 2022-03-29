import {useEffect, useState} from "react";
import {ServerApi} from "stellar-sdk";
import {TransactionCallBuilder} from "stellar-sdk/lib/transaction_call_builder";
import URI from "urijs";
import StellarHelpers from "../../StellarHelpers";
import {ClaimableBalanceId} from ".";

export type TransactionRecord = Omit<ServerApi.TransactionRecord,
    "_links"|"envelope_xdr"|"fee_meta_xdr"|"result_xdr"|"result_meta_xdr">;

const cbTransactionsId = (claimableBalanceId: ClaimableBalanceId): string => {
    return "cb:"+claimableBalanceId+":txs";
};

const slimTransactionRecord = (transactionRecord: ServerApi.TransactionRecord): TransactionRecord => {
    return {...transactionRecord,
        _links: undefined,
        envelope_xdr: undefined,
        result_xdr: undefined,
        result_meta_xdr: undefined,
        fee_meta_xdr: undefined} as TransactionRecord
}

const useTransactions = (claimableBalanceId: ClaimableBalanceId): TransactionRecord[] => {
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const {horizonUrl} = StellarHelpers();
    useEffect(() => {
        const txs = sessionStorage.getItem(cbTransactionsId(claimableBalanceId));
        if (null !== txs) {
            setTransactions([JSON.parse(txs)]);
        } else {
            new TransactionCallBuilder(new URI(horizonUrl().href))
                .forClaimableBalance(claimableBalanceId)
                .order("asc")
                .call()
                .then(({records}) => records.map(slimTransactionRecord))
                .then(setTransactions)
                .catch(() => {
                });
        }
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        if (transactions.length > 0) {
            try {
                sessionStorage.setItem(cbTransactionsId(claimableBalanceId), JSON.stringify(transactions[0]));
            } catch {
                sessionStorage.clear();
            }
        }
    }, [claimableBalanceId, transactions]);

    return transactions;
}

export default useTransactions;

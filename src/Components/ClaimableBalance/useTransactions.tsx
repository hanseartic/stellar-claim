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

interface UseTransactionsResult {transactions: TransactionRecord[], state: 'error'|'loaded'|'loading'}
const useTransactions = (claimableBalanceId: ClaimableBalanceId): UseTransactionsResult => {
    const [result, setResult] = useState<UseTransactionsResult>({transactions: [], state: 'loading'});
    const {horizonUrl} = StellarHelpers();
    useEffect(() => {
        const txs = sessionStorage.getItem(cbTransactionsId(claimableBalanceId));
        if (null !== txs) {
            setResult(prev => ({transactions:[JSON.parse(txs)], state: 'loaded'}));
        } else {
            new TransactionCallBuilder(new URI(horizonUrl().href))
                .forClaimableBalance(claimableBalanceId)
                .order("asc")
                .limit(1)
                .call()
                .then(({records}) => records.map(slimTransactionRecord))
                .then(txs => setResult(prev => ({transactions: txs, state: 'loaded'})))
                .catch(() => setResult(prev => ({...prev, state: 'error'})));
        }
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        if (result.state === 'loaded') {
            try {
                sessionStorage.setItem(cbTransactionsId(claimableBalanceId), JSON.stringify(result.transactions[0]));
            } catch {
                sessionStorage.clear();
            }
        }
    }, [claimableBalanceId, result]);

    return result;
}

export default useTransactions;

import {ServerApi, xdr} from "stellar-sdk";
import {PredicateInformation} from "stellar-resolve-claimant-predicates";

import Memo from "./Memo";
import useClaimableBalances from "./useClaimbleBalances";
import useTransactions from "./useTransactions";
import ValidDate from "./ValidDate";


interface Claimant {
    destination: string,
    predicate: xdr.ClaimPredicate,
}

type ClaimableBalanceId = string;
interface ClaimableBalanceRecord extends ServerApi.ClaimableBalanceRecord {
    claimant?: Claimant|null,
    information?: PredicateInformation,
    transactionMemo: string,
}

export {
    type ClaimableBalanceId,
    type ClaimableBalanceRecord,
    Memo,
    useClaimableBalances,
    useTransactions,
    ValidDate,
}

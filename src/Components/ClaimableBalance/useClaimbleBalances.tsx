import loopcall from "@cosmic-plus/loopcall";
import {useEffect, useState} from "react";
import {getPredicateInformation, predicateFromHorizonResponse} from "stellar-resolve-claimant-predicates";
import {Server, ServerApi} from "stellar-sdk";
import {ClaimableBalanceRecord} from ".";
import {AccountState, SelectedAccountInformation} from "../AccountSelector";
import StellarHelpers from "../../StellarHelpers";
import useApplicationState from "../../useApplicationState";

interface ServerClaimableBalanceRecord extends ServerApi.ClaimableBalanceRecord {
    last_modified_time: string
}

const isValidClaimableBalance = (claimableBalance: ClaimableBalanceRecord) => {
    return claimableBalance.information?.status !== 'expired';
}

const dontShowBalancesReasons = new Set([
    AccountState.notSet,
    AccountState.notFound,
    AccountState.invalid,
    undefined,
]);

const useClaimableBalances = (accountInformation: SelectedAccountInformation): ClaimableBalanceRecord[] => {
    const {horizonUrl} = StellarHelpers();
    const [balances, setBalances] = useState<ClaimableBalanceRecord[]>([]);
    const {balancesLoading, setBalancesLoading} = useApplicationState();

    useEffect(() => {
        if (balancesLoading) return;
        if (accountInformation.state === undefined) return;
        setBalancesLoading(true);
        if (dontShowBalancesReasons.has(accountInformation.state)) {
            setBalancesLoading(false);
            setBalances([]);
            return;
        }
        const cb = new Server(horizonUrl().href)
            .claimableBalances()
            .claimant(accountInformation.account!.id);
        loopcall(cb)
            .then((claimableBalanceRecords: ServerApi.ClaimableBalanceRecord[]) => claimableBalanceRecords
                .map(balance => {
                    const currentClaimant = balance.claimants
                        .find(c => c.destination === accountInformation.account!.id)!;
                    const information = getPredicateInformation(
                        predicateFromHorizonResponse(currentClaimant.predicate),
                        new Date()
                    );
                    information.validFrom = information.validFrom
                        ??Date.parse((balance as ServerClaimableBalanceRecord).last_modified_time)/1000
                    return {
                        ...balance,
                        claimant: ({destination: currentClaimant.destination, predicate: information.predicate}),
                        information: information,
                    } as ClaimableBalanceRecord
                })
                .filter(isValidClaimableBalance)
            )
            .then(setBalances)
            .catch(console.warn)
            .then(() => {
                setBalancesLoading(false);
            });
        // eslint-disable-next-line
    }, [accountInformation]);

    return balances;
};

export default useClaimableBalances;

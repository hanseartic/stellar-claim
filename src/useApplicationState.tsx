import {useContext} from 'react';
import {ApplicationState as ApplicationContextState, ApplicationContext} from './ApplicationContext';
import {ServerApi} from "stellar-sdk";
import {SelectedAccountInformation} from "./Components/AccountSelector";
type ClaimableBalanceRecord = ServerApi.ClaimableBalanceRecord;

export interface ApplicationState extends ApplicationContextState {
    setAccountInformation: (accountInformation: Partial<SelectedAccountInformation>) => void;
    setAutoRemoveTrustlines: (autoRemoveTrustlines: boolean) => void;
    setBalancesClaiming: (balancesClaiming: boolean) => void;
    setBalancesLoading: (balancesLoading: boolean) => void;
    setShowBalancesPagination: (showBalancesPagination: boolean) => void;
    setClaimBalancesXDR: (claimBalancesXDR: string) => void;
    setLoadMarket: (loadMarket: boolean) => void;
    setMenuCollapsed: (menuCollapsed: boolean) => void;
    setSelectedBalances: (selectedBalances: ClaimableBalanceRecord[]) => void;
    setUsePublicNetwork: (usePublicNetwork: boolean) => void;
    setWebWorker: (worker?: Worker) => void;
}

// type Setters<Type> = {
//     [Property in keyof Type as `set${Capitalize<string & Property>}`]: (Property: Type[Property]) => void;
// };
// type AWS = Setters<ApplicationContextState>;

const useApplicationState: () => ApplicationState = () => {
    const [state, setState] = useContext(ApplicationContext);

    function setAccountInformation(accountInformation: Partial<SelectedAccountInformation>) {
        setState(state => ({
            ...state,
            accountInformation: {...state.accountInformation, ...accountInformation}
        }));
    }
    function setAutoRemoveTrustlines(autoRemoveTrustlines: boolean) {
        setState(state => ({...state, autoRemoveTrustlines}));
    }
    function setBalancesClaiming(balancesClaiming: boolean) {
        setState(state => ({...state, balancesClaiming}));
    }
    function setBalancesLoading(balancesLoading: boolean) {
        setState(state => ({...state, balancesLoading}));
    }
    function setShowBalancesPagination(showBalancesPagination: boolean) {
        setState(state => ({...state, showBalancesPagination}));
    }
    function setClaimBalancesXDR(claimBalancesXDR: string) {
        setState(state => ({...state, claimBalancesXDR}))
    }
    function setLoadMarket(loadMarket: boolean) {
        setState(state => ({...state, loadMarket}))
    }
    function setMenuCollapsed(menuCollapsed: boolean) {
        setState(state => ({...state, menuCollapsed}));
    }
    function setSelectedBalances(selectedBalances: ClaimableBalanceRecord[]) {
        setState(state => ({...state, selectedBalances}));
    }
    function setUsePublicNetwork(usePublicNetwork: boolean) {
        setState(state => ({...state, usePublicNetwork}));
    }
    function setWebWorker(worker?: Worker) {
        setState(state => ({...state, webWorker: worker}));
    }

    return {
        ...state,
        setAccountInformation,
        setAutoRemoveTrustlines,
        setBalancesClaiming,
        setBalancesLoading,
        setShowBalancesPagination,
        setClaimBalancesXDR,
        setLoadMarket,
        setMenuCollapsed,
        setSelectedBalances,
        setUsePublicNetwork,
        setWebWorker,
    }
}

export default useApplicationState;

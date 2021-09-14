import {useContext} from 'react';
import {ApplicationState as ApplicationContextState, ApplicationContext} from './ApplicationContext';
import {ServerApi} from "stellar-sdk";
import {SelectedAccountInformation} from "./Components/AccountSelector";
type ClaimableBalanceRecord = ServerApi.ClaimableBalanceRecord;

export interface ApplicationState extends ApplicationContextState {
    setAccountInformation: (accountInformation: Partial<SelectedAccountInformation>) => void;
    setBalancesClaiming: (balancesClaiming: boolean) => void;
    setBalancesLoading: (balancesLoading: boolean) => void;
    setClaimBalancesXDR: (claimBalancesXDR: string) => void;
    setSelectedBalances: (selectedBalances: ClaimableBalanceRecord[]) => void;
    setMenuCollapsed: (menuCollapsed: boolean) => void;
    setUsePublicNetwork: (usePublicNetwork: boolean) => void;
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
    function setBalancesClaiming(balancesClaiming: boolean) {
        setState(state => ({...state, balancesClaiming}));
    }
    function setBalancesLoading(balancesLoading: boolean) {
        setState(state => ({...state, balancesLoading}));
    }
    function setClaimBalancesXDR (claimBalancesXDR: string) {
        setState(state => ({...state, claimBalancesXDR}))
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

    return {
        ...state,
        setAccountInformation,
        setBalancesClaiming,
        setBalancesLoading,
        setClaimBalancesXDR,
        setMenuCollapsed,
        setSelectedBalances,
        setUsePublicNetwork,
    }
}

export default useApplicationState;

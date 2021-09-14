import React, {createContext, Dispatch, ReactNode, SetStateAction, useEffect, useState,} from 'react';
import {ServerApi} from "stellar-sdk";
import {SelectedAccountInformation} from './Components/AccountSelector';

type ClaimableBalanceRecord = ServerApi.ClaimableBalanceRecord;


interface ApplicationContextProps {
    children?: ReactNode;
}
interface ApplicationState {
    accountInformation: SelectedAccountInformation;
    autoRemoveTrustlines: boolean;
    balancesClaiming: boolean;
    balancesLoading: boolean;
    claimBalancesXDR?: string;
    donate: number;
    menuCollapsed: boolean;
    selectedBalances: ClaimableBalanceRecord[];
    usePublicNetwork: boolean;
}
type SetApplicationState = Dispatch<SetStateAction<ApplicationState>>;

const defaultState: ApplicationState = {
    accountInformation: {account: undefined, state: undefined},
    autoRemoveTrustlines: true,
    balancesClaiming: false,
    balancesLoading: false,
    donate: 0,
    menuCollapsed: true,
    usePublicNetwork: true,
    selectedBalances: [],
};
const ApplicationContext = createContext<[ApplicationState, SetApplicationState]>([defaultState, () => {}]);

const ApplicationContextProvider = (props: ApplicationContextProps) => {
    const usePublicNetwork = !!JSON.parse(localStorage.getItem('usePublicNetwork')??'true');
    const menuCollapsed = !!JSON.parse(localStorage.getItem('menuCollapsed')??'true');
    const autoRemoveTrustlines = !!JSON.parse(localStorage.getItem('autoRemoveTrustlines')??'true');

    const [ state, setState ] = useState<ApplicationState>({
        ...defaultState,
        menuCollapsed: menuCollapsed,
        usePublicNetwork: usePublicNetwork,
        autoRemoveTrustlines: autoRemoveTrustlines,
    });

    useEffect(() => {
        localStorage.setItem('usePublicNetwork', state.usePublicNetwork?'true':'false');
        localStorage.setItem('menuCollapsed', state.menuCollapsed?'true':'false');
        localStorage.setItem('autoRemoveTrustlines', state.autoRemoveTrustlines?'true':'false');
    }, [state.usePublicNetwork, state.menuCollapsed, state.autoRemoveTrustlines]);

    return (
        <ApplicationContext.Provider value={[state, setState]} children={props.children} />
    );
};

export {ApplicationContext, ApplicationContextProvider};
export type { ApplicationState, SetApplicationState };

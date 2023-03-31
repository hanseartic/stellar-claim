import {Button, Popover} from "antd";
import freighterLogo from './freighter.png';
import React, {useEffect, useState} from "react";
import freighterApi from '@stellar/freighter-api';
import useApplicationState from "../../useApplicationState";

interface FreighterButtonProps {
    onAccount?: (account: string) => void;
}

export default function FreighterButton(props: FreighterButtonProps) {
    const [freighterAvailable, setFreighterAvailable] = useState<boolean>();
    const {balancesLoading} = useApplicationState();
    const loadAccountDataFromFreighter = () => {
        freighterApi.getPublicKey()
            .then(key => props.onAccount && props.onAccount(key))
    }
    useEffect(() => {
        const freighterIsConnected = freighterApi.isConnected();
        if (true === freighterIsConnected) {
            setFreighterAvailable(freighterIsConnected);
        } else {
            freighterIsConnected.then(isConnected => setFreighterAvailable(isConnected));
        }
    }, [balancesLoading]);

    const freighterExtensionNotInstalled = (
        <div>
            <div>Freighter extension is not installed</div>
            <div>Get it from <a href='https://freighter.app' target='_blank' rel='noopener noreferrer'>freighter.app</a>.</div>
        </div>
    );
    const freighterExtensionInstalled = (
        <div>
            <div>Click the Freighter symbol to load the currently selected account into the search box.</div>
            <div>If you have configured multiple accounts in Freighter, select the one to use from within the Freighter extension.</div>
        </div>
    );
    return (
        <Popover placement="topLeft" title="Load account from Freighter" content={freighterAvailable?freighterExtensionInstalled:freighterExtensionNotInstalled}>
            <Button
                type={"link"} onClick={loadAccountDataFromFreighter}
                disabled={!freighterAvailable || balancesLoading}>
                <img alt="Load account from Freighter"
                     src={freighterLogo} style={{height: "1.8em", opacity: freighterAvailable?1:0.3}} />
            </Button>
        </Popover>
    );
}
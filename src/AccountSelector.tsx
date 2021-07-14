import React, { useEffect, useState } from 'react';
import { Alert, AlertProps, Collapse, Input } from 'antd';
import { AccountResponse, Keypair, NetworkError, NotFoundError, Server } from 'stellar-sdk';
import FreighterButton from './FreighterButton';
import useApplicationState from './useApplicationState';
import StellarHelpers, { shortAddress } from "./StellarHelpers";
import { MessageOutlined, UpOutlined } from "@ant-design/icons";
import { useParams } from 'react-router-dom';

const defaultAlertProps: AlertProps = {
    message: '',
    type: undefined,
    description: undefined,
};

export enum AccountState {
    notSet, valid, invalid, notFound,
}
export interface SelectedAccountInformation {
    account?: AccountResponse,
    state?: AccountState,
}

const validAccountStates = new Set([
    AccountState.notSet,
    AccountState.valid,
    undefined
]);
export default function AccountSelector() {
    const { account: accountParam } = useParams<{account?: string}>();
    const [ accountId, setAccountId ] = useState<string>(accountParam??'');
    const [ showAlert, setShowAlert ] = useState<boolean>(false);
    const [ alertProps, setAlertProps ] = useState<AlertProps>(defaultAlertProps);
    const { accountInformation, balancesLoading, setAccountInformation, setUsePublicNetwork, usePublicNetwork } = useApplicationState();
    const {horizonUrl} = StellarHelpers();
    const inputChangedHandler = (input: string) => setAccountId(input);

    useEffect(() => {
        setAccountInformation({state: undefined});
        new Promise<SelectedAccountInformation>(
            (resolve) => {
                const information: SelectedAccountInformation = {account: undefined};
                if (accountId.length === 0) {
                    information.state = AccountState.notSet;
                } else if (accountId.length < 56) {
                    information.state = AccountState.invalid;
                }
                if (information.state === undefined) {
                    const serverPromise = new Server(horizonUrl().href)
                        .loadAccount(accountId)
                        .then(loadedAccount => {
                            information.account = loadedAccount;
                            information.state = AccountState.valid;
                            return information;
                        })
                        .catch(e => {
                            console.warn((e as NetworkError).response);
                            if (e instanceof NotFoundError) {
                                information.state = AccountState.notFound;
                            } else if (e instanceof NetworkError) {
                                information.state = AccountState.invalid;
                            }
                            return information;
                        });
                    resolve(serverPromise);
                } else {
                    resolve(information);
                }
            })
            .then(setAccountInformation);
        // eslint-disable-next-line
    }, [accountId, usePublicNetwork]);
    useEffect(() => {if (balancesLoading) setShowAlert(false);}, [balancesLoading]);
    useEffect(() => {
        setShowAlert(!validAccountStates.has(accountInformation.state));
        if (accountInformation.state === AccountState.invalid) {
            setAlertProps(p => ({...p,
                message: `Address ${shortAddress(accountId, 20)} is not a valid address`,
                description: `Stellar addresses begin with a G and consist of 56 characters.`,
                type: "warning",
            }));
        }
        if (accountInformation.state === AccountState.notFound) {
            setAlertProps(p => ({...p,
                message: `Account ${shortAddress(accountId, 7)} not found`,
                // eslint-disable-next-line
                description: <>The account does not exist on <em>{usePublicNetwork?'public':'test'}</em> network (e.g. it was not funded yet). Consider <a href="#" onClick={() => setUsePublicNetwork(!usePublicNetwork)}>switching</a> networks.</>,
                type: "error",
            }));
        }
        // eslint-disable-next-line
    }, [accountInformation.state, accountId])

    const accountInput = <Input
        allowClear
        placeholder={Keypair.random().publicKey()}
        onChange={(e) => inputChangedHandler(e.target.value)}
        minLength={56}
        maxLength={56}
        size={'large'}
        value={accountId}
        disabled={balancesLoading}
        addonBefore={<FreighterButton onAccount={inputChangedHandler} />}
    />;

    return (
        <div >
            <Collapse ghost className="ant-no-padding" activeKey={showAlert?"alert":[]} style={{padding: 0, margin: 0}}>
                <Collapse.Panel className="ant-no-padding" key="alert" header={accountInput} showArrow={false} style={{padding: 0, margin: 0}}>
                    <Alert
                        action={<UpOutlined onClick={() => {
                            setShowAlert(false);
                        }} />}
                        icon={<MessageOutlined />}
                        closable={false}
                        description={alertProps.description}
                        message={alertProps.message}
                        showIcon={true}
                        type={alertProps.type}
                    />
                </Collapse.Panel>
            </Collapse>
        </div>
    );
}

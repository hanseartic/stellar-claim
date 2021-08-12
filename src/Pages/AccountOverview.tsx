import {Badge, Card, Table} from 'antd';
import React, {useEffect, useState} from 'react';
import AccountSelector from '../AccountSelector';
import useApplicationState from "../useApplicationState";
import AssetPresenter from "../ClaimableBalancesList/AssetPresenter";
import {BigNumber} from 'bignumber.js';
import {Link} from 'react-router-dom';
import StellarHelpers, {shortAddress} from "../StellarHelpers";
import URI from 'urijs';
import {TransactionCallBuilder} from "stellar-sdk/lib/transaction_call_builder";
import {Horizon, ServerApi} from "stellar-sdk";

type AccountBalanceRecord = {
    asset: string,
    balance: BigNumber,
    buyingLiabilities: BigNumber,
    sellingLiabilities: BigNumber,
    spendable: BigNumber,
};

const balancesTableColumns = () => [
    {
        key: 'asset',
        dataIndex: 'asset',
        render: (asset: string) => <AssetPresenter code={asset} />,
    },
    {
        key: 'balance',
        render: (record: AccountBalanceRecord) => (<>
            <Badge.Ribbon
                color='red'
                style={{display: (record.sellingLiabilities.isZero()?"none":"")}}
                text={record.sellingLiabilities.isZero()?'':'Selling: '+record.sellingLiabilities.toFormat()}>
            <Badge.Ribbon
                color='lime'
                style={{marginTop: record.sellingLiabilities.isZero()?0:30, display: (record.buyingLiabilities.isZero()?"none":"")}}
                text={record.buyingLiabilities.isZero()?'':'Buying: '+record.buyingLiabilities.toFormat()}>
            <Card size='small' title={record.spendable.toFormat() + ' spendable'}>
                <p>{record.balance.sub(record.spendable).toFormat()} reserved</p>
                <b>{record.balance.toFormat()} total</b>
            </Card>
        </Badge.Ribbon></Badge.Ribbon></>)
    }
];

export default function AccountOverview() {
    const {horizonUrl} = StellarHelpers();
    const { accountInformation, } = useApplicationState();
    const [accountBalances, setAccountBalances] = useState<AccountBalanceRecord[]>([]);
    const [accountCreated, setAccountCreated] = useState<{date?: string, by?: string}>({})

    useEffect(() => {

        if (accountInformation.account) {
            new TransactionCallBuilder(new URI(horizonUrl()))
                .forAccount(accountInformation.account.id)
                .order('asc')
                .limit(1)
                .call()
                .then(({records}) => records.pop())
                .then(record => record?.operations())
                .then(operations => operations?.records.find(op => op.type === Horizon.OperationResponseType.createAccount) as ServerApi.CreateAccountOperationRecord)
                .then((createAccountOperation: ServerApi.CreateAccountOperationRecord) => {
                    setAccountCreated({by: createAccountOperation.funder, date: createAccountOperation.created_at});
                });

            setAccountBalances(accountInformation.account?.balances.map(
                (balanceLine) => {
                    let reserves = new BigNumber(0);
                    if (balanceLine.asset_type === 'native') {
                        const subentryCount = new BigNumber(accountInformation.account?.subentry_count??0);
                        reserves = reserves
                            // reserves for data-entries, offers, signers, trust-lines
                            .add(subentryCount.isZero() ? 0 : subentryCount.div(2))
                            // account base reserve
                            .add(1);
                    }

                    return {
                        asset: balanceLine.asset_type !== 'native'
                            ? `${balanceLine.asset_code}:${balanceLine.asset_issuer}`
                            : 'native:XLM',
                        balance: new BigNumber(balanceLine.balance),
                        buyingLiabilities: new BigNumber(balanceLine.buying_liabilities),
                        sellingLiabilities: new BigNumber(balanceLine.selling_liabilities),
                        spendable: new BigNumber(balanceLine.balance)
                            .sub(new BigNumber(balanceLine.selling_liabilities))
                            .sub(reserves)
                    };
                }
            ));
        }
    }, [accountInformation.account]);

    return (<>
        <AccountSelector />
        <>Account {shortAddress(accountInformation.account?.id??'', 9)} created on {accountCreated.date} by <Link to={'/account/'+accountCreated.by}>{shortAddress(accountCreated.by??'', 9)}</Link></>
        <Table
            showHeader={false}
            columns={balancesTableColumns()}
            dataSource={accountBalances}
            rowKey='asset'
            pagination={false}
        />
    </>);
};

import {Table} from 'antd';
import React, {useEffect, useState} from 'react';
import AccountSelector from '../Components/AccountSelector';
import useApplicationState from '../useApplicationState';
import AssetPresenter from '../Components/AssetPresenter';
import {BigNumber} from 'bignumber.js';
import StellarHelpers, {shortAddress} from '../StellarHelpers';
import URI from 'urijs';
import {TransactionCallBuilder} from 'stellar-sdk/lib/transaction_call_builder';
import {Horizon, ServerApi} from 'stellar-sdk';
import StellarAddressLink from '../Components/StellarAddressLink';
import BalanceCard, { AccountBalanceRecord } from "../Components/BalanceCard";

type BalanceLineAsset = Horizon.BalanceLineAsset;
type BalanceLineNative = Horizon.BalanceLineNative;
type BalanceLine = Horizon.BalanceLine;

const balancesTableColumns = [
    {
        key: 'asset',
        dataIndex: 'asset',
        render: (asset: string) => <AssetPresenter code={asset} />,
    },
    {
        key: 'balance',
        render: (balanceRecord: AccountBalanceRecord) => <BalanceCard balanceRecord={balanceRecord} />
    }
];

export default function AccountOverview() {
    const {horizonUrl} = StellarHelpers();
    const {accountInformation} = useApplicationState();
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
                })
                .catch(() => setAccountCreated({}));

            setAccountBalances(accountInformation.account?.balances
                .filter((b: BalanceLine): b is (BalanceLineAsset|BalanceLineNative) =>
                    b.asset_type !== 'liquidity_pool_shares'
                )
                .map((balanceLine) => {
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
                        account: accountInformation.account!,
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
        } else {
            setAccountBalances([]);
        }
        // eslint-disable-next-line
    }, [accountInformation.account]);

    return (<>
        <AccountSelector />
        <>Account {shortAddress(accountInformation.account?.id??'', 9)} created on {accountCreated.date} by <StellarAddressLink id={accountCreated.by} length={9} /></>
        <Table
            showHeader={false}
            columns={balancesTableColumns}
            dataSource={accountBalances}
            rowKey='asset'
            pagination={false}
        />
    </>);
};

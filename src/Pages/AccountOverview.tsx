import {Col, FloatButton, Row, Table, TablePaginationConfig} from 'antd';
import React, {ReactNode, useEffect, useState} from 'react';
import AccountSelector from '../Components/AccountSelector';
import useApplicationState from '../useApplicationState';
import AssetPresenter from '../Components/AssetPresenter';
import {BigNumber} from 'bignumber.js';
import StellarHelpers, {shortAddress} from '../StellarHelpers';
import {Horizon, Server, ServerApi} from 'stellar-sdk';
import StellarAddressLink from '../Components/StellarAddressLink';
import BalanceCard, { AccountBalanceRecord } from "../Components/BalanceCard";
import { AssetRecord } from 'stellar-sdk/lib/types/assets';

type BalanceLine = Exclude<Horizon.BalanceLine, Horizon.BalanceLineLiquidityPool>;

const AssetEntry = (balanceRecord: AccountBalanceRecord) => <Row justify="space-around" align="middle">
    <Col flex="auto" >
        <AssetPresenter code={balanceRecord.asset} />
    </Col>
    <Col flex="400px">
        <BalanceCard balanceRecord={balanceRecord} />
    </Col>
</Row>;


export default function AccountOverview() {
    const {horizonUrl} = StellarHelpers();
    const {accountInformation, showBalancesPagination, loadMarket} = useApplicationState();
    const [accountBalances, setAccountBalances] = useState<AccountBalanceRecord[]>([]);
    const [accountCreated, setAccountCreated] = useState<{date?: string, by?: string}>({});
    const [xlmEntry, setXlmEntry] = useState<ReactNode>(null);

    const balancesTableColumns = [
        {
            title: xlmEntry,
            key: 'assetRecord',
            render: (record: AccountBalanceRecord) => <AssetEntry {...record} />
        }
    ];

    useEffect(() => {

        if (accountInformation.account) {
            new Server(horizonUrl().href).transactions()
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

            const accountBalances = accountInformation.account?.balances
                .filter((b): b is BalanceLine => b.asset_type !== 'liquidity_pool_shares')
                .map((balanceLine) => {
                    let reserves = new BigNumber(0);
                    if (balanceLine.asset_type === 'native') {
                        const subentryCount = new BigNumber(accountInformation.account?.subentry_count??0);
                        reserves = reserves
                            // reserves for data-entries, offers, signers, trust-lines
                            .plus(subentryCount.isZero() ? 0 : subentryCount.div(2))
                            // account base reserve
                            .plus(1);
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
                            .minus(new BigNumber(balanceLine.selling_liabilities))
                            .minus(reserves),
                        showAsStroop: false
                    };
                });
            setXlmEntry(<AssetEntry {...accountBalances.find(b => b.asset === 'native:XLM')!} />);

            new Server(horizonUrl().href)
                .assets()
                .forIssuer(accountInformation.account!.id)
                .call()
                .then(({records}) => (records as (AssetRecord & {liquidity_pools_amount: string})[])
                    .map(r => {
                        const amount = new BigNumber(Number.MAX_SAFE_INTEGER)
                          .minus(r.amount)
                          .minus(r.claimable_balances_amount)
                          .minus(r.liquidity_pools_amount);
                        const accountIssuedAsset = `${r.asset_code}:${r.asset_issuer}`;
                        return ({
                            account: accountInformation.account!,
                            asset: accountIssuedAsset,
                            spendable: amount,
                            balance: amount,
                            sellingLiabilities: new BigNumber(0),
                            buyingLiabilities: new BigNumber(0),
                            showAsStroop: false,
                        }) as AccountBalanceRecord
                  }))
                .then(b => b.concat(accountBalances) as AccountBalanceRecord[])
                .then(balances => balances.filter(balance => balance.asset !== 'native:XLM'))
                .then(setAccountBalances);
        } else {
            setAccountBalances([]);
        }
        // eslint-disable-next-line
    }, [accountInformation.account, loadMarket]);

    const paginationConfig = { position: ['bottomCenter'], defaultPageSize: 10, hideOnSinglePage: true, } as TablePaginationConfig

    return (<>
        <AccountSelector />
        <>Account {shortAddress(accountInformation.account?.id??'', 9)} created on {accountCreated.date} by <StellarAddressLink id={accountCreated.by} length={9} /></>
        <FloatButton.BackTop visibilityHeight={50} />
        <Table
            showHeader={true}
            sticky
            scroll={{x: 'max-content'}}
            columns={balancesTableColumns}
            dataSource={accountBalances}
            rowKey='asset'
            pagination={showBalancesPagination ? paginationConfig : false}
        />
    </>);
};

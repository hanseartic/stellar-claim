import {Table} from 'antd';
import React, {useEffect, useState} from 'react';
import AccountSelector from '../Components/AccountSelector';
import useApplicationState from '../useApplicationState';
import AssetPresenter from '../Components/AssetPresenter';
import {BigNumber} from 'bignumber.js';
import StellarHelpers, {getStellarAsset, shortAddress} from '../StellarHelpers';
import {Horizon, Server, ServerApi} from 'stellar-sdk';
import StellarAddressLink from '../Components/StellarAddressLink';
import BalanceCard, { AccountBalanceRecord } from "../Components/BalanceCard";

type BalanceLine = Exclude<Horizon.BalanceLine, Horizon.BalanceLineLiquidityPool>;

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
    const {getSelectedNetwork, horizonUrl} = StellarHelpers();
    const {accountInformation} = useApplicationState();
    const [accountBalances, setAccountBalances] = useState<AccountBalanceRecord[]>([]);
    const [accountCreated, setAccountCreated] = useState<{date?: string, by?: string}>({})

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
                .filter((b): b is BalanceLine =>
                    b.asset_type !== 'liquidity_pool_shares'
                )
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
                }
            ).map(async (balance) => {
                if (balance.asset === 'native:XLM') {
                    return balance;
                }
                const showAsStroopKey = 'showAsStroops.'+getSelectedNetwork();
                const showAsStroops: () => {[key: string]: boolean} = () => JSON.parse(localStorage.getItem(showAsStroopKey)??"{}");
                let showAsStroop = false;
                if (Object.keys(showAsStroops()).includes(balance.asset)) {
                    showAsStroop = showAsStroops()[balance.asset];
                } else {
                    const asset = await (async () => {
                        const sAsset = getStellarAsset(balance.asset);
                        return await new Server(horizonUrl().href).assets()
                            .forCode(sAsset.getCode()).forIssuer(sAsset.getIssuer())
                            .call()
                            .then(({records}) => records.pop());
                    })();
                    if (asset) {
                        showAsStroop = new BigNumber(asset.amount??0).lt(1);
                        const currentAssetAsStroops: {[key: string]: boolean} = {};
                        currentAssetAsStroops[balance.asset] = showAsStroop;
                        localStorage.setItem(showAsStroopKey, JSON.stringify({...showAsStroops(),  ...currentAssetAsStroops}));
                    }
                }
                return {
                    ...balance,
                    showAsStroop: showAsStroop
                };
            });

            Promise.all(accountBalances).then(setAccountBalances);
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

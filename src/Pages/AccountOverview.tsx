import { Table } from 'antd';
import React, {useEffect, useState} from 'react';
import AccountSelector from '../AccountSelector';
import useApplicationState from "../useApplicationState";
import AssetPresenter from "../ClaimableBalancesList/AssetPresenter";

const balancesTableColumns = () => [
    {
        dataIndex: 'asset',
        render: (asset: string) => <AssetPresenter code={asset} />,
    },
    {
        dataIndex: 'balance',
    }
];

export default function AccountOverview() {
    const { accountInformation, } = useApplicationState();
    const [accountBalances, setAccountBalances] = useState<any[]>();

    useEffect(() => {
        if (accountInformation.account) {
            console.log(accountInformation.account.balances);
            setAccountBalances(accountInformation.account?.balances.map(
                (balanceLine) => ({
                    asset: balanceLine.asset_type !== 'native'
                        ? `${balanceLine.asset_code}:${balanceLine.asset_issuer}`
                        : 'native:XLM',
                    balance: balanceLine.balance,
                    buyingLiabilities: balanceLine.buying_liabilities,
                    sellingLiabilities: balanceLine.selling_liabilities,

                })
            ));
        }
    }, [accountInformation.account]);

    return (<>
        <AccountSelector />
        <Table
            columns={balancesTableColumns()}
            dataSource={accountBalances}
            key="asset"
            pagination={{defaultPageSize: 100}}
        />
    </>);
};

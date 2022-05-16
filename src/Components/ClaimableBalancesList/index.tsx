import React, {useEffect, useState} from "react";
import {Table, TablePaginationConfig} from "antd";
import {ColumnsType, TableRowSelection} from "antd/lib/table/interface";
import useApplicationState from "../../useApplicationState";
import AssetPresenter from "../AssetPresenter";

import {AccountState} from "../AccountSelector";
import StellarAddressLink from "../StellarAddressLink";
import {ClaimableBalanceRecord, Memo, useClaimableBalances, ValidDate} from "../ClaimableBalance";
import AssetAmount from "../AssetAmount";


const tableColumns: ColumnsType<ClaimableBalanceRecord> = [
    {
        width: '21em',
        title: 'Asset',
        dataIndex: 'asset',
        key: 'asset',
        render: (asset: string) => <AssetPresenter code={asset} />,
    },
    {
        width: '9em',
        title: 'Amount',
        key: 'amount',
        render: (cb: ClaimableBalanceRecord) => <AssetAmount amount={cb.amount} asset={cb.asset} />,
    },
    {
        width: '6em',
        title: 'Sender',
        dataIndex: 'sponsor',
        key: 'sponsor',
        render: (address: string) => <StellarAddressLink id={address} length={9} />,
        responsive: ['xxl', 'xl', 'lg', 'md', ],
    },
    {
        width: '28ch',
        title: 'Memo',
        dataIndex: 'id',
        responsive: ['xxl', 'xl', 'lg', 'md', 'sm'],
        render: id => <Memo claimableBalanceId={id} />,
    },
    {
        width: '12em',
        title: 'Claimable after',
        key: 'valid_from',
        dataIndex: ['information', 'validFrom'],
        render: (validFrom: number|undefined) => <ValidDate
            date={validFrom}
            // should not happen but marks when protocol 15 went live
            fallback={Date.parse('Mon Nov 23 2020 16:00:00 GMT+0000')/1000} />,
        responsive: ['xxl', 'xl'],
    },
    {
        width: '12em',
        title: 'Expires',
        key: 'valid_to',
        dataIndex: ['information', 'validTo'],
        render: (validTo: number|undefined) => <ValidDate date={validTo} fallback={"never"} />,
        responsive: ['xxl', 'xl', 'lg'],
    }
];

export default function ClaimableBalancesOverview() {
    const {accountInformation, balancesClaiming, balancesLoading, usePublicNetwork, setSelectedBalances} = useApplicationState();
    const balances = useClaimableBalances(accountInformation);
    const [selectedBalanceIds, setSelectedBalanceIds] = useState<React.Key[]>([]);

    useEffect(() => {
        setSelectedBalances(balances.filter(b => selectedBalanceIds.includes(b.id)));
        // eslint-disable-next-line
    }, [selectedBalanceIds]);

    useEffect(() => {
        setSelectedBalanceIds([]);
    }, [balances]);

    // TODO: calculate available selections based on existing trust-lines
    const maxSelect = 30;
    const selectRow = (row: ClaimableBalanceRecord, e: React.UIEvent) => {
        e.preventDefault();
        const selectedIds = [...selectedBalanceIds];
        const selectedIndex = selectedIds.indexOf(row.id);
        if (selectedIndex >= 0) {
            selectedIds.splice(selectedIndex, 1);
        } else {
            if (selectedIds.length < maxSelect
                && accountInformation.state !== AccountState.notSet
                && !balancesClaiming
            ) {
                selectedIds.push(row.id);
            }
        }
        setSelectedBalanceIds(selectedIds);
    };

    const pagination: TablePaginationConfig = {
        hideOnSinglePage: false,
        position: ['bottomCenter'],
        showSizeChanger: false,
    };

    const rowSelection: TableRowSelection<ClaimableBalanceRecord> = {
        selectedRowKeys: selectedBalanceIds,
        preserveSelectedRowKeys: false,
        type: 'checkbox',
        onChange: (selectedRowKeys, selectedRows) => {
            setSelectedBalanceIds(selectedRowKeys.slice(0, maxSelect));
        },

        getCheckboxProps: (record: ClaimableBalanceRecord) => ({
            disabled: balancesClaiming
                || accountInformation.state === AccountState.notSet
                || (!selectedBalanceIds.includes(record.id)
                    && selectedBalanceIds.length >= maxSelect)
                || (record.information?.status !== 'claimable'),
        }),
    };

    // const tableSummary = (data: readonly ClaimableBalanceRecord[]) => (<Collapse ghost><Collapse.Panel header="" key="1" extra={<InfoCircleOutlined />} showArrow={false}>
    //     <Row gutter={1}>
    //         <Col span={6}><Tooltip title={`You can claim up to ${maxSelect} balances in one transaction.`}><Statistic title="Selected for claim" value={selectedBalanceIds.length} suffix={`/ ${maxSelect}`}/></Tooltip></Col>
    //     </Row>
    // </Collapse.Panel></Collapse>
    // )

    return (<Table
        columns={tableColumns}
        dataSource={balances}
        loading={balancesLoading}
        pagination={pagination}
        rowKey="id"
        onRow={(record) => ({
            onClick: (e) => e.target instanceof HTMLAnchorElement || selectRow(record, e)
        })}
        rowSelection={rowSelection}
        scroll={{x: 'max-content'}}
        sticky={true/*{offsetHeader: 0, offsetScroll: 200}*/}
        //footer={tableSummary}
        title={() => (<span>Balances ready to claim on <b>{usePublicNetwork?'public':'test'}</b> network.</span>)}
    />);
}

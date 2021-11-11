import React, {useEffect, useState} from 'react';
import {Table, TablePaginationConfig} from 'antd';
import {ColumnsType, TableRowSelection} from 'antd/lib/table/interface';
import useApplicationState from '../../useApplicationState';
import StellarHelpers, {cachedFetch, getStellarAsset} from '../../StellarHelpers';
import AssetPresenter from '../AssetPresenter';
import {Horizon, ServerApi} from 'stellar-sdk';
import {TransactionCallBuilder} from "stellar-sdk/lib/transaction_call_builder";
import {AccountState} from '../AccountSelector';
import {useParams} from 'react-router-dom';
import StellarAddressLink from '../StellarAddressLink';
import URI from 'urijs';
import BigNumber from "bignumber.js";

interface ClaimableBalanceRecord extends ServerApi.ClaimableBalanceRecord {
    transaction_memo?: string,
    valid_to?: Date,
    valid_from?: Date,
    destination?: Horizon.Claimant|null,
}

const loadBalancesMax = 300;

const tableColumns = (): ColumnsType<ClaimableBalanceRecord> => [
    {
        title: 'Amount',
        dataIndex: 'amount',
        key: 'amount',
        render: (amount: string) => new BigNumber(amount).round(8).toFormat(),
    },
    {
        title: 'Asset',
        dataIndex: 'asset',
        key: 'asset',
        render: (asset: string) => <AssetPresenter code={asset} />,

    },
    {
        title: 'Sender',
        dataIndex: 'sponsor',
        key: 'sponsor',
        render: (address: string) => <StellarAddressLink id={address} length={9} />,
    },
    {
        title: 'Memo',
        dataIndex: 'transaction_memo',
    },
    {
        title: 'Claimable after',
        dataIndex: 'valid_from',
        render: (validFrom: Date|undefined) => validFrom
            ? validFrom.toLocaleString()
            // should not happen but marks when protocol 15 went live
            : new Date(Date.parse('Mon Nov 23 2020 16:00:00 GMT+0000')).toUTCString()
    },
    {
        title: 'Expires',
        dataIndex: 'valid_to',
        render: (validTo: Date|undefined) => validTo
            ? validTo.toLocaleString()
            : 'never'
    }
];

interface LoadClaimableBalancesParams {
    baseUrl: URL;
    onPage: (itemCount: number, current: string, next?: string) => void;
    maxItems?: number;
    searchParams: URLSearchParams;
}

const isValidClaimableBalance = (claimableBalance: ClaimableBalanceRecord) => {
    const activationDate = getClaimableBalanceActivationDate(claimableBalance);
    if (activationDate && activationDate.getTime() >= Date.now()) {
        //return false;
    }
    const expiryDate = getClaimableBalanceExpirationDate(claimableBalance);
    if (expiryDate && expiryDate.getTime() <= Date.now()) {
        return false;
    }
    return true;
}

const getClaimableBalanceExpirationDate = (claimableBalance: ClaimableBalanceRecord) => {
    return claimableBalance.destination?.predicate.abs_before
        ? new Date(Date.parse(claimableBalance.destination.predicate.abs_before))
        : undefined;
}

const getClaimableBalanceActivationDate = (claimableBalance: ClaimableBalanceRecord) => {
    return claimableBalance.destination?.predicate.not?.abs_before
        ? new Date(Date.parse(claimableBalance.destination.predicate.not.abs_before))
        : undefined;
}

const loadClaimableBalances = async ({baseUrl, onPage, maxItems, searchParams}: LoadClaimableBalancesParams) => {
    const accountsUrl = new URL('/accounts/', baseUrl);
    const claimableBalancesUrl = new URL('/claimable_balances', baseUrl);
    searchParams.forEach((v, k) => claimableBalancesUrl.searchParams.set(k, v));

    return fetch(claimableBalancesUrl.href)
        .then(result => result.json())
        .then(async (json) => {
            const records: ClaimableBalanceRecord[] = json._embedded.records
                .map((r:ServerApi.ClaimableBalanceRecord) => ({...r, destination: r.claimants.find(c => c.destination === searchParams.get('claimant'))}) as ClaimableBalanceRecord)
                .filter((claimableBalanceRecord: ClaimableBalanceRecord) =>
                    isValidClaimableBalance(claimableBalanceRecord)
                )
            ;
            // only show records, that have a funded issuer account
            const filteredRecords = await Promise
                .all(records.map(r => {
                    const asset = getStellarAsset(r.asset);
                    if (asset.isNative()) return true;
                    return cachedFetch(new URL(asset.getIssuer(), accountsUrl).href)
                        .then(res => res.status === 200);
                }))
                .then(issuerFunded => records.filter((_, index) => issuerFunded[index]))
                .then(async filteredRecords => await Promise.all(filteredRecords.map(record => {
                    return new TransactionCallBuilder(new URI(baseUrl))
                        .forClaimableBalance(record.id)
                        .call()
                        .then(({records: transactionRecords}) => ({
                            ...record,
                            transaction_memo: transactionRecords[0]?.memo,
                            valid_to: getClaimableBalanceExpirationDate(record),
                            // when there is no time-bound set use the ledger time
                            valid_from: getClaimableBalanceActivationDate(record)??new Date(Date.parse(transactionRecords[0].created_at)),
                        } as ClaimableBalanceRecord))
                })));

            const nextCursor = json._links.self.href !== json._links.next.href
                ? new URL(json._links.next.href).searchParams.get('cursor')??''
                : undefined;

            onPage(filteredRecords.length, json._links.self.href, nextCursor);
            if (maxItems && maxItems > filteredRecords.length && nextCursor) {
                searchParams.set('cursor', nextCursor);
                const more = await loadClaimableBalances({
                    baseUrl: baseUrl,
                    onPage: onPage,
                    maxItems: maxItems-filteredRecords.length,
                    searchParams: searchParams,
                });
                filteredRecords.push.apply(filteredRecords, more);
            }

            return filteredRecords;
        });
}
const dontShowBalancesReasons = new Set([AccountState.notFound, AccountState.invalid, undefined]);
export default function ClaimableBalancesOverview() {
    const {horizonUrl} = StellarHelpers();

    const { account: accountParam } = useParams<{account?: string}>();
    const {accountInformation, balancesClaiming, balancesLoading, usePublicNetwork, setBalancesLoading, setSelectedBalances} = useApplicationState();
    const [balances, setBalances] = useState<ClaimableBalanceRecord[]>([]);
    const [selectedBalanceIds, setSelectedBalanceIds] = useState<React.Key[]>([]);
    const [pagination, setPagination] = useState<TablePaginationConfig>({
        hideOnSinglePage: false,
        position: ['bottomCenter'],
        showSizeChanger: false,
    })

    const onBalancePageLoaded = (itemCount: number) => {
        setPagination(p => ({...p, total: ((p.total??0) + itemCount),}));
    };

    const reload = () => {
        if (balancesLoading) return;
        if (accountParam && accountInformation.state === undefined) return;

        setSelectedBalanceIds([]);
        setPagination(p => ({...p, total: 0,}));
        if (dontShowBalancesReasons.has(accountInformation.state)) {
            setBalancesLoading(false);
            setBalances([]);
            return;
        }
        setBalancesLoading(true);
        const searchParams: URLSearchParams = new URLSearchParams();
        if (accountInformation.state !== AccountState.notSet) {
            accountInformation.account && searchParams.set('claimant', accountInformation.account.account_id);
        }
        searchParams.set('cursor', '');
        searchParams.set('limit', '100');
        searchParams.set('order', 'asc');

        loadClaimableBalances({
            baseUrl: horizonUrl(),
            onPage: onBalancePageLoaded,
            maxItems: loadBalancesMax,
            searchParams: searchParams,
        })
            .then(r => {
                setBalances(r);
                setPagination(p => ({...p, total: r.length,}));
            })
            .finally(() => setBalancesLoading(false));
    }

    useEffect(() => {
        reload();
    // eslint-disable-next-line
    }, [accountInformation, usePublicNetwork]);

    useEffect(() => {
        setSelectedBalances(balances.filter(b => selectedBalanceIds.includes(b.id)));
        // eslint-disable-next-line
    }, [selectedBalanceIds]);

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
    }

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
                || (record.valid_from?.getTime()??0) >= Date.now(),
        }),
    };

    // const tableSummary = (data: readonly ClaimableBalanceRecord[]) => (<Collapse ghost><Collapse.Panel header="" key="1" extra={<InfoCircleOutlined />} showArrow={false}>
    //     <Row gutter={1}>
    //         <Col span={6}><Tooltip title={`You can claim up to ${maxSelect} balances in one transaction.`}><Statistic title="Selected for claim" value={selectedBalanceIds.length} suffix={`/ ${maxSelect}`}/></Tooltip></Col>
    //     </Row>
    // </Collapse.Panel></Collapse>
    // )

    return (<Table
        columns={tableColumns()}
        dataSource={balances}
        loading={balancesLoading}
        pagination={pagination}
        rowKey="id"
        onRow={(record) => ({
            onClick: (e) => e.target instanceof HTMLAnchorElement || selectRow(record, e)
        })}
        rowSelection={rowSelection}
        scroll={{y:600}}
        sticky={true/*{offsetHeader: 0, offsetScroll: 200}*/}
        //footer={tableSummary}
        title={() => (<span>Balances ready to claim on <b>{usePublicNetwork?'public':'test'}</b> network.</span>)}
    />);
}

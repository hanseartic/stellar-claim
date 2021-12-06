import {BigNumber} from "bignumber.js";
import {
    Badge,
    Button,
    Card,
    Col,
    DatePicker,
    Input,
    Popover,
    Row,
    Space,
    Switch,
    Tag,
    Tooltip,
} from "antd";
import {
    CloseCircleOutlined,
    DeleteOutlined,
    FireOutlined,
    IdcardOutlined,
    SendOutlined,
    SyncOutlined,
} from "@ant-design/icons";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
    faBalanceScaleLeft,
    faCoins,
    faHandHolding,
    faPeopleArrows,
    faSatelliteDish,
    faLink,
    faUnlink,
    faCommentDots,
    faDumpsterFire,
} from '@fortawesome/free-solid-svg-icons';
import React, {useEffect, useState} from "react";
import {
    AccountResponse,
    Asset,
    BASE_FEE,
    Claimant,
    Horizon,
    Keypair,
    Memo,
    Networks,
    Operation,
    Server,
    ServerApi,
    TransactionBuilder,
} from "stellar-sdk";
import {OfferCallBuilder} from "stellar-sdk/lib/offer_call_builder";
import URI from "urijs";
import StellarHelpers, {getStellarAsset, shortAddress} from "../StellarHelpers";
import useApplicationState from "../useApplicationState";
import {submitTransaction} from "./WalletHandling";
import moment from "moment";
import { RangeValue } from 'rc-picker/lib/interface';
import EmojiInput, {emojiShortcodeMatch} from "./EmojiInput";
import runes from 'runes';

type BalanceLine = Horizon.BalanceLine;
type BalanceLineAsset = Horizon.BalanceLineAsset;
type BalanceLineLiquidityPool = Horizon.BalanceLineLiquidityPool;
type BalanceLineNative = Horizon.BalanceLineNative;

export type AccountBalanceRecord = {
    account: AccountResponse,
    asset: string,
    balance: BigNumber,
    buyingLiabilities: BigNumber,
    sellingLiabilities: BigNumber,
    spendable: BigNumber,
};

const hasAccountTrustLine = (account: AccountResponse, assetString: string): boolean => {
    const asset = getStellarAsset(assetString);
    return !!(account?(account.balances
        .filter((b: BalanceLine): b is (BalanceLineAsset|BalanceLineNative) =>
            b.asset_type !== 'liquidity_pool_shares'
        )
        .find(b =>
            (b.asset_type     !== 'native'
            && b.asset_code   === asset.code
            && b.asset_issuer === asset.issuer)
            || (b.asset_type === asset.getAssetType() && asset.getAssetType() === 'native')
        )):false);
}

const filterLiquidityPoolShares = (balanceLines: BalanceLine[]): Exclude<BalanceLine, BalanceLineLiquidityPool>[] => balanceLines
    .filter((b): b is Exclude<BalanceLine, BalanceLineLiquidityPool> => b.asset_type !== 'liquidity_pool_shares')

const getBalanceLineFromAccount = (account: AccountResponse, asset: string): BalanceLineAsset|BalanceLineNative|undefined => {
    if (asset === 'native')
        return account.balances.find((b): b is BalanceLineNative => b.asset_type === 'native');
    return filterLiquidityPoolShares(account.balances)
        .filter((b): b is BalanceLineAsset => b.asset_type !== 'native')
        .find((b) => asset === `${b.asset_code}:${b.asset_issuer}`);
}
const compareAccounts = (accountA: DestinationAccount, accountB: DestinationAccount): -1|0|1 => {
    return accountA.id < accountB.id ? -1 : accountA.id === accountB.id ? 0 : 1
}
const isAssetIssuedByAccount = (asset: Asset, accountId: string): boolean => {
    if (asset.isNative()) return false;
    if (asset.getAssetType() === 'liquidity_pool_shares') return false;
    return asset.getIssuer() === accountId;
}

interface DestinationAccount {
    id: string,
    state: 'loading'|'found'|'invalid',
    role: 'unknown'|'self'|'trust'|'notrust'|'error'|'asset_issuer',
    balance?: Exclude<BalanceLine, BalanceLineLiquidityPool>,
    trusted?: boolean,
}

export default function BalanceCard({balanceRecord}: {balanceRecord: AccountBalanceRecord}) {
    const {
        accountInformation, setAccountInformation,
        autoRemoveTrustlines, setAutoRemoveTrustlines,
    } = useApplicationState();
    const {getSelectedNetwork, horizonUrl: fnHorizonUrl} = StellarHelpers();
    const [assetDemand, setAssetDemand] = useState(new BigNumber(0));
    const [burnRemovePopoverVisible, setBurnRemovePopoverVisible] = useState(false);
    const [canBurn, setCanBurn] = useState(false);
    const [canRemoveTrust, setCanRemoveTrust] = useState(false);
    const [destinationAccounts, setDestinationAccounts] = useState<DestinationAccount[]>([]);
    const [destinationCanReceivePayment, setDestinationCanReceivePayment] = useState(false);
    const [destinationAccountId, setDestinationAccountId] = useState('')
    const [horizonUrl, setHorizonUrl] = useState(fnHorizonUrl().href);
    const [isBurn, setIsBurn] = useState(false);
    const [sendAmount, setSendAmount] = useState('')
    const [sendAmountInvalid, setSendAmountInvalid] = useState(false)
    const [sendAsClaimable, setSendAsClaimable] = useState(true);
    const [sendPopoverVisible, setSendPopoverVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [transactionMemo, setTransactionMemo] = useState('');
    const [claimableRange, setClaimableRange] = useState<RangeValue<moment.Moment>>();
    const [XDRs, setXDRs] = useState<string[]>([]);

    const collect = (offersCollection: ServerApi.CollectionPage<ServerApi.OfferRecord>): Promise<BigNumber> => {
        if (!offersCollection.records.length) return new Promise((resolve) => resolve(new BigNumber(0)));

        return offersCollection.next()
            .then(collect)
            .then(currentDemand => offersCollection.records
                .map(record => {
                    // amount:    amount of counter-asset the buyer is willing to spend
                    // price_r.n: price-numerator   => this amount of asset should cost the amount given in 'd'
                    // price_r.d: price-denominator => this amount of counter-asset is offered for the amount given in 'p'
                    const pricePerUnit = new BigNumber(record.price_r.d).div(new BigNumber(record.price_r.n));
                    return new BigNumber(record.amount).div(pricePerUnit);
                })
                .reduce((prev, current) => prev.add(current), currentDemand)
            );
    };

    const removeTag = (accountId: string) => {
        setDestinationAccounts(accounts => accounts.filter(a => a.id !== accountId));
    };
    const getSpendable = (totalSpendable: BigNumber): BigNumber => {
        const validAccounts = destinationAccounts.filter(a => a.state === 'found');
        return totalSpendable
            .dividedBy(validAccounts.length===0?1:validAccounts.length)
            .round(7, BigNumber.ROUND_DOWN);
    };

    const saveXDR = () => {
        const asset = getStellarAsset(balanceRecord.asset);
        let sendTotal = new BigNumber(0);
        let validDestinations = destinationAccounts.filter(a => a.state === 'found');
        const xdrs = [];
        const send = new BigNumber(sendAmount.replaceAll(',',''));
        while (validDestinations.length > 0) {
            const transactionBuilder = new TransactionBuilder(
                accountInformation.account!,
                {fee: new BigNumber(BASE_FEE).times(100).toString(), networkPassphrase: Networks[getSelectedNetwork()]})
                .addMemo(Memo.text(transactionMemo.length > 0 ? transactionMemo : 'via balances.lumens.space'));
            let opsCount = 1;
            // eslint-disable-next-line
            validDestinations.every(destinationAccount => {
                if (balanceRecord.spendable.lessThan(sendTotal.plus(send))) {
                    return false;
                }
                // max 99 ops to allow for potential remove trustline op
                if (opsCount > 100) return false;
                sendTotal = sendTotal.plus(send);

                if (sendAsClaimable) {
                    const claimValidFrom = claimableRange?.[0]?.unix();
                    const claimValidTo = claimableRange?.[1]?.unix();
                    const claimants = [
                        new Claimant(
                            destinationAccount.id,
                            (!!claimValidFrom || !!claimValidFrom) ? Claimant.predicateAnd(
                                claimValidFrom
                                    ? Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(claimValidFrom.toString()))
                                    : Claimant.predicateUnconditional(),
                                claimValidTo
                                    ? Claimant.predicateBeforeAbsoluteTime(claimValidTo.toString())
                                    : Claimant.predicateUnconditional()
                                )
                                : Claimant.predicateUnconditional()
                        )
                    ];
                    if (destinationAccount.id !== accountInformation.account!.id) {
                        const claimBack = new Claimant(
                            accountInformation.account!.id,
                            claimValidTo
                                ? Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(claimValidTo.toString()))
                                : Claimant.predicateUnconditional()
                            );
                        claimants.push(claimBack);
                    }
                    transactionBuilder
                        .addOperation(Operation.createClaimableBalance({
                            amount: send.toString(),
                            asset: asset,
                            claimants: claimants,
                        }))
                } else {
                    transactionBuilder.addOperation(Operation.payment({
                        destination: destinationAccount.id,
                        amount: send.toString(),
                        asset: asset,
                    }));
                }
                return !!opsCount++;
            });
            validDestinations = validDestinations.slice(opsCount-1);
            if (autoRemoveTrustlines) {
                if (balanceRecord.balance.eq(sendTotal)) {
                    transactionBuilder.addOperation(Operation.changeTrust({
                        asset: asset,
                        limit: '0',
                    }))
                }
            }
            const transactionXDR = transactionBuilder
                .setTimeout(0)
                .build().toXDR();

            console.log(transactionXDR);
            xdrs.push(transactionXDR);
        }
        setXDRs(xdrs);
    };

    const CBSwitchOverlay = <>
        Sending a claimable balance allows to send funds before the recipient has established a trust-line.<br />
        This can only be disabled for assets where the recipient already has a trust-line established (e.g. <b>XLM</b> by default).<br /><br />
        When sending a claimable balance – in addition to the provided recipient – your sending account will be added as a second recipient.
        This allows to claim back the asset(s) in case the recipient does not accept or claim the balance on their side.
    </>

    const burnRemovePopoverContent = () => {
        const asset = getStellarAsset(balanceRecord.asset);
        const tb = async () => {
            const transactionBuilder = new TransactionBuilder(
                accountInformation.account!,
                {fee: BASE_FEE, networkPassphrase: Networks[getSelectedNetwork()]})
                .addMemo(Memo.text(transactionMemo.length>0?transactionMemo:'via balances.lumens.space'))
                .setTimeout(0);

            if (isBurn) {
                transactionBuilder.addOperation(Operation.payment({
                    asset: asset,
                    destination: destinationAccounts.find(a => a.role === 'asset_issuer')?.id??'',
                    amount: sendAmount.replaceAll(",", ""),
                }));
            } else if (!balanceRecord.buyingLiabilities.isZero()) {
                // cancel the buy-offers for this asset
                await accountInformation.account?.offers({limit: 200})
                    .then(({records}) => { records
                        .filter(({buying}) => buying.asset_type !== 'native' && buying.asset_code === asset.code && buying.asset_issuer === asset.issuer)
                        .map(buyingCurrentAssetOffer => transactionBuilder.addOperation(Operation.manageBuyOffer({
                            buyAmount: '0',
                            buying: getStellarAsset(`${buyingCurrentAssetOffer.buying.asset_code}:${buyingCurrentAssetOffer.buying.asset_issuer}`),
                            offerId: buyingCurrentAssetOffer.id,
                            price: buyingCurrentAssetOffer.price_r,
                            selling: getStellarAsset(`${buyingCurrentAssetOffer.selling.asset_code??'native'}:${buyingCurrentAssetOffer.selling.asset_issuer}`),
                            }))
                        );
                    })
            }
            if (!isBurn || (balanceRecord.balance.eq(sendAmount) && autoRemoveTrustlines)) {
                transactionBuilder.addOperation(Operation.changeTrust({
                    asset: asset,
                    limit: '0',
                }));
            }
            return transactionBuilder;
        }
        const burnHint = <>
            By clicking the button below you will burn all of your spendable funds of this asset.<br /><br />
            If you only want to burn parts of the spendable funds, use the send-button <br/>
            and enter the following destination instead:<br/><br/>
            <pre>{asset.getIssuer()}</pre>

            <Row gutter={16}>
                <Col span='flex'>
            <Tooltip
                overlay='When sending all funds of an asset, the trustline can be removed. This will free up 0.5 XLM'>
                <Switch
                    defaultChecked={autoRemoveTrustlines}
                    onChange={setAutoRemoveTrustlines}
                    checked={autoRemoveTrustlines}
                    checkedChildren={<FontAwesomeIcon icon={faUnlink}/>}
                    unCheckedChildren={<FontAwesomeIcon icon={faLink}/>}
                />
            </Tooltip>
                </Col>
                <Col span='flex'>{autoRemoveTrustlines?'Remove':'Keep'} the <a href="https://developers.stellar.org/docs/issuing-assets/anatomy-of-an-asset/#trustlines" target="_blank" rel="noreferrer">trustline</a> if possible</Col>
            </Row>
        </>;

        const removeHint = <>
            By clicking the button below you will remove the trustline to this asset.<br/>
            This will free up 0.5 XLM from the reserve.
            {(()=>{if (!balanceRecord.buyingLiabilities.isZero()){
                return <Row>
                    There are open offers on SDEX to buy this asset.<br/>
                    In order to remove the trustline they will be cancelled.
                </Row>
            }})()}
        </>;
        return (
        <Card title={isBurn?'Burn spendable amounts of this asset':'Remove trustline for this asset'}>
            {isBurn?burnHint:removeHint}
            <Row gutter={16}>
                <Col flex={1}><Input
                    allowClear
                    maxLength={28}
                    onChange={e => setTransactionMemo(e.target.value)}
                    prefix={<Tooltip overlay='Enter a memo'><FontAwesomeIcon icon={faCommentDots}/></Tooltip>}
                    placeholder='via balances.lumens.space'
                    value={transactionMemo}
                /></Col>
            </Row>
            <Row gutter={16} justify='end'>
                <Col span='flex'>
        <Button
            loading={submitting}
            onClick={() => {
                tb().then(transactionBuilder => setXDRs([transactionBuilder.build().toXDR()]));
            }}
            icon={isBurn?<FireOutlined />:<DeleteOutlined />}
        >{sendAmount === '0'?'remove':'burn'}</Button>
                </Col>
            </Row>
        </Card>
        )
    };

    const onDateSelected = (claimableRange: RangeValue<moment.Moment>) => {
        setClaimableRange(claimableRange
            ?claimableRange.map((moment: moment.Moment|null) => moment?moment.seconds(0).milliseconds(0):null) as RangeValue<moment.Moment>
            :null
        );
    };

    const stringByteSize = (string: string) => new Blob([string]).size;
    const onMemoChanged = (memo: string|undefined) => {
        const trimToBytes = (stringToTrim: string|undefined, maxBytes: number): string => {
            if (!stringToTrim) return '';
            if (stringByteSize(stringToTrim.replace(emojiShortcodeMatch, '')) > maxBytes) {
                const runesString = runes(stringToTrim);
                return trimToBytes(runes.substr(stringToTrim, 0, runesString.length-1), maxBytes);
            }
            return stringToTrim;
        }
        setTransactionMemo(trimToBytes(memo, 28));
    }
    const sendPopoverContent = <>
        <Space direction={"vertical"} style={{width: 625}} >
            <Input
                allowClear
                onChange={e => setSendAmount(e.target.value)}
                placeholder={getSpendable(balanceRecord.spendable).toFormat(7)}
                addonBefore={<Tooltip placement={"topLeft"} overlay='Enter the amount to send. The placeholder will show the spendable amount.'><FontAwesomeIcon icon={faCoins} /></Tooltip>}
                addonAfter={<Tooltip placement={"topRight"} overlay='Send all spendable funds'><FontAwesomeIcon icon={faBalanceScaleLeft} onClick={() =>
                    setSendAmount(getSpendable(balanceRecord.spendable).toFormat(7))
                } style={{cursor: "pointer"}}/></Tooltip>}
                value={sendAmount}
                style={{borderColor:sendAmountInvalid?'red':undefined}}
            />

            <Input
                allowClear
                onChange={e => setDestinationAccountId(e.target.value)}
                onBlur={e => setDestinationAccountId(e.target.value)}
                placeholder={`${shortAddress(Keypair.random().publicKey(), 16)} [${shortAddress(Keypair.random().publicKey(), 16)}] […]`}
                addonBefore={<Tooltip placement={"topLeft"}  overlay={<>Enter the recipient address(es).<br/><br/>Multiple addresses can be entered or pasted one-by-one or separated by a space.</>}><FontAwesomeIcon icon={faPeopleArrows}/></Tooltip>}
                /*addonAfter={<Tooltip overlay='Click here to burn the asset'><FireOutlined onClick={() => { setDestinationAccountId(getStellarAsset(balanceRecord.asset).getIssuer()); }}/></Tooltip>}*/
                value={destinationAccountId}
            />

            <Space size={[0,3]} align={"center"} wrap={true}>{destinationAccounts.map(account => {
                let tagColor = 'default';
                let tagIcon = <></>;
                let hint = '';
                switch(account.role) {
                    case 'unknown':
                        tagIcon = <SyncOutlined spin />;
                        break;
                    case 'self':
                        tagIcon = <IdcardOutlined />;
                        hint = " – it's you!";
                        break;
                    case 'trust':
                        tagColor = 'cyan';
                        tagIcon = <FontAwesomeIcon icon={faLink} style={{marginRight: '7px'}} />;
                        hint = " – trustline established";
                        break;
                    case 'notrust':
                        tagColor = 'success';
                        tagIcon = <FontAwesomeIcon icon={faUnlink} style={{marginRight: '7px'}} />;
                        hint = ' – no trustline'
                        break;
                    case "error":
                        tagColor = 'error';
                        tagIcon = <CloseCircleOutlined />;
                        hint = " – there was an error with this account; no funds will be sent"
                        break;
                    case 'asset_issuer':
                        tagColor = 'warning';
                        tagIcon = <FireOutlined />;
                        hint = ' – sending to this account will burn the selected amount of funds!'
                        break;
                }

                return (<Tag
                    icon={tagIcon}
                    color={tagColor}
                    key={account.id}
                    title={account.id}
                    closable={true}
                    onClose={(e: React.MouseEvent<HTMLElement, MouseEvent>) => { removeTag(account.id);}}>
                    <span><Tooltip key={account.id} title={account.id + hint}>
                        <code>{shortAddress(account.id, 8)}</code>
                    </Tooltip></span>
                </Tag>);
            })}</Space>

            {!isBurn ? <></> : <Space>
            Sending to the issuer account will burn the selected amount of this asset!
            </Space>}

            <EmojiInput
                onChange={onMemoChanged}
                value={transactionMemo}
                allowClear
                placeholder='via balances.lumens.space'
                addonBefore={<Tooltip placement={"topLeft"} overlay={<>Enter a memo (Emojis supported 🎉 - just type a colon to open selection).</>}><FontAwesomeIcon icon={faCommentDots}/></Tooltip>}
                addonAfter={<Tooltip placement={"topRight"} overlay={<>The memo text can have maximum of 28 Bytes.<br/>Emojis can take up two or even four Bytes.</>}><div style={{color: "lightgray", cursor: "default"}}>{`${28-stringByteSize(transactionMemo)} left`}</div></Tooltip>}
                />

            <Space direction={"horizontal"}>
                <Tooltip placement={"topLeft"} overlay={CBSwitchOverlay}>
                    <Switch
                        defaultChecked={sendAsClaimable}
                        disabled={!destinationCanReceivePayment}
                        onChange={setSendAsClaimable}
                        checked={sendAsClaimable}
                        checkedChildren={<FontAwesomeIcon icon={faHandHolding}/>}
                        unCheckedChildren={<SendOutlined />}
                    />
                </Tooltip>
                <span>
                Send as <a href='https://developers.stellar.org/docs/glossary/claimable-balance/'
                   target="_blank"
                   rel="noreferrer">claimable balance</a>
                </span>
                {sendAsClaimable?<DatePicker.RangePicker
                    allowEmpty={[true, true]}
                    size={'small'}
                    disabledDate={(current) => current && current < moment().startOf('day')}
                    showTime={{ format: 'YYYY-MM-DD HH:mm' }}
                    placeholder={['claimable after', 'claimable before']}
                    format="YYYY-MM-DD HH:mm"
                    onCalendarChange={onDateSelected}
                    minuteStep={15}
                    value={claimableRange}
                />:null}
            </Space>

            {getStellarAsset(balanceRecord.asset).isNative() ? <></> : <Space direction={"horizontal"}>
                <Tooltip
                    placement={"topLeft"}
                    overlay='When sending all funds of an asset, the trustline can be removed. This will free up 0.5 XLM'>
                    <Switch
                        defaultChecked={autoRemoveTrustlines}
                        onChange={setAutoRemoveTrustlines}
                        checked={autoRemoveTrustlines}
                        checkedChildren={<FontAwesomeIcon icon={faUnlink}/>}
                        unCheckedChildren={<FontAwesomeIcon icon={faLink}/>}
                    />
                </Tooltip>
                <span>{autoRemoveTrustlines?'Remove':'Keep'} the <a href="https://developers.stellar.org/docs/issuing-assets/anatomy-of-an-asset/#trustlines" target="_blank" rel="noreferrer">trustline</a> when sending all funds</span>
            </Space>}
            <Button
                icon={<FontAwesomeIcon style={{marginRight: '0.3em'}} icon={isBurn?faDumpsterFire:faSatelliteDish} />}
                disabled={
                    destinationAccounts.filter(a => a.state === 'found').length===0
                    ||destinationAccounts.filter(a => a.state === 'loading').length>0
                    ||sendAmountInvalid
                    ||!sendAmount
                }
                loading={submitting}
                onClick={() => saveXDR()}
            >{isBurn?'Burn':'Transfer'} funds</Button>
        </Space>
    </>;

    const handleSendPopoverVisibleChange = (visible: any) => {
        if (balanceRecord.spendable.isZero()) return;
        setSendPopoverVisible(visible);
    }
    const handleBurnRemovePopoverVisibleChange = (visible: any) => {
        setBurnRemovePopoverVisible(visible);
    }
    useEffect(() => {
        const validAccounts = destinationAccounts.filter(a => a.state === 'found');
        if (validAccounts.filter(a => a.state === 'found').length > 0) {
            const asset = getStellarAsset(balanceRecord.asset);
            const sendSelf = validAccounts.some(a => a.id === accountInformation.account?.accountId());
            const shouldBurn = validAccounts.every(a => a.id === asset.getIssuer());
            const canReceivePayment = !sendSelf && (asset.isNative()
                    || validAccounts.every(a => a.trusted)
                    || shouldBurn
            );
            if (!canReceivePayment) {
                setSendAsClaimable(true);
            }
            if (shouldBurn && canReceivePayment) {
                setSendAsClaimable(false);
            }
            setIsBurn(shouldBurn);
            setDestinationCanReceivePayment(canReceivePayment);
        } else {
            setIsBurn(false);
            setDestinationCanReceivePayment(false);
            setSendAsClaimable(true);
        }
    }, [destinationAccounts, accountInformation.account, balanceRecord.asset]);
    useEffect(() => {
        setHorizonUrl(fnHorizonUrl().href);
    }, [fnHorizonUrl]);
    useEffect(() => {
        if (XDRs.length > 0) {
            setSubmitting(true);
            const XDR = XDRs[0];
            submitTransaction(XDR, accountInformation.account!, horizonUrl, getSelectedNetwork())
                .then(() => {
                    return new Server(horizonUrl)
                        .loadAccount(accountInformation.account!.id)
                        .then(account => setAccountInformation({account: account}));
                })
                .then(() => {
                    setXDRs(xdrs => xdrs.slice(1));
                    setDestinationAccounts([]);
                    setDestinationAccountId('');
                    setSendAmount('');
                    setSubmitting(false);
                    setSendPopoverVisible(false);
                    setBurnRemovePopoverVisible(false);
                });
        }
        // eslint-disable-next-line
    }, [XDRs]);
    useEffect(() => {
        if (destinationAccountId.length > 0) {
            const accountIds = destinationAccountId.split(/[-,;.\s]/);
            const processingAccounts = accountIds.filter(id => id.length === 56);
            processingAccounts.forEach(destination => {
                setDestinationAccounts(accounts => [
                    ...accounts.filter(a => a.id !== destination),
                    {id: destination, state: 'loading', role: 'unknown'} as DestinationAccount
                ].sort(compareAccounts));
                new Server(horizonUrl)
                    .loadAccount(destination)
                    .then(account => setDestinationAccounts(accounts => [
                        ...accounts.filter(a => a.id !== destination),
                        {
                            id: destination,
                            state: 'found',
                            role: account.id === accountInformation.account?.id
                                ? 'self'
                                : isAssetIssuedByAccount(getStellarAsset(balanceRecord.asset), account.id)
                                    ? 'asset_issuer'
                                    : hasAccountTrustLine(account, balanceRecord.asset)
                                        ? 'trust'
                                        : 'notrust',
                            trusted: hasAccountTrustLine(account, balanceRecord.asset),
                            balance: getBalanceLineFromAccount(account, balanceRecord.asset),
                        } as DestinationAccount
                    ].sort(compareAccounts)))
                    .catch(() => {
                        setDestinationAccounts(accounts => [
                            ...accounts.filter(a => a.id !== destination),
                            {
                                id: destination,
                                state: 'invalid',
                                role: 'error',
                            } as DestinationAccount
                        ]);
                    });
            });
            setDestinationAccountId(accountIds.filter(id => id.length !== 56).join(' '));
        }
    }, [destinationAccountId, horizonUrl, balanceRecord.asset, accountInformation.account]);
    useEffect(() => {
        setSendAmountInvalid(false);
        if (sendAmount !== undefined && sendAmount !== '') {
            try {
                const send = new BigNumber(sendAmount.replaceAll(',',''));
                const sendTotal = send.times(destinationAccounts.filter(a => a.state === 'found').length);
                if (sendTotal.greaterThan(balanceRecord.spendable) || send.lessThan('0.0000001')) {
                    setSendAmountInvalid(true);
                }
                if (send.decimalPlaces() > 7) {
                   setSendAmount(send.round(7, BigNumber.ROUND_UP).toFormat());
                }
            } catch (e) {
                setSendAmountInvalid(true);
            }
        }
    }, [balanceRecord.spendable, sendAmount, destinationAccounts]);
    useEffect(() => {
        setIsBurn(isBurn&&!sendAmountInvalid)
    }, [isBurn, sendAmountInvalid])
    useEffect(() => {
        if (balanceRecord.asset !== 'native:XLM') {
            new OfferCallBuilder(new URI(horizonUrl))
                .buying(getStellarAsset(balanceRecord.asset))
                .limit(200)
                .call()
                .then(collect)
                .then(demand => setAssetDemand(demand.round(demand.lt(1)?7:0)))
        }
        setCanBurn(!balanceRecord.spendable.isZero());
        setCanRemoveTrust(balanceRecord.spendable.isZero()
            && balanceRecord.balance.isZero()
        );
        // eslint-disable-next-line
    }, []);

    let askOffset = 25;
    let bidOffset = 25;
    if (!assetDemand.isZero()) {
        bidOffset += 30;
        askOffset += 30;
    }
    if (!balanceRecord.sellingLiabilities.isZero()) askOffset += 30;
    return (<>
        <Badge.Ribbon
            color='red'
            style={{display: (balanceRecord.sellingLiabilities.isZero()?"none":""), marginTop: bidOffset}}
            text={balanceRecord.sellingLiabilities.isZero()?'':`Bid: ${balanceRecord.sellingLiabilities.toFormat()}`}>
            <Badge.Ribbon
                color='lime'
                style={{marginTop: askOffset, display: (balanceRecord.buyingLiabilities.isZero()?"none":"")}}
                text={balanceRecord.buyingLiabilities.isZero()?'':`Ask: ${balanceRecord.buyingLiabilities.toFormat()}`}>
                <Badge.Ribbon
                    color='blue'
                    style={{display: (assetDemand.isZero()?"none":""), marginTop: 25}}
                    text={assetDemand.isZero()?'':`Demand: ${assetDemand.toFormat()}`} >
                <Card size='small' title={balanceRecord.spendable.toFormat() + ' spendable'}>
                    <p>{balanceRecord.balance.sub(balanceRecord.spendable).toFormat()} reserved</p>
                    <b>{balanceRecord.balance.toFormat()} total</b>
                </Card>
            </Badge.Ribbon></Badge.Ribbon></Badge.Ribbon>
        <Row><Col flex={1}><Popover
            trigger="click"
            placement="bottomRight"
            visible={sendPopoverVisible}
            onVisibleChange={handleSendPopoverVisibleChange}
            content={sendPopoverContent}
            >
            <Button
                block
                disabled={balanceRecord.spendable.isZero()}
                icon={<SendOutlined />}
                onClick={() => {setSendAmount(''); setDestinationAccounts([]); setClaimableRange(null)}}
                >Send
            </Button>
        </Popover></Col>
            {getStellarAsset(balanceRecord.asset).isNative()?<></>:
            <Col flex={1}><Popover
            trigger="click"
            content={burnRemovePopoverContent}
            onVisibleChange={handleBurnRemovePopoverVisibleChange}
            visible={burnRemovePopoverVisible}
            placement="bottomRight"
        >
            <Button
                block
                icon={!balanceRecord.spendable.isZero() ? <FireOutlined/> : <DeleteOutlined/>}
                disabled={!(canBurn || canRemoveTrust)}
                onClick={() => {
                    setDestinationAccountId(getStellarAsset(balanceRecord.asset).getIssuer());
                    setSendAmount(balanceRecord.spendable.toString(10));
                }}
            >{!balanceRecord.spendable.isZero()?'Burn':'Remove'}
            </Button>
        </Popover></Col>}</Row>
            </>);
}

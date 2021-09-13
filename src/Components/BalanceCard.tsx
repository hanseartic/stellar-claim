import {BigNumber} from "bignumber.js";
import {Badge, Button, Card, Col, Input, Popover, Row, Switch} from "antd";
import {SendOutlined} from "@ant-design/icons";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
    faBalanceScaleLeft,
    faCoins,
    faPeopleArrows, faSatelliteDish
} from '@fortawesome/free-solid-svg-icons';
import React, {useEffect, useState} from "react";
import {
    AccountResponse,
    BASE_FEE,
    Claimant,
    Keypair,
    Memo,
    Networks,
    Operation,
    Server,
    ServerApi,
    TransactionBuilder
} from "stellar-sdk";
import {OfferCallBuilder} from "stellar-sdk/lib/offer_call_builder";
import URI from "urijs";
import StellarHelpers, {getStellarAsset} from "../StellarHelpers";
import useApplicationState from "../useApplicationState";
import {submitTransaction} from "./WalletHandling";

export type AccountBalanceRecord = {
    account: AccountResponse,
    asset: string,
    balance: BigNumber,
    buyingLiabilities: BigNumber,
    sellingLiabilities: BigNumber,
    spendable: BigNumber,
};

export default function BalanceCard({balanceRecord}: {balanceRecord: AccountBalanceRecord}) {
    const {accountInformation, setAccountInformation} = useApplicationState();
    const {getSelectedNetwork, horizonUrl: fnHorizonUrl} = StellarHelpers();
    const [horizonUrl, setHorizonUrl] = useState(fnHorizonUrl().href);
    const [assetDemand, setAssetDemand] = useState(new BigNumber(0));
    const [sendPopoverVisible, setSendPopoverVisible] = useState(false);
    const [sendAmount, setSendAmount] = useState('')
    const [sendAmountInvalid, setSendAmountInvalid] = useState(false)
    const [destinationAccount, setDestinationAccount] = useState<AccountResponse>()
    const [destinationCanReceivePayment, setDestinationCanReceivePayment] = useState(false);
    const [sendAsClaimable, setSendAsClaimable] = useState(true);
    const [destinationAccountId, setDestinationAccountId] = useState('')
    const [destinationAccountInvalid, setDestinationAccountInvalid] = useState(false)
    const [xdr, setXDR] = useState('');
    const [submitting, setSubmitting] = useState(false);

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

    const saveXDR = () => {

        const asset = getStellarAsset(balanceRecord.asset);
        const transactionBuilder = new TransactionBuilder(
            accountInformation.account!,
            {fee: BASE_FEE, networkPassphrase: Networks[getSelectedNetwork()]})
            .addMemo(Memo.text('via balances.lumens.space'));
        if (sendAsClaimable) {
            const claimants = [
                new Claimant(
                    destinationAccount!.accountId(),
                    Claimant.predicateUnconditional()
                )
            ];
            if (destinationAccount?.id !== accountInformation.account!.id) {
                const claimBack = new Claimant(
                    accountInformation.account!.id,
                    Claimant.predicateNot(Claimant.predicateBeforeRelativeTime(new BigNumber(1)
                        // .times(new BigNumber(60)) // a minute
                        // .times(new BigNumber(60)) // an hour
                        // .times(new BigNumber(24)) // a day
                        // .times(new BigNumber(7))  // a week
                        .toString())));
                claimants.push(claimBack);
            }
            transactionBuilder
            .addOperation(Operation.createClaimableBalance({
                amount: sendAmount,
                asset: asset,
                claimants: claimants,
            }))
        } else {
            transactionBuilder.addOperation(Operation.payment({
                destination: destinationAccount!.accountId(),
                amount: sendAmount,
                asset: asset,
            }));
        }
        const transactionXDR = transactionBuilder
            .setTimeout(0)
            .build().toXDR();
        setXDR(transactionXDR);
    };


    const sendPopoverContent = <>
        <Row>
            <Input
                allowClear
                onChange={e => setSendAmount(e.target.value)}
                placeholder={balanceRecord.spendable.toFormat().replace(',','')}
                prefix={<FontAwesomeIcon icon={faCoins} />}
                suffix={<FontAwesomeIcon icon={faBalanceScaleLeft} onClick={() =>
                    setSendAmount(balanceRecord.spendable.toFormat().replace(',',''))
                } />}
                value={sendAmount}
                style={{borderColor:sendAmountInvalid?'red':undefined}}
            />
        </Row>
        <Row>
            <Input
                allowClear
                onChange={e => setDestinationAccountId(e.target.value)}
                placeholder={Keypair.random().publicKey()}
                prefix={<FontAwesomeIcon icon={faPeopleArrows}/>}
                value={destinationAccountId}
                style={{borderColor:destinationAccountInvalid?'red':undefined, width: '42em'}}
            />
        </Row>
        <Row style={{paddingTop: 5, paddingBottom: 5}}>
            <Col>
                <Switch
                    defaultChecked={sendAsClaimable}
                    disabled={!destinationCanReceivePayment}
                    onChange={setSendAsClaimable}
                    checked={sendAsClaimable}
                />
            </Col>
            <Col>&nbsp;</Col>
            <Col>
                Send as <a href='https://developers.stellar.org/docs/glossary/claimable-balance/'
                   target="_blank"
                   rel="noreferrer">
                    claimable balance
                </a>
            </Col>
        </Row>
        <Row style={{paddingTop: 5, paddingBottom: 5}}>
        <Button
            icon={<FontAwesomeIcon icon={faSatelliteDish} />}
            disabled={destinationAccountInvalid||destinationAccountId.length===0||sendAmountInvalid||!sendAmount}
            loading={submitting}
            onClick={() => saveXDR()}
        >Transfer funds</Button>
        </Row>
    </>;


    const handleSendPopoverVisibleChange = (visible: any) => {
        if (balanceRecord.spendable.isZero()) return;
        setSendPopoverVisible(visible);
    }
    useEffect(() => {
        if (destinationAccount) {
            const asset = getStellarAsset(balanceRecord.asset);
            const sendSelf = destinationAccount.accountId() === accountInformation.account?.accountId();
            const canReceivePayment = !sendSelf && (asset.isNative()
                || !!destinationAccount.balances.find(b =>
                    b.asset_type !== 'native'
                    && b.asset_code === asset.code
                    && b.asset_issuer === asset.issuer
                ));
            if (!canReceivePayment) {
                setSendAsClaimable(true);
            }
            setDestinationCanReceivePayment(canReceivePayment);
        } else {
            setDestinationCanReceivePayment(false);
            setSendAsClaimable(true);
        }
    }, [destinationAccount, accountInformation.account, balanceRecord.asset]);
    useEffect(() => {
        setHorizonUrl(fnHorizonUrl().href);
    }, [fnHorizonUrl]);
    useEffect(() => {
        if (xdr) {
            setSubmitting(true);
            submitTransaction(xdr, accountInformation.account!, horizonUrl, getSelectedNetwork())
                .then(() => {
                    console.log('sent');
                    return new Server(horizonUrl)
                        .loadAccount(accountInformation.account!.id)
                        .then(account => setAccountInformation({account: account}));
                })
                .then(() => setXDR(''))
                .then(() => {
                    setDestinationAccount(undefined);
                    setDestinationAccountId('');
                    setSendAmount('');
                    setSubmitting(false);
                    setSendPopoverVisible(false);
                });
        }
        // eslint-disable-next-line
    }, [xdr]);
    useEffect(() => {
        if (destinationAccountId.length > 0) {
            new Server(horizonUrl).loadAccount(destinationAccountId)
                .then(setDestinationAccount)
                .then(() => setDestinationAccountInvalid(false))
                .catch(() => {
                    setDestinationAccount(undefined);
                    setDestinationAccountInvalid(true);
                });
        } else {
            setDestinationAccount(undefined);
            setDestinationAccountInvalid(false);
        }
    }, [destinationAccountId, horizonUrl]);
    useEffect(() => {
        setSendAmountInvalid(false);
        if (sendAmount !== undefined && sendAmount !== '') {
            const send = new BigNumber(sendAmount.replace(',',''));
            if (send.greaterThan(balanceRecord.spendable) || send.isZero() || send.lessThan('0.0000001')) {
                setSendAmountInvalid(true);
            }
        }
    }, [balanceRecord.spendable, sendAmount]);
    useEffect(() => {
        if (balanceRecord.asset !== 'native:XLM') {
            new OfferCallBuilder(new URI(horizonUrl))
                .buying(getStellarAsset(balanceRecord.asset))
                .limit(200)
                .call()
                .then(collect)
                .then(demand => setAssetDemand(demand.round(demand.lt(1)?7:0)))
        }
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
        <Popover
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
                >Send
            </Button>
        </Popover>
            </>);
}

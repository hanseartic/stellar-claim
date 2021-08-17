import {BigNumber} from "bignumber.js";
import {Badge, Card} from "antd";
import React, {useEffect, useState} from "react";
import {AccountResponse, ServerApi} from "stellar-sdk";
import {OfferCallBuilder} from "stellar-sdk/lib/offer_call_builder";
import URI from "urijs";
import StellarHelpers, {getStellarAsset} from "../StellarHelpers";

export type AccountBalanceRecord = {
    account: AccountResponse,
    asset: string,
    balance: BigNumber,
    buyingLiabilities: BigNumber,
    sellingLiabilities: BigNumber,
    spendable: BigNumber,
};

export default function BalanceCard({balanceRecord}: {balanceRecord: AccountBalanceRecord}) {
    const {horizonUrl} = StellarHelpers();
    const [assetDemand, setAssetDemand] = useState(new BigNumber(0));


    const collect = (offersCollection: ServerApi.CollectionPage<ServerApi.OfferRecord>, demand: BigNumber): BigNumber|Promise<BigNumber> => {
        if (!offersCollection.records.length) return demand;
        return offersCollection.next()
            .then(collection => collect(collection, demand))
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

    useEffect(() => {
        if (balanceRecord.asset !== 'native:XLM') {
            new OfferCallBuilder(new URI(horizonUrl()))
                .buying(getStellarAsset(balanceRecord.asset))
                .limit(200)
                .call()
                .then(offersCollection => {
                    return collect(offersCollection, new BigNumber(0));
                })
                .then(setAssetDemand)
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
            text={balanceRecord.sellingLiabilities.isZero()?'':`Offer: ${balanceRecord.sellingLiabilities.toFormat()}`}>
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
            </Badge.Ribbon></Badge.Ribbon></Badge.Ribbon></>);
}

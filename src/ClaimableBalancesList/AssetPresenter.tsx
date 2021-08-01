import {Col, Row, Space} from 'antd';
import StellarHelpers, {getStellarAsset, shortAddress, TomlAssetInformation} from '../StellarHelpers';
import React, {useEffect, useState} from 'react';
import stellarLogo from "../stellar_logo_black.png";
import AssetImage from './AssetImage';

interface AssetProps {
    code: string;
}

export default function AssetPresenter({code}: AssetProps) {
    const asset = getStellarAsset(code);
    const [{code: assetCode, name: assetName, image, issuer, domain}, setAssetInformation] = useState<TomlAssetInformation>({
        code: asset.getCode(),
        issuer: asset.isNative()?'native':asset.getIssuer(),
    });
    const {expertUrl, tomlAssetInformation} = StellarHelpers();

    useEffect(() => {
        tomlAssetInformation(asset)
            .then(i => setAssetInformation(p => ({...p, ...i})))
            .catch(({reason}) => reason === 'native' && setAssetInformation(p => ({
                ...p,
                name: 'Stellar Lumens',
                issuer: 'Stellar Foundation',
                domain: 'stellar.org',
                image: stellarLogo,
            })));
        // eslint-disable-next-line
    }, []);
    useEffect(() => {
        if (assetCode?.startsWith('0x')) {
            setAssetInformation(p => ({
                ...p,
                code: String.fromCodePoint(Number(assetCode)),
                image: 'https://twemoji.maxcdn.com/v/latest/72x72/'+assetCode?.substring(2).replace(/^0+/g, '')+'.png'
            }));
        }
    }, [assetCode]);


    const assetHref = expertUrl(`asset/${asset.getCode()}${asset.isNative()?'':'-'+asset.getIssuer()}`).href;
    const issuerHref = expertUrl(`account/${asset.getIssuer()}`).href;
    return (
        <Row align="middle" gutter={16}>
            <Col flex="40px">
                <AssetImage assetInformation={{code: assetCode, name: assetName, image}} />
            </Col>
            <Col flex="auto">
                <Row>
                    <a href={assetHref} target="_blank" rel="noreferrer">{(!!assetName?assetName + ' – ':'') + assetCode}</a><Space wrap/>
                </Row>
                <Row>
                    <a href={domain?new URL('https://'+domain).href:issuerHref} target="_blank" rel="noreferrer">{domain??shortAddress(issuer!, 12)}</a>
                </Row>
            </Col>
        </Row>
    );
};


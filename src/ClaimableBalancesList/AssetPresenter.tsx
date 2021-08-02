import {Col, Row, Space} from 'antd';
import StellarHelpers, {getStellarAsset, shortAddress, TomlAssetInformation} from '../StellarHelpers';
import React, {useEffect, useState} from 'react';
import AssetImage from './AssetImage';
interface AssetProps {
    code: string;
}

export default function AssetPresenter({code}: AssetProps) {
    const asset = getStellarAsset(code);
    const [assetInformation, setAssetInformation] = useState<TomlAssetInformation>({
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
                domain: 'stellar.org',
            })));
        // eslint-disable-next-line
    }, []);
    useEffect(() => {
        if (assetInformation.code?.startsWith('0x')) {
            setAssetInformation(p => ({
                ...p,
                code: String.fromCodePoint(Number(p.code)),
            }));
        }
    }, [assetInformation.code]);


    const assetHref = expertUrl(`asset/${asset.getCode()}${asset.isNative()?'':'-'+asset.getIssuer()}`).href;
    const issuerHref = expertUrl(`account/${asset.getIssuer()}`).href;
    return (
        <Row align="middle" gutter={16}>
            <Col flex="40px">
                <AssetImage asset={asset} assetInformation={assetInformation} />
            </Col>
            <Col flex="auto">
                <Row>
                    <a href={assetHref}
                       target="_blank"
                       rel="noreferrer">
                        {(!!assetInformation.name?assetInformation.name + ' – ':'') + assetInformation.code}
                    </a><Space wrap/>
                </Row>
                <Row>
                    <a href={assetInformation.domain?new URL('https://'+assetInformation.domain).href:issuerHref}
                       target="_blank"
                       rel="noreferrer">
                        {assetInformation.domain??shortAddress(assetInformation.issuer!, 12)}
                    </a>
                </Row>
            </Col>
        </Row>
    );
};

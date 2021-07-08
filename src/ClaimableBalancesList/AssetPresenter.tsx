import {Col, Row, Space} from 'antd';
import StellarHelpers, {getStellarAsset} from '../StellarHelpers';
import React, {useState} from 'react';
import AssetImage from './AssetImage';

interface AssetProps {
    code: string;
}

export default function AssetPresenter({code}: AssetProps) {
    const asset = getStellarAsset(code);
    const [assetName, setAssetName] = useState<string>(asset.getCode());
    const {expertUrl, tomlAssetInformation} = StellarHelpers();

    tomlAssetInformation(asset)
        .then(({name}) => name && setAssetName(name+' ('+asset.getCode()+')'))
        .catch(({reason}) => reason === 'native' && setAssetName('Stellar Lumens (XLM)'));

    const assetHref = expertUrl(`asset/${asset.getCode()}${asset.isNative()?'':'-'+asset.getIssuer()}`).href;
    return (
        <Row align="middle" gutter={16}>
            <Col flex="40px">
               <AssetImage asset={asset} />
            </Col>
            <Col flex="auto">
                <a href={assetHref} target="_blank" rel="noreferrer">{assetName}</a><Space wrap/>
            </Col>
        </Row>
    );
};


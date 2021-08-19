import {Col, Row} from 'antd';
import StellarHelpers, {getStellarAsset, TomlAssetInformation} from '../../StellarHelpers';
import React, {useEffect, useState} from 'react';
import AssetImage from '../AssetImage';
import StellarAddressLink from '../StellarAddressLink';
import './styles.css'

interface AssetProps {
    code: string;
}

const AssetIssuer = (props: {code: string, issuer: string, domain?: string}) => {
    return (<code>
            {!!props.domain?<span className='domain-issued-asset'>{props.code}</span>:null}
            {!!props.domain
                ? <a href={new URL('https://'+props.domain).href}
                     target="_blank"
                     rel="noreferrer">
                    {props.domain}
                </a>
                : <StellarAddressLink id={props.issuer} length={12} />
            }
        </code>);
};

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
    return (
        <Row align="middle" gutter={2}>
            <Col flex="40px">
                <AssetImage asset={asset} assetInformation={assetInformation} />
            </Col>
            <Col flex="auto">
                <Row>
                    <a href={assetHref}
                       target="_blank"
                       rel="noreferrer">
                        {assetInformation.name??assetInformation.code}
                    </a>
                </Row>
                <Row>
                    <AssetIssuer code={assetInformation.code!} domain={assetInformation.domain} issuer={asset.getIssuer()} />
                </Row>
            </Col>
        </Row>
    );
};
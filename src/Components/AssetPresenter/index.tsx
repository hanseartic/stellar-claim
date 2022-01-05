import {Badge, Col, Row} from 'antd';
import StellarHelpers, {getStellarAsset, TomlAssetInformation} from '../../StellarHelpers';
import React, {useEffect, useState} from 'react';
import AssetImage from '../AssetImage';
import StellarAddressLink from '../StellarAddressLink';
import './styles.css'
import nftLogo from '../../nft.png';

interface AssetProps {
    code: string;
}
interface IssuerProps {
    code: string,
    issuer: string,
    domain?: string,
}

const emojiAssetRegex = /(?:0x[a-z0-9]*(?=0x))|(?:0x[a-z0-9]*$)/ig;

const AssetIssuer = (props: IssuerProps) => {
    return (<code>
            {!!props.domain?<span className='domain-issued-asset'>{props.code}</span>:<></>}
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
    const [isStroopAsset, setIsStroopAsset] = useState<boolean>(false);
    const {expertUrl, tomlAssetInformation, assetIsStroopsAsset} = StellarHelpers();
    const expertLink = expertUrl(`asset/${asset.getCode()}${asset.isNative()?'':'-'+asset.getIssuer()}`).href;
    const [assetHref, setAssetHref] = useState(expertLink);

    useEffect(() => {
        tomlAssetInformation(asset)
            .then(i => setAssetInformation(p => ({...p, ...i})))
            .catch(({reason}) => reason === 'native' && setAssetInformation(p => ({
                ...p,
                name: 'Stellar Lumens',
                domain: 'stellar.org',
            })));
        assetIsStroopsAsset(code).then(setIsStroopAsset);
        // eslint-disable-next-line
    }, []);
    useEffect(() => {
        const codepointsMatch = assetInformation.code?.match(emojiAssetRegex);
        if (null !== codepointsMatch) {
            setAssetInformation(p => ({
                ...p,
                code: assetInformation.code?.replace(emojiAssetRegex, match => String.fromCodePoint(Number(match))),
            }));
        }
        if (isStroopAsset) {
            setAssetHref(`https://litemint.com/items/${assetInformation.issuer}/${assetInformation.code}`)
        }
    }, [assetInformation.code, assetInformation.domain, assetInformation.issuer, isStroopAsset]);

    return (
        <Row align="middle" gutter={2}>
            <Col flex="40px">
                <Badge
                    count={isStroopAsset?<img alt="NFT logo" src={nftLogo} height={20} title={"An asset with this badge is considered a NFT"} />:0}
                    showZero={false}
                    offset={[-35,35]}>
                    <AssetImage asset={asset} assetInformation={assetInformation} />
                </Badge>
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

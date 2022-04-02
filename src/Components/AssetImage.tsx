import React, {useEffect, useState} from 'react';
import {TomlAssetInformation} from '../StellarHelpers';
import {Avatar, Image, Skeleton} from 'antd';
import stellarLogo from '../stellar_logo_black.png';
import { Asset } from 'stellar-sdk';

interface AssetImageProps {
    asset: Asset,
    assetInformation: TomlAssetInformation
    nft: boolean
}

export default function AssetImage ({asset, assetInformation, nft}: AssetImageProps) {
    const [imageSource, setImageSource] = useState<string>();
    useEffect(() => {
        if (asset.isNative()) {
            setImageSource(stellarLogo);
        } else if (assetInformation.code?.startsWith('0x')) {
            setImageSource('https://twemoji.maxcdn.com/v/latest/72x72/'+assetInformation.code?.substring(2).replace(/^0+/g, '').toLowerCase()+'.png');
        } else {
            setImageSource(assetInformation.image);
        }
    }, [asset, assetInformation.code, assetInformation.image, imageSource]);

    const shape = nft?'square':'circle';
    const loader = <Skeleton avatar={{shape:shape}} active />;

    return (<Avatar
        alt={`Logo for asset ${assetInformation.code} issued by ${assetInformation.issuer}`}
        shape={shape}
        size={40}
        src={imageSource?<Image src={imageSource} className={nft?"hexagon":""} preview={{mask: <></>, maskClassName:nft?"hexagon":""}} placeholder={loader} style={{objectFit:"fill", height: 40, width: 40}}/>:loader}
        children={(
            (assetInformation.code??'')
                // get only uppercase characters - if any
                .match(/\p{Lu}/gu)??[assetInformation.code?.toUpperCase()])
            .join('').substring(0, 4)}
    />);
};

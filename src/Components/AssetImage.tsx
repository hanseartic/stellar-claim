import React, {useEffect, useState} from 'react';
import {TomlAssetInformation} from '../StellarHelpers';
import {Avatar, Image} from 'antd';
import stellarLogo from '../stellar_logo_black.png';
import { Asset } from 'stellar-sdk';

export default function AssetImage ({asset, assetInformation}: { asset: Asset, assetInformation: TomlAssetInformation }) {
    const [imageSource, setImageSource] = useState(assetInformation.image);

    useEffect(() => {
        if (imageSource !== undefined) return undefined;
        if (asset.isNative()) {
            setImageSource(stellarLogo);
        } else if (assetInformation.code?.startsWith('0x')) {
            setImageSource('https://twemoji.maxcdn.com/v/latest/72x72/'+assetInformation.code?.substring(2).replace(/^0+/g, '')+'.png');
        } else {
            setImageSource(assetInformation.image);
        }
    }, [asset, assetInformation.code, assetInformation.image, imageSource]);

    return (<Avatar
        alt={`Logo for asset ${assetInformation.code} issued by ${assetInformation.issuer}`}
        shape='circle'
        size={40}
        src={imageSource?<Image src={imageSource} preview={{mask: undefined}} />:false}
        children={(
            (assetInformation.code??'')
                // get only uppercase characters - if any
                .match(/\p{Lu}/gu)??[assetInformation.code?.toUpperCase()])
            .join('').substr(0, 4)}
    />);
};

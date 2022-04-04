import React, {useEffect, useState} from 'react';
import {TomlAssetInformation, useAssetIsStroopsAsset} from '../../StellarHelpers';
import {Avatar, Image, Skeleton} from 'antd';
import stellarLogo from '../../stellar_logo_black.png';
import { Asset } from 'stellar-sdk';
import './style.css';

interface AssetImageProps {
    asset: Asset,
    assetInformation: TomlAssetInformation
}

interface loadingState {
    source?: string;
    finished: boolean;
    error: boolean;
}

export default function AssetImage ({asset, assetInformation}: AssetImageProps) {
    const [state, setState] = useState<loadingState>({finished: false, error: false});
    const nft = useAssetIsStroopsAsset(asset);

    useEffect(() => {
        if (asset.isNative()) {
            setState(s => ({...s, source: stellarLogo}));
        } else if (assetInformation.code?.startsWith('0x')) {
            setState(s => ({...s,
                source: 'https://twemoji.maxcdn.com/v/latest/72x72/'+assetInformation.code?.substring(2).replace(/^0+/g, '').toLowerCase()+'.png',
            }));
        } else {
            setState(s => ({...s,
                source: s.error?s.source:assetInformation.image,
            }));
        }
    }, [asset, assetInformation.code, assetInformation.image, state.error]);

    const shape = nft?'square':'circle';
    const className = nft?'hexagon':'';
    const loader = <Skeleton avatar={{shape:shape}} active />;

    const onImageLoadingError = () => {
        setState({finished: true, error: true, source: undefined});
    }
    const onImageLoaded = () => {
        setState(state => ({...state, finished: true}));
    }

    return (<Avatar
        alt={`Logo for asset ${assetInformation.code} issued by ${assetInformation.issuer}`}
        shape={shape}
        size={40}
        className={className}
        src={!state.error && <Image
            onLoad={onImageLoaded}
            onError={onImageLoadingError}
            wrapperClassName={"avatar-image"}
            src={state.source}
            preview={{mask: <></>}}
            placeholder={state.finished?null:loader} />}
        children={(
            (assetInformation.code??'')
                // get only uppercase characters - if any
                .match(/\p{Lu}/gu)??[assetInformation.code?.toUpperCase()])
            .join('').substring(0, 4)}
    />);
};

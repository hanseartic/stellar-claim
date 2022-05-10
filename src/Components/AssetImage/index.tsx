import React, {useEffect, useState} from 'react';
import {TomlAssetInformation, useAssetIsStroopsAsset} from '../../StellarHelpers';
import {Avatar, Image as AntImage} from 'antd';
import stellarLogo from '../../stellar_logo_black.png';
import { Asset } from 'stellar-sdk';
import './style.css';
import Placeholder from "./Placeholder";

interface AssetImageProps {
    asset: Asset,
    assetInformation: TomlAssetInformation
}

interface loadingState {
    source?: string;
    preview?: string;
    finished: boolean;
    error: boolean;
}

export default function AssetImage ({asset, assetInformation}: AssetImageProps) {
    const [state, setState] = useState<loadingState>({finished: false, error: false});
    const nft = useAssetIsStroopsAsset(asset);

    useEffect(() => {
        if (asset.isNative()) {
            setState(s => ({...s, preview: stellarLogo}));
        } else if (assetInformation.code?.startsWith('0x')) {
            setState(s => ({...s,
                preview: 'https://twemoji.maxcdn.com/v/latest/72x72/'+assetInformation.code?.substring(2).replace(/^0+/g, '').toLowerCase()+'.png',
            }));
        } else {
            setState(s => ({...s,
                source: s.error?s.source:assetInformation.image, preview: undefined,
            }));
        }
    }, [asset, assetInformation.code, assetInformation.image, assetInformation.domain, state.error]);

    const shape = nft?'square':'circle';
    const className = nft?'hexagon':'';

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
        src={!state.error && <AntImage
            onLoad={onImageLoaded}
            onError={onImageLoadingError}
            wrapperClassName={"avatar-image"}
            src={state.preview}
            preview={{
                mask: <></>,
                src: state.source
            }}
            placeholder={<Placeholder
                className={className}
                width={40} height={40}
                asset={asset}
                domain={assetInformation.domain??""}
                originalSource={state.source}
                onPreview={url => setState(p => ({...p, preview: url}))}
            />}
        />}
        children={(
            (assetInformation.code??'')
                // get only uppercase characters - if any
                .match(/\p{Lu}/gu)??[assetInformation.code?.toUpperCase()])
            .join('').substring(0, 4)}
    />);
};

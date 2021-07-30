import {Asset} from "stellar-sdk";
import React from "react";
import stellarLogo from "../stellar_logo_black.png";
import StellarHelpers, {shortAddress} from "../StellarHelpers";
import {Avatar, Image} from "antd";

export default function AssetImage ({asset}: { asset: Asset }) {
    const [source, setSource] = React.useState<string>();
    const {tomlAssetInformation} = StellarHelpers();

    tomlAssetInformation(asset)
        .then(info => {setSource(info.image);})
        .catch(({reason}) => reason === 'native' && setSource(stellarLogo));

    const issuer = asset.isNative()
        ? 'stellar'
        : shortAddress(asset.getIssuer(), 15)

    const assetCode = asset.getCode().startsWith('0x')
        ? String.fromCodePoint(Number(asset.getCode()))
        : asset.getCode();

    return (<Avatar
        alt={`Logo for asset ${asset.getCode()} issued by ${issuer}`}
        shape='circle'
        size={40}
        src={source?<Image src={source} preview={{mask: undefined}} />:undefined}
        children={assetCode}
    />);
};

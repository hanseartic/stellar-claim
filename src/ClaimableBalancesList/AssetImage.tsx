import {Asset} from "stellar-sdk";
import React from "react";
import stellarLogo from "../stellar_logo_black.png";
import StellarHelpers, {shortAddress} from "../StellarHelpers";
import {Avatar} from "antd";

export default function AssetImage ({asset}: { asset: Asset }) {
    const [source, setSource] = React.useState<string>();
    const {tomlAssetInformation} = StellarHelpers();

    tomlAssetInformation(asset)
        .then(info => {setSource(info.image);})
        .catch(({reason}) => reason === 'native' && setSource(stellarLogo));

    const issuer = asset.isNative()
        ? 'stellar'
        : shortAddress(asset.getIssuer(), 15)

    return (<Avatar
        alt={`Logo for asset ${asset.getCode()} issued by ${issuer}`}
        shape='circle'
        size={40}
        src={source}
        children={asset.getCode()}
    />);
};

import React from "react";
import {TomlAssetInformation} from "../StellarHelpers";
import {Avatar, Image} from "antd";

export default function AssetImage ({assetInformation}: { assetInformation: TomlAssetInformation }) {

    return (<Avatar
        alt={`Logo for asset ${assetInformation.code} issued by ${assetInformation.issuer}`}
        shape='circle'
        size={40}
        src={assetInformation.image?<Image src={assetInformation.image} preview={{mask: undefined}} />:undefined}
        children={assetInformation.code?.substr(0, 4)}
    />);
};

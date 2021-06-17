import {Asset} from "stellar-sdk";

export const getStellarAssetFromString = (assetString) => {
    if (assetString === 'native') return Asset.native();
    return new Asset(...assetString.split(':'))
};

String.prototype.shorten = function (shortenTo) {
    if (shortenTo + 1 >= this.length) return this;
    return this.slice(0, Math.floor(shortenTo/2)) + '…' + this.slice(-Math.ceil(shortenTo/2));
};
import BigNumber from "bignumber.js";
import {useAssetIsStroopsAsset} from "../../StellarHelpers";
import AmountInput from "./AmountInput";

interface AssetAmountProps {
    amount: string,
    asset: string
}

export const stroopsRatio = 10000000;
export const amountFormat = {
    fractionGroupSeparator: ' ',
    fractionGroupSize: 3,
    groupSeparator: ',',
    groupSize: 3,
    decimalSeparator: '.'
};

export const formatAmount = (stringAmount: string, asStroop: boolean): string =>
    parseFormattedStringValueToBigNumber(stringAmount)
        ?.multipliedBy(asStroop?stroopsRatio:1)
        .toFormat(amountFormat)
    ??'';

export const parseFormattedStringValueToBigNumber = (stringValue: string): BigNumber|undefined => {
    if (stringValue === null) {
        return undefined;
    }
    const separators = [",", "."];

    return new BigNumber(String(stringValue)
        .replace(new RegExp(separators[0].replace(/\s/g," "),"g"), "")
        .replace(separators[1],".")
        .replace(/[\s   ]/g, "")
    )
        .decimalPlaces(7, BigNumber.ROUND_HALF_CEIL);
};

const AssetAmount = ({amount, asset}: AssetAmountProps) => {
    const isStroopsAsset = useAssetIsStroopsAsset(asset);

    return <>{formatAmount(amount, isStroopsAsset)}</>
}

export default AssetAmount;
export {
    AmountInput
};

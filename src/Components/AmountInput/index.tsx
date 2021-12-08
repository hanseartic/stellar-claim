import BigNumber from "bignumber.js";
import {InputProps} from "antd/lib/input/Input";
import {Input} from "antd";
import {useEffect, useRef, useState} from "react";

export const amountFormat = {
    fractionGroupSeparator: ' ',
    fractionGroupSize: 3,
    groupSeparator: ',',
    groupSize: 3,
    decimalSeparator: '.'
};

export const formatAmount = (stringAmount: string): string =>
    parseFormattedStringValueToBigNumber(stringAmount)?.toFormat(amountFormat)??'';

const parseFormattedStringValueToBigNumber = (stringValue: string): BigNumber|undefined => {
    if (stringValue === null) {
        return;
    }
    const separators = Number(1234.56)
        .toLocaleString()
        .replace(/\d+/g,"")
        .split("");
    if (separators.length === 1) {
        separators.unshift('');
    }

    return new BigNumber(String(stringValue)
        .replace(new RegExp(separators[0].replace(/\s/g," "),"g"), "")
        .replace(separators[1],".")
        .replace(/[\s   ]/g, "")
    ).decimalPlaces(7, BigNumber.ROUND_HALF_CEIL);
};

interface AmountInputProps extends Omit<InputProps, "onChange"|"value"> {
    onChange?: (value: BigNumber|undefined) => void,
    showAsStroops?: boolean,
    value?: BigNumber,
}

const AmountInput = (props: AmountInputProps) => {
    const inputRef = useRef<any>(null);
    const [stringValue, setStringValue] = useState("");
    const [cursorPos, setCursorPos] = useState<number|null>(null);
    const {onChange, value} = props;
    const notifyChange = (val: BigNumber|undefined) => {
        onChange?.(val);
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        handleChange(e.target.value, e.target.selectionStart)
    };


    const handleChange = (currentStringValue: string, currentCursor: number|null) => {
        const currentLength = currentStringValue.length;
        if (currentStringValue === "") {
            setStringValue("");
        }
        let currentValue = parseFormattedStringValueToBigNumber(currentStringValue);
        if (!currentValue || currentValue.isNaN()) {
            notifyChange(undefined);
        } else {
            if (currentValue.isNegative()) {
                currentValue = currentValue.times(-1);
            }
            const decimalStart = currentStringValue.search(/\.[\d\s   ]*0*$/);
            let decimalPlaces = currentValue.decimalPlaces();
            if (decimalStart >= 0) {
                const decimalsPart = currentStringValue
                    .substring(decimalStart+1)
                    .replace(/[\s   ]/g, "");
                const desiredDecimals = Math.min(7, decimalsPart.length);
                decimalPlaces = Math.max(decimalPlaces, desiredDecimals);
            }
            const newStringValue = currentValue.toFormat(decimalPlaces, amountFormat)
                + (currentStringValue.endsWith(".") ? "." : "")
            setStringValue(newStringValue);
            notifyChange(currentValue);
            setCursorPos((currentCursor??0) + (newStringValue.length - currentLength));
        }
    };

    useEffect(() => {
        setStringValue(prev => {
            const newStringValue = value?.toFormat(amountFormat)??'';
            return parseFormattedStringValueToBigNumber(prev)?.eq(value??0)
                ? prev : newStringValue;
        });
    }, [value]);

    useEffect(() => {
        const inputElement = inputRef.current;
        inputElement.setSelectionRange(cursorPos, cursorPos);
    }, [stringValue, inputRef, cursorPos]);

    return <Input {...props} value={stringValue} onChange={onInputChange} ref={inputRef} />;
};

export default AmountInput;

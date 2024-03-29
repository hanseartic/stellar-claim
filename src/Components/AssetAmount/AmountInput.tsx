import BigNumber from "bignumber.js";
import {InputProps} from "antd/lib/input/Input";
import {Input, Tooltip} from "antd";
import {useEffect, useRef, useState} from "react";
import {amountFormat, formatAmount, parseFormattedStringValueToBigNumber, stroopsRatio} from ".";


interface AmountInputProps extends Omit<InputProps, "onChange"|"value"> {
    onChange?: (value: BigNumber|undefined) => void,
    showAsStroops?: boolean,
    value?: BigNumber,
}

const AmountInput = (props: AmountInputProps) => {
    const inputRef = useRef<any>(null);
    const [stringValue, setStringValue] = useState("");
    const [cursorPos, setCursorPos] = useState<number|null>(null);
    const {onChange, value, showAsStroops, placeholder} = props;
    const notifyChange = (val: BigNumber|undefined) => {
        onChange?.(val?.div(showAsStroops?stroopsRatio:1));
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
            let decimalPlaces = currentValue.decimalPlaces()??0;
            if (decimalStart >= 0) {
                const decimalsPart = currentStringValue
                    .substring(decimalStart+1)
                    .replace(/[\s   ]/g, "");
                const desiredDecimals = Math.min(7, decimalsPart.length);
                decimalPlaces = Math.max(decimalPlaces, desiredDecimals);
            }
            const newStringValue = currentValue.toFormat(decimalPlaces, amountFormat)
                + (currentStringValue.endsWith(".") ? "." : "");
            setStringValue(newStringValue);
            notifyChange(currentValue);
            setCursorPos((currentCursor??0) + (newStringValue.length - currentLength));
        }
    };

    useEffect(() => {
        setStringValue(prev => {
            const newStringValue = value
                ?.multipliedBy(showAsStroops?stroopsRatio:1)
                .toFormat(amountFormat)??'';
            return parseFormattedStringValueToBigNumber(prev)?.eq(value??0)
                ? prev : newStringValue;
        });
    }, [value, showAsStroops]);

    useEffect(() => {
        const inputElement = inputRef.current;
        inputElement.setSelectionRange(cursorPos, cursorPos);
    }, [stringValue, inputRef, cursorPos]);

    const input = <Input {...props}
                         value={stringValue}
                         onChange={onInputChange}
                         placeholder={formatAmount(placeholder??"", showAsStroops??false)}
                         ref={inputRef} />;
    return <Tooltip trigger={["focus"]}
                    placement={"bottomLeft"}
                    title={<>Corresponds to actual value of <br/><code>{value?.toString(10)??"0"}</code></>}
                    visible={showAsStroops?((value?.gte(0)??false)?undefined:false):false}>{input}</Tooltip>;
};

export default AmountInput;

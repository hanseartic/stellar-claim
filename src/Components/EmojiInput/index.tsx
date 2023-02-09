import {AutoComplete, Input} from "antd";
import {InputProps} from "antd/lib/input/Input";
import data, { Emoji } from '@emoji-mart/data'
import { init, SearchIndex } from 'emoji-mart'

import { DefaultOptionType } from "antd/lib/select";
import {useState} from "react";

type OptionsEntry = {value: string};
interface AutoCompleteOptionType extends Omit<DefaultOptionType, "children"> {
    options: OptionsEntry[]
}
type OptionsType = AutoCompleteOptionType[];

export interface EmojiInputProps extends Omit<InputProps, 'onChange'|'value'> {
    onChange?: (value: string|undefined) => void,
    value?: string|undefined,
}

export const emojiShortcodeMatch = /:[_+\-a-z0-9]*:?/;
export default function EmojiInput(props: EmojiInputProps) {
    init({data});

    const [autocompleteOptions, setAutocompleteOptions] = useState<OptionsType>([]);

    const handleChange = (search?: string) => {
        props.onChange?.(search);
    };

    const onInputChange = (changedData: string) => {
        handleChange(changedData);
    };

    const onEmojiSearch = (searchText: string): void => {
        const match = searchText.match(emojiShortcodeMatch);
        if (match?.length) {
            const colonSearch = match[0].replaceAll(':', '');

            SearchIndex.search(colonSearch)
                .then((results: Emoji[]) => (results??[])
                    .map<AutoCompleteOptionType>(emoji => ({
                        label: emoji.name,
                        options: emoji.skins.map(skin => ({value: skin.native})),
                    }))
                )
                .then(setAutocompleteOptions);
        } else {
            setAutocompleteOptions([]);
        }
    };

    const onEmojiSelect = (emoji: string) => {
        const memoWithReplacedShortcode = props.value?.replace(emojiShortcodeMatch, emoji);
        handleChange(memoWithReplacedShortcode);
        setAutocompleteOptions([]);
    };

    const theInput = <Input {...props} onChange={() => {}} />;
    return <AutoComplete
        value={props.value}
        onChange={onInputChange}
        onSearch={onEmojiSearch}
        onSelect={onEmojiSelect}
        options={autocompleteOptions}
        style={{width: "100%"}}
    >
        {theInput}
    </AutoComplete>
}

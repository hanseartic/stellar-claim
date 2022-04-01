import {AutoComplete, Input} from "antd";
import {InputProps} from "antd/lib/input/Input";
import {BaseEmoji, EmojiData, EmojiEntry, emojiIndex} from "emoji-mart";
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
    const [autocompleteOptions, setAutocompleteOptions] = useState<OptionsType>([]);

    const handleChange = (search?: string) => {
        props.onChange?.(search);
    };

    const onInputChange = (changedData: string) => {
        handleChange(changedData);
    };

    const isEmojiData = (emoji: EmojiEntry): boolean => {
        return Object.getOwnPropertyNames(emoji).includes('id');
    };

    const onEmojiSearch = (searchText: string): void => {
        const match = searchText.match(emojiShortcodeMatch);
        if (match?.length) {
            const colonSearch = match[0].replaceAll(':', '');

            const suggestions = Object.values(emojiIndex.emojis)
                .flatMap((emoji: EmojiEntry) => (isEmojiData(emoji)?emoji:Object.values(emoji)) as EmojiData[])
                .filter(e => (e.name.toLowerCase().search(colonSearch) >= 0)
                    || (e.id?.search(colonSearch)??-1) >= 0
                    || (e.colons?.search(colonSearch)??-1) >= 0)
                .map<AutoCompleteOptionType>((emojiData) => ({
                    label: (emojiData.name??''),
                    options: [{value: (emojiData as BaseEmoji).native}],
                }));

            const groupedSuggestions = suggestions
                // get unique labels
                .map<string>(s => s.label)
                .filter((label, i, labels) => labels.indexOf(label) === i)
                // map merge all options with a given label in a single object
                .map<AutoCompleteOptionType>(label => {
                    const options = suggestions
                        .filter(suggestion => suggestion.label === label)
                        .flatMap<OptionsEntry>(s => s.options)
                        .filter((currentOption, index, allOptions) => allOptions
                            .map(o => o.value).indexOf(currentOption.value) === index
                    );

                    return ({
                        label: label,
                        options: options,
                })});
            setAutocompleteOptions(groupedSuggestions);
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

import ClaimBalances from "./ClaimBalances";
import ReactMarkdown, { ReactElement } from "react-markdown";
import aboutMarkdown from './About.md';
import privacyMarkdown from './Privacy.md';
import rehypeRaw from 'rehype-raw';
import {useEffect, useState} from "react";
import {Components} from "react-markdown/src/ast-to-react";
import {Keypair} from "stellar-sdk";
import {shortAddress} from "../StellarHelpers";
import QRCodeStyling from "qr-code-styling";
import {Image} from "antd";

const ImageUriTransformer = (src: string): string => {
    const [imageSource, setImageSource] = useState<string>(src);

    if (src.startsWith('..')) {
        import(`../${src.substring(3)}`)
            .then(({default: imageSrc}) => setImageSource(imageSrc))
            .catch(e => console.warn(e));
    }
    return imageSource;
};

const blobToBase64 = (blob: Blob|null) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => {
        resolve(reader.result as string);
    }
    if (!blob) {
        throw new Error('blob empty');
    }
    reader.readAsDataURL(blob);
});

const QRCode = () => {
    const [data, setData] = useState<string>();

    useEffect(() => {
        const qr = new QRCodeStyling({data: process.env.REACT_APP_DONATION_ADDRESS,});
        qr.getRawData()
            .then(blobToBase64)
            .then((t) => setData(t));
    }, []);

    return <Image height={120} src={data} />;
}

const components: Components = {
    abbr: ({...props}) => {
        const defaultResult = (<abbr {...{...props, node: undefined}}>{props.children}</abbr>);
        if (props['data-length'] === undefined) return defaultResult;
        if (props.children.length !== 1) return defaultResult;
        const child = props.children[0] as ReactElement;
        if (typeof child.type !== 'function') return defaultResult;
        const fnResult = (child.type as () => any)();
        props.title = fnResult;
        return <abbr {...{...props, node: undefined}}>{shortAddress(fnResult, parseInt(props['data-length'] as string))}</abbr>;},
    object: ({...props}) => {return <object {...{...props, node:undefined}}>{process.env[props['data-env'] as string]??props.children}</object>;},
    keygen: () => Keypair.random().publicKey(),
    embed: ({...props}) => { if (props.type === "img/donation-qr") {return QRCode();} return <embed {...props} />;},
};

const MarkdownPage = (props: {source: string}) => {
    const [markdown, setMarkdown] = useState<string>('');
    useEffect(() => {
        fetch(props.source)
            .then(res => res.text())
            .then(text => setMarkdown(text));
    }, [props.source]);

    return (<div style={{textAlign: "left"}}>
        <ReactMarkdown
            children={markdown}
            components={components}
            rehypePlugins={[rehypeRaw]}
            transformImageUri={ImageUriTransformer}
        />
        </div>);
}

const Privacy = () => <MarkdownPage source={privacyMarkdown} />;
const About = () =>  <MarkdownPage source={aboutMarkdown} />;

export {
    About,
    ClaimBalances,
    Privacy
};

import AccountOverview from "./AccountOverview";
import ClaimBalances from "./ClaimBalances";
import ReactMarkdown, { Components } from "react-markdown";
import aboutMarkdown from './About.md';
import privacyMarkdown from './Privacy.md';
import rehypeRaw from 'rehype-raw';
import {useEffect, useState, ReactElement} from "react";
import {Image} from "antd";
import directive from "remark-directive";
import envRemarkPlugin from "@hanseartic/remark-env-directive"
import qrCodeRemarkPlugin from "@hanseartic/remark-qrcode-directive";
import stellarAddressRemarkPlugin from "./stellarAddressPlugin";

const ImageUriTransformer = (src: string): string => {
    const [imageSource, setImageSource] = useState<string>(src);

    if (src.startsWith('..')) {
        import(`../${src.substring(3)}`)
            .then(({default: imageSrc}) => setImageSource(imageSrc))
            .catch(e => console.warn(e));
    }
    return imageSource;
};

const components: Components = {
    img: (props) => <Image src={props.src} title={props.title} alt={props.alt} />
};

const MarkdownPage = (props: {source: string}) => {
    const [markdown, setMarkdown] = useState<string>('');
    useEffect(() => {
        fetch(props.source)
            .then(res => res.text())
            .then(text => setMarkdown(text));
    }, [props.source]);

    return (<div style={{textAlign: "left"}} className={"App-md"}>
        <ReactMarkdown
            components={components}
            remarkPlugins={[directive, envRemarkPlugin, stellarAddressRemarkPlugin, qrCodeRemarkPlugin]}
            rehypePlugins={[rehypeRaw]}
            transformImageUri={ImageUriTransformer}
        >{markdown}</ReactMarkdown>
        </div>);
}

const Privacy = () => <MarkdownPage source={privacyMarkdown} />;
const About = () =>  <MarkdownPage source={aboutMarkdown} />;

export {
    About,
    AccountOverview,
    ClaimBalances,
    Privacy
};

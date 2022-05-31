import {Image as AntImage, ImageProps, Skeleton} from "antd";
import {Asset} from "stellar-sdk";
import React, {useEffect, useMemo, useState} from "react";
import URI from "urijs";

interface  PlaceholderProps extends ImageProps {
    asset: Asset;
    domain: string;
    originalSource?: string;
    onPreview?: (url: string) => void | undefined;
}

const Placeholder = (props: PlaceholderProps) => {
    const {asset, onPreview, originalSource} = props;
    const skeleton = useMemo(() => <Skeleton avatar={{shape:"square"}} active={true} />, []);
    const [extension, setExtension] = useState<string>();
    const url = useMemo(
        () => `https://litemint.azureedge.net/userdata/original-${asset.code}-${asset.issuer}-256.${extension}`,
        [extension, asset]
    );
    useEffect(() => {
        if (!originalSource) {
            return;
        }
        const knownSourceHosts = ["ipfs.io"];
        if (knownSourceHosts.includes(new URI(originalSource).host())) {
            fetch(originalSource, {method:"GET", headers: {"Range": "bytes=0-0"}})
                .then(res => res.blob())
                .then(blob => {
                    if (blob.type.includes("image/")) {
                        setExtension(blob.type.split("/")[1]);
                    }
                })
                .catch(console.debug);
        } else {
            onPreview?.(originalSource);
        }
    }, [originalSource, onPreview]);

    const [loadingFailed, setLoadingFailed] = useState(false);

    const handleLoadError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        e.preventDefault();
        e.stopPropagation();
        console.debug("failed to load preview from url", url);
        setLoadingFailed(true);
        if (originalSource) onPreview?.(originalSource);
    };

    const imageProps = {...props, onPreview: undefined, originalSource: undefined, src: undefined, asset: undefined, domain: undefined};
    return <>{props.domain.includes("litemint.store") && !loadingFailed && extension
        ? <AntImage
            {...imageProps}
            src={url}
            onError={handleLoadError}
            onLoad={() => onPreview?.(url)}
            preview={false}
            placeholder={skeleton}
        />
        : skeleton}</>;
}

export default Placeholder;

import {useEffect, useState, CSSProperties} from "react";
import {useHistory, useLocation} from "react-router-dom";

export const useUpdateAvailable = (): boolean => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const serverVersion = useServerVersion();
    const history = useHistory();
    const loc = useLocation();

    useEffect(() => {
        setUpdateAvailable(currentVersion() !== serverVersion);
    }, [serverVersion, history, loc]);

    return updateAvailable;
}
const currentVersion = () => process.env.REACT_APP_VERSION?.substring(0, 7);

const useServerVersion = (): string|undefined => {
    const [version, setVersion] = useState<string|undefined>(undefined);
    const history = useHistory();
    const loc = useLocation();

    useEffect(() => {
        fetch("/VERSION")
            .then(r => r.text())
            .then(version => version.replaceAll(/[\r\n]+/g, ""))
            .then(version => version.substring(0, 7))
            .then(setVersion)
            .catch(() => setVersion("unknown"));
    }, [history, loc]);

    return version;
}

interface AppVersionProps {
    style?: CSSProperties
}
const AppVersion = (props: AppVersionProps) => {
    return <text  {...props}>v: {currentVersion()}</text>;
}

export default AppVersion;

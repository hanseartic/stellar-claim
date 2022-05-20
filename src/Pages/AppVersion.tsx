import { useEffect, useState, CSSProperties } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useInterval } from "react-use";
import Text from "antd/es/typography/Text";
import { SERVER_VERSION_PATH } from "../shared";

const getVersionFromServer = () => fetch(SERVER_VERSION_PATH)
        .then(r => r.json())
        .then(version => version.current)
        .catch(() => "unknown");

export const useUpdateAvailable = (): boolean => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [serverVersion, setServerVersion] = useState<string>();
    const appVersion = useAppVersion();
    const history = useHistory();
    const loc = useLocation();

    useInterval(() => {
        getVersionFromServer().then(setServerVersion);
        }, Number(process.env.REACT_APP_POLL_VERSION??60000)
    );

    useEffect(() => {
        if (!appVersion || !serverVersion) {
            return;
        }
        setUpdateAvailable(appVersion !== serverVersion);
    }, [appVersion, serverVersion, history, loc]);

    return updateAvailable;
}

const useAppVersion = () => {
    const [appVersion, setAppVersion] = useState<string>();

    useEffect(() => {
        getVersionFromServer()
            .then(serverVersion => {
                setAppVersion(appVersion => appVersion??serverVersion);
            });
    }, []);

    return appVersion;
};

interface AppVersionProps {
    style?: CSSProperties
}
const AppVersion = (props: AppVersionProps) => {
    const appVersion = useAppVersion();
    return <Text {...props}>v: {appVersion}</Text>;
}

export default AppVersion;

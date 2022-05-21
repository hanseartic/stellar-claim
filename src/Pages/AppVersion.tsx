import { useEffect, useState, CSSProperties } from "react";
import { useHistory, useLocation } from "react-router-dom";
import Text from "antd/es/typography/Text";
import { SERVER_VERSION_PATH } from "../shared";
import { Workbox } from "workbox-window";

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

    useEffect(() => {
        const workbox = new Workbox(process.env.PUBLIC_URL + "/service-worker.js");
        workbox.addEventListener("waiting", () => {
            workbox.messageSW({type: 'GET_VERSION'})
                .then(version => {
                    console.debug("got server-version from service-worker", version);
                    setServerVersion(version.server);
                    if (version.server === version.app) {
                        // immediately update the worker, when a new version was found
                        // on page load
                        workbox.messageSkipWaiting();
                    }
                });
        });
        workbox.register();
    }, []);

    useEffect(() => {
        if (!appVersion || !serverVersion) {
            return;
        }
        setUpdateAvailable(isUpdateAvailable => isUpdateAvailable || (appVersion !== serverVersion));
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

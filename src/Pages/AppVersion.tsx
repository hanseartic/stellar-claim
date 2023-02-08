import { useEffect, useState, CSSProperties } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Text from "antd/es/typography/Text";
import { APP_VERSION } from "../app_version";
import { Workbox } from "workbox-window";
import {useInterval} from "react-use";

export const useUpdateAvailable = (): boolean => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [serverVersion, setServerVersion] = useState<string>();
    const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration>();
    const appVersion = useAppVersion();
    const navigate = useNavigate();
    const loc = useLocation();

    useInterval(() => {
        serviceWorkerRegistration?.update().catch(() => {});
    }, Number(process.env.REACT_APP_POLL_VERSION??60000));

    useEffect(() => {
        const workbox = new Workbox(process.env.PUBLIC_URL + "/service-worker.js");
        workbox.addEventListener("waiting", () => {
            workbox.messageSW({type: 'GET_VERSION'})
                .then(version => {
                    console.debug("got server-version from service-worker", version);
                    setServerVersion(version.server);
                    if (version.server !== version.app) {
                        // immediately update the worker, when a new version was found
                        // on page load
                        workbox.messageSkipWaiting();
                    }
                });
        });
        workbox.register().then(reg => setServiceWorkerRegistration(reg));
    }, []);

    useEffect(() => {
        if (!appVersion || !serverVersion) {
            return;
        }
        serviceWorkerRegistration?.update().catch(() => {});
        setUpdateAvailable(isUpdateAvailable => isUpdateAvailable || (appVersion !== serverVersion));
    }, [appVersion, serverVersion, navigate, loc, serviceWorkerRegistration]);

    return updateAvailable;
}

const useAppVersion = () => {
    return APP_VERSION;
};

interface AppVersionProps {
    style?: CSSProperties
}
const AppVersion = (props: AppVersionProps) => {
    const appVersion = useAppVersion();
    return <Text {...props}>v: {appVersion}</Text>;
}

export default AppVersion;

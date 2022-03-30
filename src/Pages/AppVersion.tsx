import {useEffect, useState} from "react";
import {useHistory, useLocation} from "react-router-dom";

const AppVersion = () => {
    const [version, setVersion] = useState<string|null>(null);
    const history = useHistory();
    const loc = useLocation();

    useEffect(() => {
        fetch("/VERSION")
            .then(r => r.text())
            .then(version => setVersion(version))
            .catch(() => setVersion("unknown"));
    }, [history, loc]);

    return <>{version}</>;
}

export default AppVersion;

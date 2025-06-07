import react, {useEffect, useMemo, useState} from 'react';
import {BrowserRouter as Router, Link, Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import './App.css';
import 'antd/dist/reset.css';
import Pages, {About, AccountOverview, ClaimBalances, Privacy} from './Pages';
import {ApplicationContextProvider} from './ApplicationContext';
import useApplicationState from './useApplicationState';
import {
    ApiOutlined,
    BarChartOutlined,
    CloudDownloadOutlined,
    InfoCircleOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    SafetyOutlined,
    SettingOutlined,
    TableOutlined,
} from '@ant-design/icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faBroadcastTower, faHandHolding, faIdCard, faWallet,} from '@fortawesome/free-solid-svg-icons';

import {Badge, Breadcrumb, Layout, Menu, MenuProps, Switch as ToggleSwitch} from 'antd';
import {AccountState} from "./Components/AccountSelector";
import {Workbox} from "workbox-window";
import AppVersion, {useUpdateAvailable} from "./Pages/AppVersion";
import {horizonUrls} from "./StellarHelpers";
import {Server} from "stellar-sdk";
import {AccountFetcherMessage, AccountFetcherResponse} from './updateAccountWorker';
const { Item: MenuItem, SubMenu } = Menu;
const { Content, Footer, Header, Sider } = Layout;

const App = () => {
    const { accountInformation, setAccountInformation, showBalancesPagination, setShowBalancesPagination, loadMarket, setLoadMarket, menuCollapsed, setMenuCollapsed, setUsePublicNetwork, usePublicNetwork, setWebWorker } = useApplicationState();
    const collapseTrigger = react.createElement(
        menuCollapsed?MenuUnfoldOutlined:MenuFoldOutlined, {
            onClick: () => setMenuCollapsed(!menuCollapsed)
        });
    const navigate = useNavigate();
    const location = useLocation();
    const updateAvailable = useUpdateAvailable();
    const [navigateTo, setNavigateTo] = useState('/account/');
    function goHome() {
        navigate("/account/");
    }

    const refreshApp = () => {
        const workbox = new Workbox(process.env.PUBLIC_URL + "/service-worker.js");
        workbox.addEventListener('controlling', () => {
            window.location.reload();
        });

        workbox.register().then(reg => {
            if (reg?.waiting) {
                reg.waiting.postMessage({type: 'SKIP_WAITING'});
            } else {
                window.location.reload();
            }
        });
    }
    useEffect(() => {
        if (location.pathname.startsWith('/claim/') || location.pathname.startsWith('/account/')) {
            let page = location.pathname.split('/')[1];
            if (accountInformation.state === AccountState.notSet) navigate(`/${page}/`, { replace: true });
            if ([AccountState.valid].includes(accountInformation.state!)) navigate(`/${page}/${accountInformation.account!.id}`, { replace: true });
        }
    }, [accountInformation, navigate, location.pathname]);
    useEffect(() => {
        navigate(navigateTo);
    }, [navigate, navigateTo]);

    const worker = useMemo(() =>
        new Worker(new URL('./updateAccountWorker.tsx', import.meta.url), {type: "module"}),
        []);

    useEffect(() => {
        return () => {
            worker.terminate();
        }
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        if (accountInformation.state !== AccountState.valid) {
            return;
        }

        worker.onmessage = ((ev: MessageEvent<AccountFetcherResponse>) => {
            if (accountInformation.account?.id) {
                const server = new Server(horizonUrls[usePublicNetwork?"PUBLIC":"TESTNET"]);
                server.loadAccount(accountInformation.account.id)
                    .then(account => setAccountInformation({account}));
            }
        });
        worker.postMessage({
            network: usePublicNetwork?"PUBLIC":"TESTNET",
            accountId: accountInformation.account?.id,
            interval: Number(process.env.REACT_APP_POLL_ACCOUNT ?? 60000),
        } as AccountFetcherMessage);
        setWebWorker(worker);

        // eslint-disable-next-line
    }, [accountInformation.account, usePublicNetwork]);


    type AntMenuItem = Required<MenuProps>['items'][number];
    const menuItems: AntMenuItem[] = [
        {
            key: 'account',
            label: 'Stellar Account',
            icon: <FontAwesomeIcon icon={faWallet}/>,
            onClick: () => setNavigateTo('/account/'),
            children: [
                {
                    key: 'account:overview',
                    label: 'Account overview',
                    icon: <FontAwesomeIcon icon={faIdCard}/>,
                    onClick: () => setNavigateTo('/account/'),
                },
                {
                    key: 'account:claim',
                    label: 'Claim balances',
                    icon: <FontAwesomeIcon icon={faIdCard}/>,
                    onClick: () => setNavigateTo('/claim/'),
                },
            ]
        },
        {
            key: 'settings',
            label: 'Settings',
            icon: <SettingOutlined />,
            children: [
                {
                    type: 'group',
                    label: 'Network',
                    children: [
                        {
                            label: 'Network',
                            key: 'settings:toggleNetwork',
                            icon: <FontAwesomeIcon icon={faBroadcastTower}/>,
                            children: [
                                {
                                    icon: <ToggleSwitch checkedChildren="Public" unCheckedChildren="Testnet" onChange={setUsePublicNetwork} checked={usePublicNetwork}/>
                                }
                            ]
                        } as AntMenuItem
                    ],
                },
                {
                    type: 'group',
                    label: 'Account overview',
                    children: [
                        {
                            label: 'Load market for balances',
                            key: 'settings:loadMarket',
                        },
                        {
                            label: 'Paginate balances list',
                            key: 'settings:paginateBalances',
                        }
                    ],
                }
            ],
        },
        {
            key: 'about',
            label: 'About this site',
            icon: <InfoCircleOutlined />,
            onClick: () => setNavigateTo('/about'),
        },
        {
            key: 'privacy',
            label: 'Privacy information',
            icon: <SafetyOutlined />,
            onClick: () => setNavigateTo('/privacy'),
        },
        {
            key: 'app:version',
            label: "App Version"+(updateAvailable?" - update available":""),
            icon: <Badge count={menuCollapsed && updateAvailable?1:0} dot offset={[0, 8]}><ApiOutlined style={{color: "lightgray"}}/></Badge>,
            children: [<AppVersion style={{color: "lightgray"}} />]
        } as AntMenuItem
    ];

    return (
        <Layout className="App">
            <Sider
                className="App-menu"
                collapsed={menuCollapsed}
                collapsible={true}
                trigger={collapseTrigger}
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                }}>
                {/*<div><img src={logo} className="App-logo" alt="logo"/></div>*/}
                <Menu forceSubMenuRender={true} theme="dark" mode="vertical" selectable={false} items={menuItems}>
                    <SubMenu title="Stellar Account" key="account" icon={<FontAwesomeIcon icon={faWallet}/>} onTitleClick={goHome}>
                        <MenuItem title="Account overview" icon={<FontAwesomeIcon icon={faIdCard}/>} key="account:overview">
                            <Link to="/account/">Account overview</Link>
                        </MenuItem>
                        <MenuItem title="Claim Balances" icon={<FontAwesomeIcon icon={faHandHolding}/>} key="account:claim">
                            <Link to="/claim/">Claim</Link>
                        </MenuItem>
                    </SubMenu>
                    <SubMenu key="settings" icon={<SettingOutlined />} title={"Settings"}>
                        <Menu.ItemGroup title="Network">
                            <MenuItem key="settings:toggleNetwork" title="Network" icon={<FontAwesomeIcon icon={faBroadcastTower}/>} onClick={({domEvent}) => domEvent.preventDefault()}>
                                <ToggleSwitch checkedChildren="Public" unCheckedChildren="Testnet" onChange={setUsePublicNetwork} checked={usePublicNetwork}/>
                            </MenuItem>
                        </Menu.ItemGroup>
                        <Menu.ItemGroup title="Account overview">
                            <Menu.Item key="settings:loadMarkets" title="Load market for balances" icon={<BarChartOutlined />} prefix={"Market"} onClick={({domEvent}) => domEvent.preventDefault()}>
                                <ToggleSwitch checkedChildren="show demand" unCheckedChildren="no demand" onChange={setLoadMarket} checked={loadMarket}/>
                            </Menu.Item>
                            <Menu.Item key="settings:paginateBalances" title="Paginate balances list" icon={<TableOutlined />} onClick={({domEvent}) => domEvent.preventDefault()}>
                                <ToggleSwitch checkedChildren="paginate" unCheckedChildren="show all" onChange={setShowBalancesPagination} checked={showBalancesPagination}/>
                            </Menu.Item>
                        </Menu.ItemGroup>
                    </SubMenu>
                    <MenuItem title="About this page" key="about" icon={<InfoCircleOutlined />}>
                            <Link to="/about">About</Link>
                    </MenuItem>
                    <MenuItem title="Privacy information" key="privacy" icon={<SafetyOutlined />}>
                        <Link to="/privacy">Privacy</Link>
                    </MenuItem>
                    <MenuItem title={"App Version"+(updateAvailable?" - update available":"")}
                              key="app:version"
                              icon={<Badge count={menuCollapsed && updateAvailable?1:0} dot offset={[0, 8]}><ApiOutlined style={{color: "lightgray"}}/></Badge>}
                              style={{cursor: "default"}}
                    >
                        <Badge
                            offset={[6,-2]}
                            count={updateAvailable
                                ? <Link to="#" onClick={() => refreshApp()}> <CloudDownloadOutlined style={{ color: "lightgray", fontSize: "larger"}} /></Link>
                                : 0}
                            style={{color: "lightgray"}} >
                            <AppVersion style={{color: "lightgray"}} />
                        </Badge>
                    </MenuItem>
                </Menu>
            </Sider>
            <Layout style={{ marginLeft: menuCollapsed?80:200, transition: 'ease-in margin 0.2s'}}>
                <Header className="App-header">
                    <Breadcrumb />
                </Header>
                <Content className="App-content">
                    <Routes>
                        <Route path="/" element={<Pages />}>
                        {/*<Route path={['/http:', '/https:']} component={(props: {location: Location}) => {
                            window.location.replace(props.location.pathname.substr(1)) // substr(1) removes the preceding '/'
                            return null
                        }}/>*/}
                            <Route path="account/:account?" element={<AccountOverview />} />
                            <Route path="about" element={<About />} />
                            <Route path="privacy" element={<Privacy />} />
                            <Route path="claim/:account?" element={<ClaimBalances />} />
                        </Route>
                    </Routes>
                </Content>
                <Footer ></Footer>
            </Layout>
        </Layout>
    )
}

const RoutedApp = () => (
    <ApplicationContextProvider><Router><App /></Router></ApplicationContextProvider>
)
export default RoutedApp;

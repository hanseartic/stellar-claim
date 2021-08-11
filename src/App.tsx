import react, {useEffect} from 'react';
import {BrowserRouter as Router, Link, Redirect, Route, Switch, useHistory,} from 'react-router-dom';
import './App.css';
import 'antd/dist/antd.css';
import {About, AccountOverview, ClaimBalances, Privacy} from './Pages';
import {ApplicationContextProvider} from './ApplicationContext';
import useApplicationState from './useApplicationState';
import {
    InfoCircleOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    SafetyOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
    faBroadcastTower,
    faHandHolding,
    faIdCard,
    faWallet,
} from '@fortawesome/free-solid-svg-icons';

import {Breadcrumb, Layout, Menu, Switch as ToggleSwitch} from 'antd';
import {AccountState} from "./AccountSelector";

const { Item: MenuItem, SubMenu } = Menu;
const { Content, Footer, Header, Sider } = Layout;


const App = () => {
    const { menuCollapsed, setMenuCollapsed, setUsePublicNetwork, usePublicNetwork } = useApplicationState();
    const collapseTrigger = react.createElement(
        menuCollapsed?MenuUnfoldOutlined:MenuFoldOutlined, {
            onClick: () => setMenuCollapsed(!menuCollapsed)
        });
    const history = useHistory();
    function goHome() {
        history.push("/account/");
    }
    const { accountInformation } = useApplicationState();
    useEffect(() => {
        if (history.location.pathname.startsWith('/claim/') || history.location.pathname.startsWith('/account/')) {
            let page = history.location.pathname.split('/')[1];
            if (accountInformation.state === AccountState.notSet) history.replace(`/${page}/`);
            if ([AccountState.valid].includes(accountInformation.state!)) history.replace(`/${page}/${accountInformation.account!.id}`);
        }
    }, [accountInformation, history]);
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
                <Menu forceSubMenuRender={true} theme="dark" mode="vertical" selectable={false}>
                    <SubMenu title="Stellar Account" key="account" icon={<FontAwesomeIcon icon={faWallet}/>} onTitleClick={goHome}>
                        <MenuItem title="Account overview" icon={<FontAwesomeIcon icon={faIdCard}/>}  key="account:overview">
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
                    </SubMenu>
                    <MenuItem title="About this page" key="about" icon={<InfoCircleOutlined />}>
                            <Link to="/about">About</Link>
                    </MenuItem>
                    <MenuItem title="Privacy information" key="privacy" icon={<SafetyOutlined />}>
                        <Link to="/privacy">Privacy</Link>
                    </MenuItem>
                </Menu>
            </Sider>
            <Layout style={{ marginLeft: menuCollapsed?80:200, transition: 'ease-in margin 0.2s'}}>
                <Header className="App-header">
                    <Breadcrumb />
                </Header>
                <Content className="App-content">
                    <Switch>
                        <Route path="/account/:account?"><AccountOverview /></Route>
                        <Route path="/about"><About /></Route>
                        <Route path="/privacy"><Privacy /></Route>
                        <Route path="/claim/:account?"><ClaimBalances /></Route>
                        <Redirect exact={true} from="/" to="/claim/" />
                    </Switch>
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

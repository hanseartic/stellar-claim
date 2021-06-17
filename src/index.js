'use strict';

import './main.css'
import './stellar_account.css';
import './header/header.css';
import './header/menu.css';
import './header/toggle_control.scss';
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@fortawesome/fontawesome-free/css/brands.min.css';
import 'tabulator-tables/dist/css/bootstrap/tabulator_bootstrap.min.css';
import './claimable_balances/claimable_balances.css';
// import './claimable_balances/submit_button.scss';
import './claimable_balances/spinner.scss';
import header from './header/'
import Account, { claimBalancesAction } from './stellar_account.js';
import ClaimableBalances from './claimable_balances';

const createMainDiv = () => {
    const main = document.createElement('div');
    main.id = 'main';
    return main;
};

const claimableBalances = new ClaimableBalances(!JSON.parse(localStorage.getItem('is-testnet')));

Account.addEventListener(
    'accountIDChanged',
    ({detail: accountId}) => claimableBalances.setAccountId(accountId)
);


// claimableBalances.getComponent().addEventListener(
//     'claimBalances',
//     ev => console.log(ev)
// );

document.body.append(...header);
const mainDiv = createMainDiv();
document.body.appendChild(mainDiv);
mainDiv.appendChild(Account);
mainDiv.appendChild(claimableBalances.getComponent());


document.getElementById('is-testnet-toggle').addEventListener(
    'change',
    (e) => {claimableBalances.usePublicNetwork(!e.target.checked); claimableBalances.updateClaimableBalances();}
);

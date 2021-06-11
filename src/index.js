import './main.css'
import header from './header.js'
import Account, {claimableBalancesComponent} from './account';
import ClaimableBalance from './claimable_balances'


let ready = (fn) => {
    if (document.readyState !== 'loading'){
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}


const createMainDiv = () => {
    const main = document.createElement('div');
    main.id = 'main';
    return main;
};


header(document.body);
const mainDiv = createMainDiv();
mainDiv.appendChild(Account);
mainDiv.appendChild(ClaimableBalance(Account));
document.body.appendChild(mainDiv);


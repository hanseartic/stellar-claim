import './main.css'
import header from './header.js'
import {accountComponent, claimableBalancesComponent} from "./account";


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
mainDiv.appendChild(accountComponent());
mainDiv.appendChild(claimableBalancesComponent());
document.body.appendChild(mainDiv);


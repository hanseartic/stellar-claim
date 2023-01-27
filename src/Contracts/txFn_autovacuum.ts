import {
    AccountResponse,
    BASE_FEE,
    Memo,
    Networks,
    Operation,
    Server,
    TransactionBuilder
} from 'stellar-sdk';
import BigNumber from "bignumber.js";

const server = new Server(HORIZON_URL);
const coordinatorAccount = STELLAR_NETWORK === "PUBLIC"
    ? "GBAFT2CRP7IAC4P5RMOAKFNJQAQK2UC337YY6MGXYZWX6RZDIX24DUST"
    : "GB7EAEFTVE3VKU6VMV5LEG3XO42GZJGW6Q653ULGJOH25QIEXUMA3A6B";
const dustbinKey = "app.lumens_space.dustbin.account";
const swapToAssetKey = "app.lumens_space.dustbin.swapto";
const txBaseFee = new BigNumber(BASE_FEE).times(10);
const txBuilderOptions = {fee: txBaseFee.toString(), networkPassphrase: Networks[STELLAR_NETWORK]};

export default async (body) => {
    const { task } = body;

    var txBuilder;
    switch (task) {
        case "init":
            const { account: initAccount, dustbin } = body;
            txBuilder = await server.loadAccount(initAccount).then(accountResponse => fnInit(accountResponse, dustbin));
            break;
        case "run":
            const { account: runAccount } = body;
            txBuilder = await server.loadAccount(runAccount).then(accountResponse => fnRun(accountResponse));
            break;
        case "stop":
            const { account: stopAccount } = body;
            txBuilder = await server.loadAccount(stopAccount).then(accountResponse => fnStop(accountResponse));
            break;
        default:
            throw {message: `task '${task}' unknown`}
    }

    return txBuilder
        .addMemo(Memo.text(`lumens.space ${task} autoclean`))
        .setTimeout(0).build().toXDR("base64");
};

const fnInit = async (account, dustbinAccount, targetCurrency) => {
    const dustbin = getDataEntry(account, dustbinKey);
    if (dustbin) {
        throw {message: "dustbin already configured"};
    }

    const txBuilder = new TransactionBuilder(account, {...txBuilderOptions, fee: txBaseFee.times(100).toString()})
        .addOperation(Operation.beginSponsoringFutureReserves({
            sponsoredId: dustbinAccount
        }))
        .addOperation(Operation.createAccount({
            startingBalance: "0",
            destination: dustbinAccount,
        }));

    const signerKeys = await getSigners();
    signerKeys.forEach(signerKey => {
        txBuilder.addOperation(Operation.setOptions({
            signer: {
                ed25519PublicKey: signerKey,
                weight: 1,
            },
            source: dustbinAccount,
        }));
    })

    txBuilder
        .addOperation(Operation.setOptions({
            masterWeight: 0,
            highThreshold: signerKeys.length,
            lowThreshold: signerKeys.length,
            medThreshold: signerKeys.length,
            source: dustbinAccount,
        }))
        .addOperation(Operation.endSponsoringFutureReserves({
            source: dustbinAccount,
        }))
        .addOperation(Operation.manageData({
            name: dustbinKey,
            value: dustbinAccount,
        }));

    return txBuilder;
};

const fnRun = async (account) => {
    const dustbinAccount = await getDustbinAccount(account);

    const claimableBalances = await server.claimableBalances()
        .claimant(account.accountId())
        .limit(25);

    const txBuilder = new TransactionBuilder(account, txBuilderOptions)
        .addOperation(Operation.beginSponsoringFutureReserves({
            sponsoredId: dustbinAccount.accountId(),
        }));

    txBuilder
        .addOperation(Operation.endSponsoringFutureReserves({
            source: dustbinAccount.accountId(),
        }));

    return txBuilder;
};

const fnStop = async (account) => {
    const dustbinAccount = await getDustbinAccount(account.data_attr);

    return new TransactionBuilder(account, {...txBuilderOptions, fee: txBaseFee.times(100).toString()})
        .addOperation(Operation.manageData({
            name: dustbinKey,
            value: null,
        }))
        .addOperation(Operation.accountMerge({
            source: dustbinAccount.accountId(),
            destination: account.accountId(),
        }));
};

const getSigners = () => {
    return server.loadAccount(coordinatorAccount)
        .then(account => {
            const signerKeys = account.signers
                .filter(signer => signer.key !== account.id && signer.type === "ed25519_public_key")
                .map(signer => signer.key);
            if (signerKeys.length === 0) {
                throw {message: "no signers configured."}
            }

            return signerKeys;
        });
};

const getDustbinAccount = (account) => {
    const dustbinAccount = getDataEntry(account, dustbinKey);
    try {
        return server.loadAccount(dustbinAccount);
    } catch {
        throw {message: `could not find dustbin account ${dustbinAccount}`};
    }
};

const getDataEntry = (account, entryName) => {
    let data = account.data_attr[entryName];
    if (!data) { return null; }

    return Buffer.from(data, "base64").toString("utf-8");
};

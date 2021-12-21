import useApplicationState from "./useApplicationState";
import {
    AccountResponse,
    Asset, FeeBumpTransaction,
    Operation,
    Server,
    ServerApi,
    StellarTomlResolver,
    Transaction,
    Utils,
    xdr
} from "stellar-sdk";
import memoize from 'memoizee';
import assert from "assert";
import {BigNumber} from "bignumber.js";

const horizonUrls = {
    PUBLIC: 'https://horizon.stellar.org/',
    TESTNET: 'https://horizon-testnet.stellar.org/',
};

const stellarExpertUrls = {
    PUBLIC: 'https://stellar.expert/explorer/public/',
    TESTNET: 'https://stellar.expert/explorer/testnet/',
};

type knownNetworks = 'PUBLIC'|'TESTNET';

const serverUrl = (base: string, path?: string): URL => {
    return new URL(path??'', new URL(base));
};

export const cachedFetch = memoize(
    (input:string|Request, init?:RequestInit) => fetch(input, init),
    {promise: true});
export const cachedFetchJson = memoize(
    (input:string|Request, init?:RequestInit) => fetch(input, init).then(r => r.json()),
    {promise: true});
const cachedResolveToml = memoize(StellarTomlResolver.resolve, {promise: true});

const getTomlAssetInformation = async (url: (path: string) => URL, asset: Asset): Promise<TomlAssetInformation> => {
    if (asset.isNative()) return Promise.reject<NoTomlInformation>({reason: 'native', code: asset.getCode()});

    const knownDomains = {
        'GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M': 'velo.org',
        'GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S': 'k.tempocrypto.com'
    };

    const overrideHomeDomain = (id: string): {home_domain?: string} => {
        return knownDomains[id as keyof{}] ? {home_domain: knownDomains[id as keyof{}]} : {};
    }

    return {
        ...await cachedFetchJson(url('/accounts/' + asset.getIssuer()).href)
            .then((json: any) => ({...json, ...overrideHomeDomain(json.id)}))
            .then((json: any) => (!json.home_domain)
                ? Promise.reject(`No home domain set for ${asset}.`)
                : json.home_domain.replace(/^(http)s?:\/\/|\/$/g, '')
            )
            .then(home_domain => cachedResolveToml(home_domain)
                .then((toml: { CURRENCIES?: TomlAssetInformation[] }) => (toml.CURRENCIES ?? [])
                        .find(c => c.issuer === asset.getIssuer() && c.code === asset.getCode())
                    ?? Promise.reject(`No TOML information found for ${asset} on ${home_domain}`)
                )
                .then(p => ({...p, domain: home_domain}))
            )
            .catch((reason: any) => {
                console.warn(reason);
            })
    };
};

type OperationThresholds<OT extends string = never, AT extends string = never> = {
    [key in OT]: {
        operations: string[];
        accountThreshold: AT;
    }
};
type KnownOperationThresholds = 'thresholdLow' | 'thresholdMed' | 'thresholdHigh';
type KnownAccountThresholds = 'low_threshold' | 'med_threshold' | 'high_threshold';
const operationThresholds: OperationThresholds<KnownOperationThresholds, KnownAccountThresholds> = {
    thresholdLow: {
        operations: [
            'claimClaimableBalance',
        ],
        accountThreshold: 'low_threshold',
    },
    thresholdMed: {
        operations: [
            'changeTrust',
        ],
        accountThreshold: 'med_threshold',
    },
    thresholdHigh: {
        operations: [
            'accountMerge',
        ],
        accountThreshold: 'high_threshold',
    },
};

export const reasonIsSignatureWeightInsufficient = (reason: object): reason is SignatureWeightInsufficient => {
    return typeof reason === 'object' && 'signaturesWeight' in reason && 'requiredThreshold' in reason;
}

export interface SignatureWeightInsufficient {
    signaturesWeight: number;
    requiredThreshold: number;
    xdr: string;
}
export interface TomlAssetInformation {
    code?: string;
    image?: string;
    issuer?: string;
    name?: string;
    desc?: string;
    domain?: string;
}
export interface NoTomlInformation {
    reason: string,
    code: string,
}

export const shortAddress = (asset: string, shortenTo: number) => {
    if (shortenTo + 1 >= asset.length) return asset;
    return asset.slice(0, Math.floor(shortenTo/2)) + '…' + asset.slice(-Math.ceil(shortenTo/2));
};

export const getStellarAsset = (code: string) => {
    const [assetCode, assetIssuer] = code.split(':')
    return assetCode==='native'
        ? Asset.native()
        : new Asset(assetCode, assetIssuer);
};

export const getTxSignaturesWeight = (signedTransaction: Transaction, accountSigners: ServerApi.AccountRecordSigners[]): number => {
    const txSigners = Utils.gatherTxSigners(
        signedTransaction,
        accountSigners.filter(({type}) => type === 'ed25519_public_key').map(({key}) => key));

    return accountSigners
        .filter(as => txSigners.includes(as.key))
        .map(({weight}) => weight)
        .reduce((c, p) => c+p, 0);
};

export const operationToThreshold = (operation: Operation): xdr.ThresholdIndices => {
    if (operationThresholds.thresholdLow?.operations.includes(operation.type))
        return xdr.ThresholdIndices.thresholdLow();
    if (operationThresholds.thresholdMed?.operations.includes(operation.type))
        return xdr.ThresholdIndices.thresholdMed();
    if (operationThresholds.thresholdHigh?.operations.includes(operation.type))
        return xdr.ThresholdIndices.thresholdHigh();
    return xdr.ThresholdIndices.thresholdMed();
}

export const verifyTransactionSignaturesForAccount = <T extends FeeBumpTransaction|Transaction>(signedTx: T, account: AccountResponse) => {
    assert(signedTx instanceof Transaction);

    const txSignaturesWeight = getTxSignaturesWeight(signedTx, account.signers);
    const requiredOperationThresholds = signedTx.operations
        .map(operationToThreshold)
        .filter((v, i, l) => l.indexOf(v) === i)
        .map(thresholdIndices => {
            assert(thresholdIndices.name !== 'thresholdMasterWeight');
            return account.thresholds[operationThresholds[thresholdIndices.name].accountThreshold];
        })
        .reduce((previousValue, currentValue) => Math.max(previousValue, currentValue), 0)
    ;

    return new Promise((y: (v: Transaction) => void, n: (r: SignatureWeightInsufficient) => void) => {
        if (txSignaturesWeight === 0 || txSignaturesWeight < requiredOperationThresholds) {
            n({signaturesWeight: txSignaturesWeight, requiredThreshold: requiredOperationThresholds, xdr: signedTx.toXDR()});
        } else {
            y(signedTx);
        }
    })
};

const assetIsStroopsAsset = async (network: knownNetworks, asset: string): Promise<boolean> => {
    if (asset === 'native:XLM') {
        return false;
    }
    const showAsStroopKey = 'showAsStroops.' + network;
    const showAsStroops: () => {[key: string]: boolean} = () => {
        return JSON.parse(localStorage.getItem(showAsStroopKey)??"{}");
    };

    if (Object.keys(showAsStroops()).includes(asset)) {
        return showAsStroops()[asset];
    } else {
        const sAsset = getStellarAsset(asset);
        return new Server(horizonUrls[network]).assets()
            .forCode(sAsset.getCode()).forIssuer(sAsset.getIssuer())
            .call()
            .then(({records}) => records.pop())
            .then(assetRecord => {
                const currentAssetAsStroops: {[key: string]: boolean} = JSON.parse(`{"${asset}": false}`);
                if (assetRecord) {
                    currentAssetAsStroops[asset] = Object.values(assetRecord.balances)
                        .map(b => new BigNumber(b))
                        .reduce((c, p) => p.plus(c), new BigNumber("0"))
                        .lt(1);
                }
                localStorage.setItem(showAsStroopKey, JSON.stringify({...showAsStroops(),  ...currentAssetAsStroops}));
                return currentAssetAsStroops[asset];
            })
            .catch(() => false);
    }
};

const StellarHelpers = () => {
    const {usePublicNetwork} = useApplicationState();

    const getSelectedNetwork = () => usePublicNetwork?'PUBLIC':'TESTNET';

    const expertUrl = (path?: string) => serverUrl(stellarExpertUrls[getSelectedNetwork()], path);
    const horizonUrl = (path?: string) => serverUrl(horizonUrls[getSelectedNetwork()], path);

    return {
        expertUrl: expertUrl,
        horizonUrl: horizonUrl,
        getSelectedNetwork,
        tomlAssetInformation: (asset: Asset) => getTomlAssetInformation(horizonUrl, asset),
        assetIsStroopsAsset: (asset: string) => assetIsStroopsAsset(getSelectedNetwork(), asset),
    };
};
export default StellarHelpers;

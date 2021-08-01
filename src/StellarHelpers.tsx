import useApplicationState from "./useApplicationState";
import {
    AccountResponse,
    Asset, FeeBumpTransaction,
    Operation,
    ServerApi,
    StellarTomlResolver,
    Transaction,
    Utils,
    xdr
} from "stellar-sdk";
import memoize from 'memoizee';
import assert from "assert";

const horizonUrls = {
    PUBLIC: 'https://horizon.stellar.org/',
    TESTNET: 'https://horizon-testnet.stellar.org/',
};

const stellarExpertUrls = {
    PUBLIC: 'https://stellar.expert/explorer/public/',
    TESTNET: 'https://stellar.expert/explorer/testnet/',
};

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

    return {
        ...await cachedFetchJson(url('/accounts/' + asset.getIssuer()).href)
            .then((json: any) => (!json.home_domain)
                ? Promise.reject(`No home domain set for ${asset}.`)
                : json.home_domain
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
            n({signaturesWeight: txSignaturesWeight, requiredThreshold: requiredOperationThresholds} as SignatureWeightInsufficient);
        } else {
            y(signedTx);
        }
    })
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
    };
};
export default StellarHelpers;

import { workerLog } from './logger';
import { Wallet, EventTargetImpl, helper, pugdagcore, CONFIRMATION_COUNT, COINBASE_CFM_COUNT } from '@pugdag/wallet';
export { workerLog, CONFIRMATION_COUNT, COINBASE_CFM_COUNT };
import { CBItem } from './rpc';
export declare const initPugdagFramework: (opt?: {
    workerPath?: string;
}) => Promise<void>;
import { NetworkOptions, TxSend, TxResp, WalletCache, IRPC, WalletOptions, TxInfo, TxCompoundOptions, ScaneMoreResult } from '@pugdag/wallet/types/custom-types';
declare class WalletWrapper extends EventTargetImpl {
    static networkTypes: Object;
    static KLS: typeof Wallet.KLS;
    static networkAliases: Object;
    static Mnemonic: any;
    static Crypto: typeof import("@pugdag/wallet/dist/wallet/crypto").Crypto;
    static checkPasswordValidity(password: string, encryptedMnemonic: string): Promise<boolean>;
    static setWorkerLogLevel(level: string): Promise<void>;
    static postMessage(op: string, data: any): Promise<void>;
    static fromMnemonic(seedPhrase: string, networkOptions: NetworkOptions, options?: WalletOptions): WalletWrapper;
    /**
     * Creates a new Wallet from encrypted wallet data.
     * @param password the password the user encrypted their seed phrase with
     * @param encryptedMnemonic the encrypted seed phrase from local storage
     * @throws Will throw "Incorrect password" if password is wrong
     */
    static import(password: string, encryptedMnemonic: string, networkOptions: NetworkOptions, options?: WalletOptions): Promise<WalletWrapper>;
    worker: Worker;
    isWorkerReady: boolean;
    rpc: IRPC | undefined;
    _pendingCB: Map<string, CBItem>;
    syncSignal: helper.DeferredPromise | undefined;
    grpcFlagsSyncSignal: helper.DeferredPromise | undefined;
    workerReady: helper.DeferredPromise;
    balance: {
        available: number;
        pending: number;
        total: number;
    };
    _rid2subUid: Map<string, string>;
    uid: string;
    HDWallet: pugdagcore.HDPrivateKey;
    grpcFlags: {
        utxoIndex?: Boolean;
    };
    constructor(privKey: string, seedPhrase: string, networkOptions: NetworkOptions, options?: WalletOptions);
    checkGRPCFlags(): void;
    createUID(network: string): string;
    initWallet(privKey: string, seedPhrase: string, networkOptions: NetworkOptions, options?: WalletOptions): Promise<void>;
    initWorker(): void;
    handleProperty(msg: {
        name: string;
        value: any;
    }): void;
    handleEvents(msg: {
        name: string;
        data: any;
    }): void;
    handleResponse(msg: {
        rid: string;
        error?: any;
        result?: any;
    }): Promise<void>;
    handleRPCRequest(msg: {
        fn: string;
        args: any;
        rid?: string;
    }): Promise<void>;
    postMessage(op: string, data: any): void;
    request(fn: string, args: any[], callback?: Function | undefined): Promise<void>;
    requestPromisify<T>(fn: string, ...args: any[]): Promise<T>;
    createPendingCall(cb: Function): string;
    sync(syncOnce?: boolean | undefined): Promise<any>;
    setLogLevel(level: string): void;
    startUTXOsPolling(): void;
    get(name: string, waitForSync?: boolean): Promise<unknown>;
    getAfterSync(name: string): Promise<unknown>;
    get mnemonic(): Promise<unknown>;
    get receiveAddress(): Promise<unknown>;
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. pugdagtest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KLS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    submitTransaction(txParamsArg: TxSend, debug?: boolean): Promise<TxResp | null>;
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. pugdagtest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KLS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    estimateTransaction(txParamsArg: TxSend): Promise<TxInfo>;
    /**
     * Update transcations time
     */
    startUpdatingTransactions(version?: undefined | number): Promise<boolean>;
    /**
    * Compound UTXOs by re-sending funds to itself
    */
    compoundUTXOs(txCompoundOptions?: TxCompoundOptions, debug?: boolean): Promise<TxResp | null>;
    scanMoreAddresses(count?: number, debug?: boolean, receiveStart?: number, changeStart?: number): Promise<ScaneMoreResult | null>;
    /**
     * Generates encrypted wallet data.
     * @param password user's chosen password
     * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
     */
    export(password: string): Promise<string>;
    restoreCache(cache: WalletCache): void;
    clearUsedUTXOs(): void;
}
export { WalletWrapper };
//# sourceMappingURL=wallet-wrapper.d.ts.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = exports.COINBASE_CFM_COUNT = exports.CONFIRMATION_COUNT = exports.COMPOUND_UTXO_MAX_COUNT = exports.pugdagcore = void 0;
const Mnemonic = require('bitcore-mnemonic');
const pugdagcore = __importStar(require("../../../core-lib"));
exports.pugdagcore = pugdagcore;
const helper = __importStar(require("../utils/helper"));
__exportStar(require("./storage"), exports);
__exportStar(require("./error"), exports);
const crypto_1 = require("./crypto");
const PUG = helper.PUG;
const logger_1 = require("../utils/logger");
const address_manager_1 = require("./address-manager");
const utxo_1 = require("./utxo");
Object.defineProperty(exports, "CONFIRMATION_COUNT", { enumerable: true, get: function () { return utxo_1.CONFIRMATION_COUNT; } });
Object.defineProperty(exports, "COINBASE_CFM_COUNT", { enumerable: true, get: function () { return utxo_1.COINBASE_CFM_COUNT; } });
const tx_store_1 = require("./tx-store");
const cache_store_1 = require("./cache-store");
const api_1 = require("./api");
const config_json_1 = require("../config.json");
const event_target_impl_1 = require("./event-target-impl");
const BALANCE_CONFIRMED = Symbol();
const BALANCE_PENDING = Symbol();
const BALANCE_TOTAL = Symbol();
const COMPOUND_UTXO_MAX_COUNT = 500;
exports.COMPOUND_UTXO_MAX_COUNT = COMPOUND_UTXO_MAX_COUNT;
const SompiPerPugdag = 100000000;
// MaxSompi is the maximum transaction amount allowed in sompi.
const MaxSompi = 21000000 * SompiPerPugdag;
/** Class representing an HDWallet with derivable child addresses */
class Wallet extends event_target_impl_1.EventTargetImpl {
    static PUG(v) {
        return PUG(v);
    }
    static initRuntime() {
        return pugdagcore.initRuntime();
    }
    /**
     * Converts a mnemonic to a new wallet.
     * @param seedPhrase The 12 word seed phrase.
     * @returns new Wallet
     */
    static fromMnemonic(seedPhrase, networkOptions, options = {}) {
        if (!networkOptions || !networkOptions.network)
            throw new Error(`fromMnemonic(seedPhrase,networkOptions): missing network argument`);
        const privKey = new Mnemonic(seedPhrase.trim()).toHDPrivateKey().toString();
        const wallet = new this(privKey, seedPhrase, networkOptions, options);
        return wallet;
    }
    /**
     * Creates a new Wallet from encrypted wallet data.
     * @param password the password the user encrypted their seed phrase with
     * @param encryptedMnemonic the encrypted seed phrase from local storage
     * @throws Will throw "Incorrect password" if password is wrong
     */
    static import(password, encryptedMnemonic, networkOptions, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const decrypted = yield crypto_1.Crypto.decrypt(password, encryptedMnemonic);
            const savedWallet = JSON.parse(decrypted);
            const myWallet = new this(savedWallet.privKey, savedWallet.seedPhrase, networkOptions, options);
            return myWallet;
        });
    }
    get balance() {
        return {
            available: this[BALANCE_CONFIRMED],
            pending: this[BALANCE_PENDING],
            total: this[BALANCE_CONFIRMED] + this[BALANCE_PENDING]
        };
    }
    /**
     * Set by addressManager
     */
    get receiveAddress() {
        return this.addressManager.receiveAddress.current.address;
    }
    get changeAddress() {
        return this.addressManager.changeAddress.current.address;
    }
    /** Create a wallet.
     * @param walletSave (optional)
     * @param walletSave.privKey Saved wallet's private key.
     * @param walletSave.seedPhrase Saved wallet's seed phrase.
     */
    constructor(privKey, seedPhrase, networkOptions, options = {}) {
        super();
        this.disableBalanceNotifications = false;
        /**
         * Current network.
         */
        this.network = 'pugdag';
        /**
         * Default fee
         */
        this.defaultFee = 1; //per byte
        this.subnetworkId = "0000000000000000000000000000000000000000"; //hex string
        this.last_tx_ = '';
        /**
         * Current API endpoint for selected network
         */
        this.apiEndpoint = 'localhost:33455';
        this.blueScore = -1;
        this.syncVirtualSelectedParentBlueScoreStarted = false;
        this.syncInProggress = false;
        /* eslint-disable */
        this.pendingInfo = {
            transactions: {},
            get amount() {
                const transactions = Object.values(this.transactions);
                if (transactions.length === 0)
                    return 0;
                return transactions.reduce((prev, cur) => prev + cur.amount + cur.fee, 0);
            },
            add(id, tx) {
                this.transactions[id] = tx;
            }
        };
        /**
         * Transactions sorted by hash.
         */
        this.transactions = {};
        /**
         * Transaction arrays keyed by address.
         */
        this.transactionsStorage = {};
        this[_a] = 0;
        this[_b] = 0;
        this[_c] = 0;
        /**
         * Emit wallet balance.
         */
        this.lastBalanceNotification = { available: 0, pending: 0 };
        this.debugInfo = { inUseUTXOs: { satoshis: 0, count: 0 } };
        this.lastAddressNotification = {};
        //UTXOsPollingStarted:boolean = false;
        this.emitedUTXOs = new Set();
        this.loggerLevel = 0;
        this.logger = (0, logger_1.CreateLogger)('PugdagWallet');
        this.api = new api_1.PugdagAPI();
        //@ts-ignore
        //postMessage({error:new ApiError("test") })
        let defaultOpt = {
            skipSyncBalance: false,
            syncOnce: false,
            addressDiscoveryExtent: 150,
            logLevel: 'info',
            disableAddressDerivation: false,
            checkGRPCFlags: false,
            minimumRelayTransactionFee: 1000,
            updateTxTimes: true
        };
        // console.log("CREATING WALLET FOR NETWORK", this.network);
        this.options = Object.assign(Object.assign({}, defaultOpt), options);
        //this.options.addressDiscoveryExtent = 500;
        this.setLogLevel(this.options.logLevel);
        this.network = networkOptions.network;
        this.defaultFee = networkOptions.defaultFee || this.defaultFee;
        if (networkOptions.rpc)
            this.api.setRPC(networkOptions.rpc);
        if (privKey && seedPhrase) {
            this.HDWallet = new pugdagcore.HDPrivateKey(privKey);
            this.mnemonic = seedPhrase;
        }
        else {
            const temp = new Mnemonic(Mnemonic.Words.ENGLISH);
            this.mnemonic = temp.toString();
            this.HDWallet = new pugdagcore.HDPrivateKey(temp.toHDPrivateKey().toString());
        }
        this.uid = this.createUID();
        this.utxoSet = new utxo_1.UtxoSet(this);
        this.txStore = new tx_store_1.TXStore(this);
        this.cacheStore = new cache_store_1.CacheStore(this);
        //this.utxoSet.on("balance-update", this.updateBalance.bind(this));
        this.addressManager = new address_manager_1.AddressManager(this.HDWallet, this.network);
        if (this.options.disableAddressDerivation)
            this.addressManager.receiveAddress.next();
        //this.initAddressManager();
        //this.sync(this.options.syncOnce);
        this.connectSignal = helper.Deferred();
        this.api.on("connect", () => {
            this.onApiConnect();
        });
        this.api.on("disconnect", () => {
            this.onApiDisconnect();
        });
    }
    createUID() {
        const { privateKey } = this.HDWallet.deriveChild(`m/44'/972/0'/1'/0'`);
        let address = privateKey.toAddress(this.network).toString().split(":")[1];
        return helper.createHash(address);
    }
    onApiConnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connectSignal.resolve();
            let { connected } = this;
            this.connected = true;
            this.logger.info("gRPC connected");
            this.emit("api-connect");
            if (this.syncSignal && connected !== undefined) { //if sync was called
                this.logger.info("starting wallet re-sync ...");
                yield this.sync(this.syncOnce);
            }
        });
    }
    onApiDisconnect() {
        this.connected = false;
        this.syncVirtualSelectedParentBlueScoreStarted = false;
        this.logger.verbose("gRPC disconnected");
        this.emit("api-disconnect");
    }
    update(syncOnce = true) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sync(syncOnce);
        });
    }
    waitOrSync() {
        if (this.syncSignal)
            return this.syncSignal;
        return this.sync();
    }
    sync(syncOnce = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            this.syncSignal = helper.Deferred();
            yield this.connectSignal;
            if (syncOnce === undefined)
                syncOnce = this.options.syncOnce;
            syncOnce = !!syncOnce;
            this.syncInProggress = true;
            this.emit("sync-start");
            yield this.txStore.restore();
            yield this.cacheStore.restore();
            const ts0 = Date.now();
            this.logger.info(`sync ... starting wallet sync`); // ${syncOnce?'(monitoring disabled)':''}`);
            //this.logger.info(`sync ............ started, syncOnce:${syncOnce}`)
            //if last time syncOnce was OFF we have subscriptions to utxo-change
            if (this.syncOnce === false && syncOnce) {
                throw new Error("Wallet sync process already running.");
            }
            this.syncOnce = syncOnce;
            this.initAddressManager();
            yield this.initBlueScoreSync(syncOnce)
                .catch(e => {
                this.logger.info("syncVirtualSelectedParentBlueScore:error", e);
            });
            if (this.options.disableAddressDerivation) {
                this.logger.warn('sync ... running with address discovery disabled');
                this.utxoSet.syncAddressesUtxos([this.receiveAddress]);
            }
            else {
                yield this.addressDiscovery(this.options.addressDiscoveryExtent)
                    .catch(e => {
                    this.logger.info("addressDiscovery:error", e);
                });
            }
            this.syncInProggress = false;
            if (!syncOnce)
                yield this.utxoSet.utxoSubscribe();
            const ts1 = Date.now();
            const delta = ((ts1 - ts0) / 1000).toFixed(1);
            this.logger.info(`sync ... ${this.utxoSet.count} UTXO entries found`);
            this.logger.info(`sync ... indexed ${this.addressManager.receiveAddress.counter} receive and ${this.addressManager.changeAddress.counter} change addresses`);
            this.logger.info(`sync ... finished (sync done in ${delta} seconds)`);
            this.emit("sync-finish");
            const { available, pending, total } = this.balance;
            this.emit("ready", {
                available, pending, total,
                confirmedUtxosCount: this.utxoSet.confirmedCount
            });
            this.emitBalance();
            this.emitAddress();
            this.txStore.emitTxs();
            this.syncSignal.resolve();
            if (!this.utxoSet.clearMissing())
                this.updateDebugInfo();
        });
    }
    getVirtualSelectedParentBlueScore() {
        return this.api.getVirtualSelectedParentBlueScore();
    }
    getVirtualDaaScore() {
        return this.api.getVirtualDaaScore();
    }
    initBlueScoreSync(once = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.syncVirtualSelectedParentBlueScoreStarted)
                return;
            this.syncVirtualSelectedParentBlueScoreStarted = true;
            let r = yield this.getVirtualDaaScore();
            let { virtualDaaScore: blueScore } = r;
            console.log("getVirtualSelectedParentBlueScore :result", r);
            this.blueScore = blueScore;
            this.emit("blue-score-changed", { blueScore });
            this.utxoSet.updateUtxoBalance();
            if (once) {
                this.syncVirtualSelectedParentBlueScoreStarted = false;
                return;
            }
            this.api.subscribeVirtualDaaScoreChanged((result) => {
                let { virtualDaaScore } = result;
                //console.log("subscribeVirtualSelectedParentBlueScoreChanged:result", result)
                this.blueScore = virtualDaaScore;
                this.emit("blue-score-changed", {
                    blueScore: virtualDaaScore
                });
                this.utxoSet.updateUtxoBalance();
            }).then(r => {
                console.log("subscribeVirtualDaaScoreChanged:responce", r);
            }, e => {
                console.log("subscribeVirtualDaaScoreChanged:error", e);
            });
        });
    }
    initAddressManager() {
        if (this.addressManagerInitialized)
            return;
        this.addressManagerInitialized = true;
        this.addressManager.on("new-address", detail => {
            if (!this.syncInProggress) {
                this.emitAddress();
            }
            //console.log("new-address", detail)
            if (this.options.skipSyncBalance)
                return;
            //console.log("new-address:detail", detail)
            const { address, type } = detail;
            this.utxoSet.syncAddressesUtxos([address]);
        });
        if (!this.receiveAddress) {
            this.addressManager.receiveAddress.next();
        }
    }
    startUpdatingTransactions(version = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.txStore.startUpdatingTransactions(version);
        });
    }
    /**
     * Set rpc provider
     * @param rpc
     */
    setRPC(rpc) {
        this.api.setRPC(rpc);
    }
    /*
    setStorageType(type:StorageType){
        this.storage.setType(type);
    }
    setStorageFolder(folder:string){
        this.storage.setFolder(folder);
    }
    setStorageFileName(fileName:string){
        this.storage.setFileName(fileName);
    }
    */
    /*
    _storage: typeof storageClasses.Storage|undefined;

    setStoragePassword(password: string) {
        if (!this.storage)
            throw new Error("Please init storage")
        this.storage.setPassword(password);
    }
    get storage(): typeof storageClasses.Storage | undefined {
        return this._storage;
    }

    openFileStorage(fileName: string, password: string, folder: string = '') {
        let storage = CreateStorage();
        if (folder)
            storage.setFolder(folder);
        storage.setFileName(fileName);
        storage.setPassword(password);
        this._storage = storage;
    }
    */
    /**
     * Queries API for address[] UTXOs. Adds tx to transactions storage. Also sorts the entire transaction set.
     * @param addresses
     */
    findUtxos(addresses, debug = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose(`scanning UTXO entries for ${addresses.length} addresses`);
            const utxosMap = yield this.api.getUtxosByAddresses(addresses);
            const addressesWithUTXOs = [];
            const txID2Info = new Map();
            if (debug) {
                utxosMap.forEach((utxos, address) => {
                    // utxos.sort((b, a)=> a.index-b.index)
                    utxos.map(t => {
                        let info = txID2Info.get(t.transactionId);
                        if (!info) {
                            info = {
                                utxos: [],
                                address
                            };
                            txID2Info.set(t.transactionId, info);
                        }
                        info.utxos.push(t);
                    });
                });
            }
            utxosMap.forEach((utxos, address) => {
                // utxos.sort((b, a)=> a.index-b.index)
                this.logger.verbose(`${address} - ${utxos.length} UTXO entries found`);
                if (utxos.length !== 0) {
                    this.disableBalanceNotifications = true;
                    this.utxoSet.utxoStorage[address] = utxos;
                    this.utxoSet.add(utxos, address);
                    addressesWithUTXOs.push(address);
                    this.disableBalanceNotifications = false;
                    this.emitBalance();
                }
            });
            const isActivityOnReceiveAddr = this.utxoSet.utxoStorage[this.receiveAddress] !== undefined;
            if (isActivityOnReceiveAddr) {
                this.addressManager.receiveAddress.next();
            }
            return {
                addressesWithUTXOs,
                txID2Info
            };
        });
    }
    adjustBalance(isConfirmed, amount, notify = true) {
        const { available, pending } = this.balance;
        if (isConfirmed) {
            this[BALANCE_CONFIRMED] += amount;
        }
        else {
            this[BALANCE_PENDING] += amount;
        }
        this[BALANCE_TOTAL] = this[BALANCE_CONFIRMED] + this[BALANCE_PENDING];
        if (notify === false)
            return;
        const { available: _available, pending: _pending } = this.balance;
        if (!this.syncInProggress && !this.disableBalanceNotifications && (available != _available || pending != _pending))
            this.emitBalance();
    }
    emitBalance() {
        const { available, pending, total } = this.balance;
        const { available: _available, pending: _pending } = this.lastBalanceNotification;
        if (available == _available && pending == _pending)
            return;
        this.lastBalanceNotification = { available, pending };
        this.logger.debug(`balance available: ${available} pending: ${pending}`);
        this.emit("balance-update", {
            available,
            pending,
            total,
            confirmedUtxosCount: this.utxoSet.confirmedCount
        });
    }
    updateDebugInfo() {
        let inUseUTXOs = { satoshis: 0, count: 0 };
        let { confirmed, pending, used } = this.utxoSet.utxos || {};
        this.utxoSet.inUse.map(utxoId => {
            var _d, _e, _f;
            inUseUTXOs.satoshis += ((_d = confirmed.get(utxoId)) === null || _d === void 0 ? void 0 : _d.satoshis) ||
                ((_e = pending.get(utxoId)) === null || _e === void 0 ? void 0 : _e.satoshis) ||
                ((_f = used.get(utxoId)) === null || _f === void 0 ? void 0 : _f.satoshis) || 0;
        });
        inUseUTXOs.count = this.utxoSet.inUse.length;
        this.debugInfo = { inUseUTXOs };
        this.emit("debug-info", { debugInfo: this.debugInfo });
    }
    clearUsedUTXOs() {
        this.utxoSet.clearUsed();
    }
    emitCache() {
        let { cache } = this;
        this.emit("state-update", { cache });
    }
    emitAddress() {
        const receive = this.receiveAddress;
        const change = this.changeAddress;
        let { receive: _receive, change: _change } = this.lastAddressNotification;
        if (receive == _receive && change == _change)
            return;
        this.lastAddressNotification = { receive, change };
        this.emit("new-address", {
            receive, change
        });
    }
    /**
     * Updates the selected network
     * @param network name of the network
     */
    updateNetwork(network) {
        return __awaiter(this, void 0, void 0, function* () {
            this.demolishWalletState(network.prefix);
            this.network = network.prefix;
            this.apiEndpoint = network.apiBaseUrl;
        });
    }
    demolishWalletState(networkPrefix = this.network) {
        this.utxoSet.clear();
        this.addressManager = new address_manager_1.AddressManager(this.HDWallet, networkPrefix);
        //this.pendingInfo.transactions = {};
        this.transactions = {};
        this.transactionsStorage = {};
    }
    scanMoreAddresses(count = 100, debug = false, receiveStart = -1, changeStart = -1) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.syncInProggress)
                return { error: "Sync in progress", code: "SYNC-IN-PROGRESS" };
            if (receiveStart < 0)
                receiveStart = this.addressManager.receiveAddress.counter;
            if (changeStart < 0)
                changeStart = this.addressManager.changeAddress.counter;
            this.syncInProggress = true;
            this.emit("scan-more-addresses-started", { receiveStart, changeStart });
            let error = false;
            let res = yield this.addressDiscovery(this.options.addressDiscoveryExtent, debug, receiveStart, changeStart, count)
                .catch(e => {
                this.logger.info("addressDiscovery:error", e);
                error = e;
            });
            this.syncInProggress = false;
            if (!this.syncOnce)
                this.utxoSet.utxoSubscribe();
            this.emit("scan-more-addresses-ended", { error });
            if (error)
                return { error, code: "ADDRESS-DISCOVERY" };
            let { highestIndex = null, endPoints = null } = res || {};
            this.logger.info("scanMoreAddresses:highestIndex", highestIndex);
            this.logger.info("scanMoreAddresses:endPoints", endPoints);
            this.emit("scan-more-addresses-ended", {
                receiveFinal: this.addressManager.receiveAddress.counter - 1,
                changeFinal: this.addressManager.changeAddress.counter - 1
            });
            return {
                code: "SUCCESS",
                receive: {
                    start: receiveStart,
                    end: (endPoints === null || endPoints === void 0 ? void 0 : endPoints.receive) || receiveStart + count,
                    final: this.addressManager.receiveAddress.counter - 1
                },
                change: {
                    start: changeStart,
                    end: (endPoints === null || endPoints === void 0 ? void 0 : endPoints.change) || changeStart + count,
                    final: this.addressManager.changeAddress.counter - 1
                }
            };
        });
    }
    /**
     * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
     * @param threshold stop discovering after `threshold` addresses with no activity
     */
    addressDiscovery(threshold = 64, debug = false, receiveStart = 0, changeStart = 0, count = 0) {
        var _d;
        return __awaiter(this, void 0, void 0, function* () {
            let addressList = [];
            let debugInfo = null;
            this.logger.info(`sync ... running address discovery, threshold:${threshold}`);
            const cacheIndexes = (_d = this.cacheStore.getAddressIndexes()) !== null && _d !== void 0 ? _d : { receive: 0, change: 0 };
            this.logger.info(`sync ...cacheIndexes: receive:${cacheIndexes.receive}, change:${cacheIndexes.change}`);
            let highestIndex = {
                receive: this.addressManager.receiveAddress.counter - 1,
                change: this.addressManager.changeAddress.counter - 1
            };
            let endPoints = {
                receive: 0,
                change: 0
            };
            let maxOffset = {
                receive: receiveStart + count,
                change: changeStart + count
            };
            const doDiscovery = (n, deriveType, offset) => __awaiter(this, void 0, void 0, function* () {
                this.logger.info(`sync ... scanning ${offset} - ${offset + n} ${deriveType} addresses`);
                this.emit("sync-progress", {
                    start: offset,
                    end: offset + n,
                    addressType: deriveType
                });
                const derivedAddresses = this.addressManager.getAddresses(n, deriveType, offset);
                const addresses = derivedAddresses.map((obj) => obj.address);
                addressList = [...addressList, ...addresses];
                this.logger.verbose(`${deriveType}: address data for derived indices ${derivedAddresses[0].index}..${derivedAddresses[derivedAddresses.length - 1].index}`);
                // if (this.loggerLevel > 0)
                // 	this.logger.verbose("addressDiscovery: findUtxos for addresses::", addresses)
                const { addressesWithUTXOs, txID2Info } = yield this.findUtxos(addresses, debug);
                if (!debugInfo)
                    debugInfo = txID2Info;
                if (addressesWithUTXOs.length === 0) {
                    // address discovery complete
                    const lastAddressIndexWithTx = highestIndex[deriveType]; //offset - (threshold - n) - 1;
                    this.logger.verbose(`${deriveType}: address discovery complete`);
                    this.logger.verbose(`${deriveType}: last activity on address #${lastAddressIndexWithTx}`);
                    this.logger.verbose(`${deriveType}: no activity from ${offset}..${offset + n}`);
                    if (offset >= maxOffset[deriveType] && offset >= cacheIndexes[deriveType]) {
                        endPoints[deriveType] = offset + n;
                        return lastAddressIndexWithTx;
                    }
                }
                // else keep doing discovery
                const index = derivedAddresses
                    .filter((obj) => addressesWithUTXOs.includes(obj.address))
                    .reduce((prev, cur) => Math.max(prev, cur.index), highestIndex[deriveType]);
                highestIndex[deriveType] = index;
                return doDiscovery(n, deriveType, offset + n);
            });
            const highestReceiveIndex = yield doDiscovery(threshold, 'receive', receiveStart);
            const highestChangeIndex = yield doDiscovery(threshold, 'change', changeStart);
            this.addressManager.receiveAddress.advance(highestReceiveIndex + 1);
            this.addressManager.changeAddress.advance(highestChangeIndex + 1);
            this.logger.verbose(`receive address index: ${highestReceiveIndex}; change address index: ${highestChangeIndex}`, `receive-address-index: ${this.addressManager.receiveAddress.counter}; change address index: ${this.addressManager.changeAddress.counter}`);
            if (!this.syncOnce && !this.syncInProggress)
                yield this.utxoSet.utxoSubscribe();
            this.runStateChangeHooks();
            let addressIndexes = {
                receive: Math.max(cacheIndexes.receive, this.addressManager.receiveAddress.counter),
                change: Math.max(cacheIndexes.change, this.addressManager.changeAddress.counter)
            };
            this.logger.info(`sync ...new cache: receive:${addressIndexes.receive}, change:${addressIndexes.change}`);
            this.cacheStore.setAddressIndexes(addressIndexes);
            this.emit("sync-end", addressIndexes);
            return { highestIndex, endPoints, debugInfo };
        });
    }
    // TODO: convert amount to sompis aka satoshis
    // TODO: bn
    /**
     * Compose a serialized, signed transaction
     * @param obj
     * @param obj.toAddr To address in cashaddr format (e.g. pugdagtest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param obj.amount Amount to send in sompis (100000000 (1e8) sompis in 1 PUG)
     * @param obj.fee Fee for miners in sompis
     * @param obj.changeAddrOverride Use this to override automatic change address derivation
     * @throws if amount is above `Number.MAX_SAFE_INTEGER`
     */
    composeTx({ toAddr, amount, fee = config_json_1.DEFAULT_FEE, changeAddrOverride, skipSign = false, privKeysInfo = false, compoundingUTXO = false, compoundingUTXOMaxCount = COMPOUND_UTXO_MAX_COUNT }) {
        // TODO: bn!
        amount = parseInt(amount);
        fee = parseInt(fee);
        // if (this.loggerLevel > 0) {
        // 	for (let i = 0; i < 100; i++)
        // 		console.log('Wallet transaction request for', amount, typeof amount);
        // }
        //if (!Number.isSafeInteger(amount)) throw new Error(`Amount ${amount} is too large`);
        let utxos, utxoIds, mass;
        if (compoundingUTXO) {
            ({ utxos, utxoIds, amount, mass } = this.utxoSet.collectUtxos(compoundingUTXOMaxCount));
        }
        else {
            ({ utxos, utxoIds, mass } = this.utxoSet.selectUtxos(amount + fee));
        }
        //if(mass > Wallet.MaxMassUTXOs){
        //	throw new Error(`Maximum number of inputs (UTXOs) reached. Please reduce this transaction amount.`);
        //}
        const privKeys = utxos.reduce((prev, cur) => {
            return [this.addressManager.all[String(cur.address)], ...prev];
        }, []);
        this.logger.info("utxos.length", utxos.length);
        const changeAddr = changeAddrOverride || this.addressManager.changeAddress.next();
        try {
            const tx = new pugdagcore.Transaction()
                .from(utxos)
                .to(toAddr, amount)
                .setVersion(0)
                .fee(fee)
                .change(changeAddr);
            if (!skipSign)
                tx.sign(privKeys, pugdagcore.crypto.Signature.SIGHASH_ALL, 'schnorr');
            //window.txxxx = tx;
            return {
                tx: tx,
                id: tx.id,
                rawTx: tx.toString(),
                utxoIds,
                amount,
                fee,
                utxos,
                toAddr,
                privKeys: privKeysInfo ? privKeys : []
            };
        }
        catch (e) {
            console.log("composeTx:error", e);
            // !!! FIXME
            if (!changeAddrOverride)
                this.addressManager.changeAddress.reverse();
            throw e;
        }
    }
    minimumRequiredTransactionRelayFee(mass) {
        let minimumFee = (mass * this.options.minimumRelayTransactionFee) / 1000;
        if (minimumFee == 0 && this.options.minimumRelayTransactionFee > 0) {
            minimumFee = this.options.minimumRelayTransactionFee;
        }
        // Set the minimum fee to the maximum possible value if the calculated
        // fee is not in the valid range for monetary amounts.
        if (minimumFee > MaxSompi) {
            minimumFee = MaxSompi;
        }
        return minimumFee;
    }
    /*
    validateAddress(addr:string):boolean{
        let address = new pugdagcore.Address(addr);
        return address.type == "pubkey";
    }
    */
    /**
     * Estimate transaction fee. Returns transaction data.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. pugdagtest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 PUG)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    estimateTransaction(txParamsArg) {
        return __awaiter(this, void 0, void 0, function* () {
            let address = this.addressManager.changeAddress.current.address;
            if (!address) {
                address = this.addressManager.changeAddress.next();
            }
            txParamsArg.changeAddrOverride = address;
            return this.composeTxAndNetworkFeeInfo(txParamsArg);
        });
    }
    composeTxAndNetworkFeeInfo(txParamsArg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.waitOrSync();
            if (!txParamsArg.fee)
                txParamsArg.fee = 0;
            this.logger.info(`tx ... sending to ${txParamsArg.toAddr}`);
            this.logger.info(`tx ... amount: ${PUG(txParamsArg.amount)} user fee: ${PUG(txParamsArg.fee)} max data fee: ${PUG(txParamsArg.networkFeeMax || 0)}`);
            //if(!this.validateAddress(txParamsArg.toAddr)){
            //	throw new Error("Invalid address")
            //}
            let txParams = Object.assign({}, txParamsArg);
            const networkFeeMax = txParams.networkFeeMax || 0;
            let calculateNetworkFee = !!txParams.calculateNetworkFee;
            let inclusiveFee = !!txParams.inclusiveFee;
            const { skipSign = true, privKeysInfo = false } = txParams;
            txParams.skipSign = skipSign;
            txParams.privKeysInfo = privKeysInfo;
            //console.log("calculateNetworkFee:", calculateNetworkFee, "inclusiveFee:", inclusiveFee)
            let data = this.composeTx(txParams);
            let { txSize, mass } = data.tx.getMassAndSize();
            let dataFee = this.minimumRequiredTransactionRelayFee(mass);
            const priorityFee = txParamsArg.fee;
            if (txParamsArg.compoundingUTXO) {
                inclusiveFee = true;
                calculateNetworkFee = true;
                txParamsArg.amount = data.amount;
                txParams.amount = data.amount;
                txParams.compoundingUTXO = false;
            }
            const txAmount = txParamsArg.amount;
            let amountRequested = txParamsArg.amount + priorityFee;
            let amountAvailable = data.utxos.map(utxo => utxo.satoshis).reduce((a, b) => a + b, 0);
            this.logger.verbose(`tx ... need data fee: ${PUG(dataFee)} total needed: ${PUG(amountRequested + dataFee)}`);
            this.logger.verbose(`tx ... available: ${PUG(amountAvailable)} in ${data.utxos.length} UTXOs`);
            if (networkFeeMax && dataFee > networkFeeMax) {
                throw new Error(`Fee max is ${networkFeeMax} but the minimum fee required for this transaction is ${PUG(dataFee)} PUG`);
            }
            if (calculateNetworkFee) {
                do {
                    //console.log(`insufficient data fees... incrementing by ${dataFee}`);
                    txParams.fee = priorityFee + dataFee;
                    if (inclusiveFee) {
                        txParams.amount = txAmount - txParams.fee;
                    }
                    this.logger.verbose(`tx ... insufficient data fee for transaction size of ${txSize} bytes`);
                    this.logger.verbose(`tx ... need data fee: ${PUG(dataFee)} for ${data.utxos.length} UTXOs`);
                    this.logger.verbose(`tx ... rebuilding transaction with additional inputs`);
                    let utxoLen = data.utxos.length;
                    this.logger.debug(`final fee ${txParams.fee}`);
                    data = this.composeTx(txParams);
                    ({ txSize, mass } = data.tx.getMassAndSize());
                    dataFee = this.minimumRequiredTransactionRelayFee(mass);
                    if (data.utxos.length != utxoLen)
                        this.logger.verbose(`tx ... aggregating: ${data.utxos.length} UTXOs`);
                } while ((!networkFeeMax || txParams.fee <= networkFeeMax) && txParams.fee < dataFee + priorityFee);
                if (networkFeeMax && txParams.fee > networkFeeMax)
                    throw new Error(`Maximum network fee exceeded; need: ${PUG(dataFee)} PUG maximum is: ${PUG(networkFeeMax)} PUG`);
            }
            else if (dataFee > priorityFee) {
                throw new Error(`Minimum fee required for this transaction is ${PUG(dataFee)} PUG`);
            }
            else if (inclusiveFee) {
                txParams.amount -= txParams.fee;
                data = this.composeTx(txParams);
            }
            data.dataFee = dataFee;
            data.totalAmount = txParams.fee + txParams.amount;
            data.txSize = txSize;
            data.note = txParamsArg.note || "";
            return data;
        });
    }
    /**
     * Build a transaction. Returns transaction info.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. pugdagtest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 PUG)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    buildTransaction(txParamsArg, debug = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const ts0 = Date.now();
            txParamsArg.skipSign = true;
            txParamsArg.privKeysInfo = true;
            const data = yield this.composeTxAndNetworkFeeInfo(txParamsArg);
            const { id, tx, utxos, utxoIds, amount, toAddr, fee, dataFee, totalAmount, txSize, note, privKeys } = data;
            const ts_0 = Date.now();
            tx.sign(privKeys, pugdagcore.crypto.Signature.SIGHASH_ALL, 'schnorr');
            const { mass: txMass } = tx.getMassAndSize();
            this.logger.info("txMass", txMass);
            if (txMass > Wallet.MaxMassAcceptedByBlock) {
                throw new Error(`Transaction size/mass limit reached. Please reduce this transaction amount. (Mass: ${txMass})`);
            }
            const ts_1 = Date.now();
            //const rawTx = tx.toString();
            const ts_2 = Date.now();
            this.logger.info(`tx ... required data fee: ${PUG(dataFee)} (${utxos.length} UTXOs)`); // (${PUG(txParamsArg.fee)}+${PUG(dataFee)})`);
            //this.logger.verbose(`tx ... final fee: ${PUG(dataFee+txParamsArg.fee)} (${PUG(txParamsArg.fee)}+${PUG(dataFee)})`);
            this.logger.info(`tx ... resulting total: ${PUG(totalAmount)}`);
            //console.log(utxos);
            if (debug || this.loggerLevel > 0) {
                this.logger.debug("submitTransaction: estimateTx", data);
                this.logger.debug("sendTx:utxos", utxos);
                this.logger.debug("::utxos[0].script::", utxos[0].script);
                //console.log("::utxos[0].address::", utxos[0].address)
            }
            const { nLockTime: lockTime, version } = tx;
            if (debug || this.loggerLevel > 0)
                this.logger.debug("composeTx:tx", "txSize:", txSize);
            const ts_3 = Date.now();
            const inputs = tx.inputs.map((input) => {
                if (debug || this.loggerLevel > 0) {
                    this.logger.debug("input.script.inspect", input.script.inspect());
                }
                return {
                    previousOutpoint: {
                        transactionId: input.prevTxId.toString("hex"),
                        index: input.outputIndex
                    },
                    signatureScript: input.script.toBuffer().toString("hex"),
                    sequence: input.sequenceNumber,
                    sigOpCount: 1
                };
            });
            const ts_4 = Date.now();
            const outputs = tx.outputs.map((output) => {
                return {
                    amount: output.satoshis,
                    scriptPublicKey: {
                        scriptPublicKey: output.script.toBuffer().toString("hex"),
                        version: 0
                    }
                };
            });
            const ts_5 = Date.now();
            //const payloadStr = "0000000000000000000000000000000";
            //const payload = Buffer.from(payloadStr).toString("base64");
            //console.log("payload-hex:", Buffer.from(payloadStr).toString("hex"))
            //@ ts-ignore
            //const payloadHash = pugdagcore.crypto.Hash.sha256sha256(Buffer.from(payloadStr));
            const rpcTX = {
                transaction: {
                    version,
                    inputs,
                    outputs,
                    lockTime,
                    //payload:'f00f00000000000000001976a914784bf4c2562f38fe0c49d1e0538cee4410d37e0988ac',
                    payloadHash: '0000000000000000000000000000000000000000000000000000000000000000',
                    //payloadHash:'afe7fc6fe3288e79f9a0c05c22c1ead2aae29b6da0199d7b43628c2588e296f9',
                    //
                    subnetworkId: this.subnetworkId, //Buffer.from(this.subnetworkId, "hex").toString("base64"),
                    fee,
                    //gas: 0
                }
            };
            //const rpctx = JSON.stringify(rpcTX, null, "  ");
            const ts1 = Date.now();
            this.logger.info(`tx ... generation time ${((ts1 - ts0) / 1000).toFixed(2)} sec`);
            if (debug || this.loggerLevel > 0) {
                this.logger.debug(`rpcTX ${JSON.stringify(rpcTX, null, "  ")}`);
                this.logger.debug(`rpcTX ${JSON.stringify(rpcTX)}`);
            }
            const ts_6 = Date.now();
            this.logger.info(`time in msec`, {
                "total": ts_6 - ts0,
                "estimate-transaction": ts_0 - ts0,
                "tx.sign": ts_1 - ts_0,
                "tx.toString": ts_2 - ts_1,
                //"ts_3-ts_2": ts_3-ts_2,
                "tx.inputs.map": ts_4 - ts_3,
                "tx.outputs.map": ts_5 - ts_4,
                //"ts_6-ts_5": ts_6-ts_5
            });
            if (txParamsArg.skipUTXOInUseMark !== true) {
                this.utxoSet.updateUsed(utxos);
            }
            //const rpctx = JSON.stringify(rpcTX, null, "  ");
            //console.log("rpcTX", rpcTX)
            //console.log("\n\n########rpctx\n", rpctx+"\n\n\n")
            //if(amount/1e8 > 3)
            //	throw new Error("TODO XXXXXX")
            return Object.assign(Object.assign({}, data), { rpcTX });
        });
    }
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. pugdagtest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 PUG)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    submitTransaction(txParamsArg, debug = false) {
        return __awaiter(this, void 0, void 0, function* () {
            txParamsArg.skipUTXOInUseMark = true;
            let reverseChangeAddress = false;
            if (!txParamsArg.changeAddrOverride) {
                txParamsArg.changeAddrOverride = this.addressManager.changeAddress.next();
                reverseChangeAddress = true;
            }
            const { rpcTX, utxoIds, amount, toAddr, note, utxos } = yield this.buildTransaction(txParamsArg, debug);
            //console.log("rpcTX:", rpcTX)
            //throw new Error("TODO : XXXX")
            try {
                const ts = Date.now();
                let txid = yield this.api.submitTransaction(rpcTX);
                const ts3 = Date.now();
                this.logger.info(`tx ... submission time ${((ts3 - ts) / 1000).toFixed(2)} sec`);
                this.logger.info(`txid: ${txid}`);
                if (!txid) {
                    if (reverseChangeAddress)
                        this.addressManager.changeAddress.reverse();
                    return null; // as TxResp;
                }
                this.utxoSet.inUse.push(...utxoIds);
                this.txStore.add({
                    in: false, ts, id: txid, amount, address: toAddr, note,
                    blueScore: this.blueScore,
                    tx: rpcTX.transaction,
                    myAddress: this.addressManager.isOur(toAddr),
                    isCoinbase: false,
                    version: 2
                });
                this.updateDebugInfo();
                this.emitCache();
                /*
                this.pendingInfo.add(txid, {
                    rawTx: tx.toString(),
                    utxoIds,
                    amount,
                    to: toAddr,
                    fee
                });
                */
                const resp = {
                    txid,
                    //rpctx
                };
                return resp;
            }
            catch (e) {
                if (reverseChangeAddress)
                    this.addressManager.changeAddress.reverse();
                if (typeof e.setExtraDebugInfo == "function") {
                    let mass = 0;
                    let satoshis = 0;
                    let list = utxos.map(tx => {
                        var _d;
                        mass += tx.mass;
                        satoshis += tx.satoshis;
                        return Object.assign({}, tx, {
                            address: tx.address.toString(),
                            script: (_d = tx.script) === null || _d === void 0 ? void 0 : _d.toString()
                        });
                    });
                    //86500,00000000
                    let info = {
                        mass,
                        satoshis,
                        utxoCount: list.length,
                        utxos: list
                    };
                    e.setExtraDebugInfo(info);
                }
                throw e;
            }
        });
    }
    /*
    * Compound UTXOs by re-sending funds to itself
    */
    compoundUTXOs(txCompoundOptions = {}, debug = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const { UTXOMaxCount = COMPOUND_UTXO_MAX_COUNT, networkFeeMax = 0, fee = 0, useLatestChangeAddress = false } = txCompoundOptions;
            //let toAddr = this.addressManager.changeAddress.next()
            let toAddr = this.addressManager.changeAddress.atIndex[0];
            //console.log("compoundUTXOs: to address:", toAddr, "useLatestChangeAddress:"+useLatestChangeAddress)
            if (useLatestChangeAddress) {
                toAddr = this.addressManager.changeAddress.current.address;
            }
            if (!toAddr) {
                toAddr = this.addressManager.changeAddress.next();
            }
            let txParamsArg = {
                toAddr,
                changeAddrOverride: toAddr,
                amount: -1,
                fee,
                networkFeeMax,
                compoundingUTXO: true,
                compoundingUTXOMaxCount: UTXOMaxCount
            };
            try {
                let res = yield this.submitTransaction(txParamsArg, debug);
                if (!(res === null || res === void 0 ? void 0 : res.txid))
                    this.addressManager.changeAddress.reverse();
                return res;
            }
            catch (e) {
                this.addressManager.changeAddress.reverse();
                throw e;
            }
        });
    }
    /*
    undoPendingTx(id: string): void {
        const {	utxoIds	} = this.pendingInfo.transactions[id];
        delete this.pendingInfo.transactions[id];
        this.utxoSet.release(utxoIds);
        this.addressManager.changeAddress.reverse();
        this.runStateChangeHooks();
    }
    */
    /**
     * After we see the transaction in the API results, delete it from our pending list.
     * @param id The tx hash
     */
    /*
   deletePendingTx(id: string): void {
       // undo + delete old utxos
       const {	utxoIds } = this.pendingInfo.transactions[id];
       delete this.pendingInfo.transactions[id];
       this.utxoSet.remove(utxoIds);
   }
   */
    runStateChangeHooks() {
        //this.utxoSet.updateUtxoBalance();
        //this.updateBalance();
    }
    startUTXOsPolling() {
        //if (this.UTXOsPollingStarted)
        //	return
        //this.UTXOsPollingStarted = true;
        this.emitUTXOs();
    }
    emitUTXOs() {
        let chunks = helper.chunks([...this.utxoSet.utxos.confirmed.values()], 100);
        chunks = chunks.concat(helper.chunks([...this.utxoSet.utxos.pending.values()], 100));
        let send = () => {
            let utxos = chunks.pop();
            if (!utxos)
                return;
            utxos = utxos.map(tx => {
                return Object.assign({}, tx, {
                    address: tx.address.toString()
                });
            });
            this.emit("utxo-sync", { utxos });
            helper.dpc(200, send);
        };
        send();
    }
    get cache() {
        return {
            //pendingTx: this.pendingInfo.transactions,
            utxos: {
                //utxoStorage: this.utxoSet.utxoStorage,
                inUse: this.utxoSet.inUse,
            },
            //transactionsStorage: this.transactionsStorage,
            addresses: {
                receiveCounter: this.addressManager.receiveAddress.counter,
                changeCounter: this.addressManager.changeAddress.counter,
            }
        };
    }
    restoreCache(cache) {
        //this.pendingInfo.transactions = cache.pendingTx;
        //this.utxoSet.utxoStorage = cache.utxos.utxoStorage;
        this.utxoSet.inUse = cache.utxos.inUse;
        /*
        Object.entries(this.utxoSet.utxoStorage).forEach(([addr, utxos]: [string, Api.Utxo[]]) => {
            this.utxoSet.add(utxos, addr);
        });
        this.transactionsStorage = cache.transactionsStorage;
        this.addressManager.getAddresses(cache.addresses.receiveCounter + 1, 'receive');
        this.addressManager.getAddresses(cache.addresses.changeCounter + 1, 'change');
        this.addressManager.receiveAddress.advance(cache.addresses.receiveCounter - 1);
        this.addressManager.changeAddress.advance(cache.addresses.changeCounter);
        //this.transactions = txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
        this.runStateChangeHooks();
        */
    }
    /**
     * Generates encrypted wallet data.
     * @param password user's chosen password
     * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
     */
    export(password) {
        return __awaiter(this, void 0, void 0, function* () {
            const savedWallet = {
                privKey: this.HDWallet.toString(),
                seedPhrase: this.mnemonic
            };
            return crypto_1.Crypto.encrypt(password, JSON.stringify(savedWallet));
        });
    }
    setLogLevel(level) {
        this.logger.setLevel(level);
        this.loggerLevel = level != 'none' ? 2 : 0;
        pugdagcore.setDebugLevel(level ? 1 : 0);
    }
}
exports.Wallet = Wallet;
_a = BALANCE_CONFIRMED, _b = BALANCE_PENDING, _c = BALANCE_TOTAL;
Wallet.Mnemonic = Mnemonic;
Wallet.passwordHandler = crypto_1.Crypto;
Wallet.Crypto = crypto_1.Crypto;
Wallet.pugdagcore = pugdagcore;
Wallet.COMPOUND_UTXO_MAX_COUNT = COMPOUND_UTXO_MAX_COUNT;
Wallet.MaxMassAcceptedByBlock = 100000;
Wallet.MaxMassUTXOs = 100000;
//Wallet.MaxMassAcceptedByBlock -
//pugdagcore.Transaction.EstimatedStandaloneMassWithoutInputs;
// TODO - integrate with Pugdagcore-lib
Wallet.networkTypes = {
    pugdag: { port: 26589, network: 'pugdag', name: 'mainnet' },
    pugdagtest: { port: 26689, network: 'pugdagtest', name: 'testnet' },
    pugdagsim: { port: 26789, network: 'pugdagsim', name: 'simnet' },
    pugdagdev: { port: 26889, network: 'pugdagdev', name: 'devnet' }
};
Wallet.networkAliases = {
    mainnet: 'pugdag',
    testnet: 'pugdagtest',
    devnet: 'pugdagdev',
    simnet: 'pugdagsim'
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FsbGV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L3dhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUM3QywrREFBaUQ7QUFtQ3pDLGtDQUFXO0FBbENuQix3REFBMEM7QUFFMUMsNENBQTBCO0FBQzFCLDBDQUF3QjtBQUN4QixxQ0FBZ0M7QUFDaEMsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztBQVN2Qiw0Q0FBcUQ7QUFDckQsdURBQWlEO0FBQ2pELGlDQUFzRjtBQWtCeEMsbUdBbEJkLHlCQUFrQixPQWtCYztBQUFFLG1HQWxCZCx5QkFBa0IsT0FrQmM7QUFqQnBGLHlDQUFtQztBQUNuQywrQ0FBeUM7QUFDekMsK0JBQTJDO0FBQzNDLGdEQUEyRDtBQUMzRCwyREFBb0Q7QUFHcEQsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLEVBQUUsQ0FBQztBQUNuQyxNQUFNLGVBQWUsR0FBRyxNQUFNLEVBQUUsQ0FBQztBQUNqQyxNQUFNLGFBQWEsR0FBRyxNQUFNLEVBQUUsQ0FBQztBQUMvQixNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQztBQU9mLDBEQUF1QjtBQUw1QyxNQUFNLGVBQWUsR0FBRyxTQUFXLENBQUE7QUFFbkMsK0RBQStEO0FBQy9ELE1BQU0sUUFBUSxHQUFHLFVBQWEsR0FBRyxlQUFlLENBQUE7QUFJaEQsb0VBQW9FO0FBQ3BFLE1BQU0sTUFBTyxTQUFRLG1DQUFlO0lBNEJuQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQVE7UUFDbEIsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDZixDQUFDO0lBR0QsTUFBTSxDQUFDLFdBQVc7UUFDakIsT0FBTyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUVE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RyxNQUFNLEFBQVQsQ0FBVTtBQUNoQyxtQkFBWSxHQUFHLE1BQU0sQUFBVCxDQUFVO0FBQzdCLGlDQUFpQztBQUNqQywrREFBK0Q7QUFFL0Qsd0NBQXdDO0FBQ2pDLG1CQUFZLEdBQVc7SUFDN0IsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRyxTQUFTLEVBQUU7SUFDOUQsV0FBVyxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRyxTQUFTLEVBQUU7SUFDdEUsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRyxRQUFRLEVBQUU7SUFDbkUsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRyxRQUFRLEVBQUU7Q0FDbkUsQUFMa0IsQ0FLbEI7QUFFTSxxQkFBYyxHQUFXO0lBQy9CLE9BQU8sRUFBRSxTQUFTO0lBQ2xCLE9BQU8sRUFBRSxhQUFhO0lBQ3RCLE1BQU0sRUFBRSxZQUFZO0lBQ3BCLE1BQU0sRUFBRSxZQUFZO0NBQ3BCLEFBTG9CLENBS3BCIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgTW5lbW9uaWMgPSByZXF1aXJlKCdiaXRjb3JlLW1uZW1vbmljJyk7XG5pbXBvcnQgKiBhcyBrYXJsc2VuY29yZSBmcm9tICdAa2FybHNlbi9jb3JlLWxpYic7XG5pbXBvcnQgKiBhcyBoZWxwZXIgZnJvbSAnLi4vdXRpbHMvaGVscGVyJztcbmltcG9ydCB7U3RvcmFnZSwgU3RvcmFnZVR5cGV9IGZyb20gJy4vc3RvcmFnZSc7XG5leHBvcnQgKiBmcm9tICcuL3N0b3JhZ2UnO1xuZXhwb3J0ICogZnJvbSAnLi9lcnJvcic7XG5pbXBvcnQge0NyeXB0b30gZnJvbSAnLi9jcnlwdG8nO1xuY29uc3QgS0xTID0gaGVscGVyLktMUztcblxuaW1wb3J0IHtcblx0TmV0d29yaywgTmV0d29ya09wdGlvbnMsIFNlbGVjdGVkTmV0d29yaywgV2FsbGV0U2F2ZSwgQXBpLCBUeFNlbmQsIFR4UmVzcCxcblx0UGVuZGluZ1RyYW5zYWN0aW9ucywgV2FsbGV0Q2FjaGUsIElSUEMsIFJQQywgV2FsbGV0T3B0aW9ucyxcdFdhbGxldE9wdCxcblx0VHhJbmZvLCBDb21wb3NlVHhJbmZvLCBCdWlsZFR4UmVzdWx0LCBUeENvbXBvdW5kT3B0aW9ucywgRGVidWdJbmZvLFxuXHRTY2FuZU1vcmVSZXN1bHRcbn0gZnJvbSAnLi4vdHlwZXMvY3VzdG9tLXR5cGVzJztcblxuaW1wb3J0IHtDcmVhdGVMb2dnZXIsIExvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7QWRkcmVzc01hbmFnZXJ9IGZyb20gJy4vYWRkcmVzcy1tYW5hZ2VyJztcbmltcG9ydCB7VW5zcGVudE91dHB1dCwgVXR4b1NldCwgQ09ORPUGTUFUSU9OX0NPVU5ULCBDT0lOQkFTRV9DRk1fQ09VTlR9IGZyb20gJy4vdXR4byc7XG5pbXBvcnQge1RYU3RvcmV9IGZyb20gJy4vdHgtc3RvcmUnO1xuaW1wb3J0IHtDYWNoZVN0b3JlfSBmcm9tICcuL2NhY2hlLXN0b3JlJztcbmltcG9ydCB7S2FybHNlbkFQSSwgQXBpRXJyb3J9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7REVGQVVMVF9GRUUsREVGQVVMVF9ORVRXT1JLfSBmcm9tICcuLi9jb25maWcuanNvbic7XG5pbXBvcnQge0V2ZW50VGFyZ2V0SW1wbH0gZnJvbSAnLi9ldmVudC10YXJnZXQtaW1wbCc7XG5cblxuY29uc3QgQkFMQU5DRV9DT05GSVJNRUQgPSBTeW1ib2woKTtcbmNvbnN0IEJBTEFOQ0VfUEVORElORyA9IFN5bWJvbCgpO1xuY29uc3QgQkFMQU5DRV9UT1RBTCA9IFN5bWJvbCgpO1xuY29uc3QgQ09NUE9VTkRfVVRYT19NQVhfQ09VTlQgPSA1MDA7XG5cbmNvbnN0IFNvbXBpUGVyS2FybHNlbiA9IDEwMF8wMDBfMDAwXG5cbi8vIE1heFNvbXBpIGlzIHRoZSBtYXhpbXVtIHRyYW5zYWN0aW9uIGFtb3VudCBhbGxvd2VkIGluIHNvbXBpLlxuY29uc3QgTWF4U29tcGkgPSA0Xzk2MV8wMDBfMDAwICogU29tcGlQZXJLYXJsc2VuXG5cbmV4cG9ydCB7a2FybHNlbmNvcmUsIENPTVBPVU5EX1VUWE9fTUFYX0NPVU5ULCBDT05GSVJNQVRJT05fQ09VTlQsIENPSU5CQVNFX0NGTV9DT1VOVH07XG5cbi8qKiBDbGFzcyByZXByZXNlbnRpbmcgYW4gSERXYWxsZXQgd2l0aCBkZXJpdmFibGUgY2hpbGQgYWRkcmVzc2VzICovXG5jbGFzcyBXYWxsZXQgZXh0ZW5kcyBFdmVudFRhcmdldEltcGwge1xuXG5cdHN0YXRpYyBNbmVtb25pYzogdHlwZW9mIE1uZW1vbmljID0gTW5lbW9uaWM7XG5cdHN0YXRpYyBwYXNzd29yZEhhbmRsZXIgPSBDcnlwdG87XG5cdHN0YXRpYyBDcnlwdG8gPSBDcnlwdG87XG5cdHN0YXRpYyBrYXJsc2VuY29yZT1rYXJsc2VuY29yZTtcblx0c3RhdGljIENPTVBPVU5EX1VUWE9fTUFYX0NPVU5UPUNPTVBPVU5EX1VUWE9fTUFYX0NPVU5UO1xuXHRzdGF0aWMgTWF4TWFzc0FjY2VwdGVkQnlCbG9jayA9IDEwMDAwMDtcblx0c3RhdGljIE1heE1hc3NVVFhPcyA9IDEwMDAwMDtcblx0Ly9XYWxsZXQuTWF4TWFzc0FjY2VwdGVkQnlCbG9jayAtXG5cdC8va2FybHNlbmNvcmUuVHJhbnNhY3Rpb24uRXN0aW1hdGVkU3RhbmRhbG9uZU1hc3NXaXRob3V0SW5wdXRzO1xuXG5cdC8vIFRPRE8gLSBpbnRlZ3JhdGUgd2l0aCBLYXJsc2VuY29yZS1saWJcblx0c3RhdGljIG5ldHdvcmtUeXBlczogT2JqZWN0ID0ge1xuXHRcdGthcmxzZW46IHsgcG9ydDogNDIxMTAsIG5ldHdvcms6ICdrYXJsc2VuJywgbmFtZSA6ICdtYWlubmV0JyB9LFxuXHRcdGthcmxzZW50ZXN0OiB7IHBvcnQ6IDQyMjEwLCBuZXR3b3JrOiAna2FybHNlbnRlc3QnLCBuYW1lIDogJ3Rlc3RuZXQnIH0sXG5cdFx0a2FybHNlbnNpbTogeyBwb3J0OiA0MjUxMCwgbmV0d29yazogJ2thcmxzZW5zaW0nLCBuYW1lIDogJ3NpbW5ldCcgfSxcblx0XHRrYXJsc2VuZGV2OiB7IHBvcnQ6IDQyNjEwLCBuZXR3b3JrOiAna2FybHNlbmRldicsIG5hbWUgOiAnZGV2bmV0JyB9XG5cdH1cblxuXHRzdGF0aWMgbmV0d29ya0FsaWFzZXM6IE9iamVjdCA9IHtcblx0XHRtYWlubmV0OiAna2FybHNlbicsXG5cdFx0dGVzdG5ldDogJ2thcmxzZW50ZXN0Jyxcblx0XHRkZXZuZXQ6ICdrYXJsc2VuZGV2Jyxcblx0XHRzaW1uZXQ6ICdrYXJsc2Vuc2ltJ1xuXHR9XG5cblxuXHRzdGF0aWMgS0xTKHY6bnVtYmVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gS0xTKHYpO1xuXHR9XG5cblxuXHRzdGF0aWMgaW5pdFJ1bnRpbWUoKSB7XG5cdFx0cmV0dXJuIGthcmxzZW5jb3JlLmluaXRSdW50aW1lKCk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBtbmVtb25pYyB0byBhIG5ldyB3YWxsZXQuXG5cdCAqIEBwYXJhbSBzZWVkUGhyYXNlIFRoZSAxMiB3b3JkIHNlZWQgcGhyYXNlLlxuXHQgKiBAcmV0dXJucyBuZXcgV2FsbGV0XG5cdCAqL1xuXHRzdGF0aWMgZnJvbU1uZW1vbmljKHNlZWRQaHJhc2U6IHN0cmluZywgbmV0d29ya09wdGlvbnM6IE5ldHdvcmtPcHRpb25zLCBvcHRpb25zOiBXYWxsZXRPcHRpb25zID0ge30pOiBXYWxsZXQge1xuXHRcdGlmICghbmV0d29ya09wdGlvbnMgfHwgIW5ldHdvcmtPcHRpb25zLm5ldHdvcmspXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGZyb21NbmVtb25pYyhzZWVkUGhyYXNlLG5ldHdvcmtPcHRpb25zKTogbWlzc2luZyBuZXR3b3JrIGFyZ3VtZW50YCk7XG5cdFx0Y29uc3QgcHJpdktleSA9IG5ldyBNbmVtb25pYyhzZWVkUGhyYXNlLnRyaW0oKSkudG9IRFByaXZhdGVLZXkoKS50b1N0cmluZygpO1xuXHRcdGNvbnN0IHdhbGxldCA9IG5ldyB0aGlzKHByaXZLZXksIHNlZWRQaHJhc2UsIG5ldHdvcmtPcHRpb25zLCBvcHRpb25zKTtcblx0XHRyZXR1cm4gd2FsbGV0O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgV2FsbGV0IGZyb20gZW5jcnlwdGVkIHdhbGxldCBkYXRhLlxuXHQgKiBAcGFyYW0gcGFzc3dvcmQgdGhlIHBhc3N3b3JkIHRoZSB1c2VyIGVuY3J5cHRlZCB0aGVpciBzZWVkIHBocmFzZSB3aXRoXG5cdCAqIEBwYXJhbSBlbmNyeXB0ZWRNbmVtb25pYyB0aGUgZW5jcnlwdGVkIHNlZWQgcGhyYXNlIGZyb20gbG9jYWwgc3RvcmFnZVxuXHQgKiBAdGhyb3dzIFdpbGwgdGhyb3cgXCJJbmNvcnJlY3QgcGFzc3dvcmRcIiBpZiBwYXNzd29yZCBpcyB3cm9uZ1xuXHQgKi9cblx0c3RhdGljIGFzeW5jIGltcG9ydCAocGFzc3dvcmQ6IHN0cmluZywgZW5jcnlwdGVkTW5lbW9uaWM6IHN0cmluZywgbmV0d29ya09wdGlvbnM6IE5ldHdvcmtPcHRpb25zLCBvcHRpb25zOiBXYWxsZXRPcHRpb25zID0ge30pOiBQcm9taXNlIDwgV2FsbGV0ID4ge1xuXHRcdGNvbnN0IGRlY3J5cHRlZCA9IGF3YWl0IENyeXB0by5kZWNyeXB0KHBhc3N3b3JkLCBlbmNyeXB0ZWRNbmVtb25pYyk7XG5cdFx0Y29uc3Qgc2F2ZWRXYWxsZXQgPSBKU09OLnBhcnNlKGRlY3J5cHRlZCkgYXMgV2FsbGV0U2F2ZTtcblx0XHRjb25zdCBteVdhbGxldCA9IG5ldyB0aGlzKHNhdmVkV2FsbGV0LnByaXZLZXksIHNhdmVkV2FsbGV0LnNlZWRQaHJhc2UsIG5ldHdvcmtPcHRpb25zLCBvcHRpb25zKTtcblx0XHRyZXR1cm4gbXlXYWxsZXQ7XG5cdH1cblxuXHRIRFdhbGxldDoga2FybHNlbmNvcmUuSERQcml2YXRlS2V5O1xuXHRkaXNhYmxlQmFsYW5jZU5vdGlmaWNhdGlvbnM6IGJvb2xlYW4gPSBmYWxzZTtcblx0Z2V0IGJhbGFuY2UoKToge2F2YWlsYWJsZTogbnVtYmVyLCBwZW5kaW5nOm51bWJlciwgdG90YWw6bnVtYmVyfSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGF2YWlsYWJsZTogdGhpc1tCQUxBTkNFX0NPTkZJUk1FRF0sXG5cdFx0XHRwZW5kaW5nOiB0aGlzW0JBTEFOQ0VfUEVORElOR10sXG5cdFx0XHR0b3RhbDogdGhpc1tCQUxBTkNFX0NPTkZJUk1FRF0gKyB0aGlzW0JBTEFOQ0VfUEVORElOR11cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogU2V0IGJ5IGFkZHJlc3NNYW5hZ2VyXG5cdCAqL1xuXHRnZXQgcmVjZWl2ZUFkZHJlc3MoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY3VycmVudC5hZGRyZXNzO1xuXHR9XG5cblx0Z2V0IGNoYW5nZUFkZHJlc3MoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jdXJyZW50LmFkZHJlc3M7XG5cdH1cblxuXHQvKipcblx0ICogQ3VycmVudCBuZXR3b3JrLlxuXHQgKi9cblx0bmV0d29yazogTmV0d29yayA9ICdrYXJsc2VuJztcblxuXHRhcGk6IEthcmxzZW5BUEk7IC8vbmV3IEthcmxzZW5BUEkoKTtcblxuXHQvKiogXG5cdCAqIERlZmF1bHQgZmVlXG5cdCAqL1xuXG5cdGRlZmF1bHRGZWU6IG51bWJlciA9IDE7IC8vcGVyIGJ5dGVcblxuXHRzdWJuZXR3b3JrSWQ6IHN0cmluZyA9IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMFwiOyAvL2hleCBzdHJpbmdcblxuXHRsYXN0X3R4XzpzdHJpbmcgPSAnJztcblx0LyoqXG5cdCAqIEN1cnJlbnQgQVBJIGVuZHBvaW50IGZvciBzZWxlY3RlZCBuZXR3b3JrXG5cdCAqL1xuXHRhcGlFbmRwb2ludCA9ICdsb2NhbGhvc3Q6MTYyMTAnO1xuXG5cdC8qKlxuXHQgKiBBIDEyIHdvcmQgbW5lbW9uaWMuXG5cdCAqL1xuXHRtbmVtb25pYzogc3RyaW5nO1xuXG5cdHV0eG9TZXQ6IFV0eG9TZXQ7XG5cblx0YWRkcmVzc01hbmFnZXI6IEFkZHJlc3NNYW5hZ2VyO1xuXG5cdGJsdWVTY29yZTogbnVtYmVyID0gLTE7XG5cblx0c3luY1ZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZVN0YXJ0ZWQ6Ym9vbGVhbiA9IGZhbHNlO1xuXHRzeW5jSW5Qcm9nZ3Jlc3M6Ym9vbGVhbiA9IGZhbHNlO1xuXG5cdC8qIGVzbGludC1kaXNhYmxlICovXG5cdHBlbmRpbmdJbmZvOiBQZW5kaW5nVHJhbnNhY3Rpb25zID0ge1xuXHRcdHRyYW5zYWN0aW9uczoge30sXG5cdFx0Z2V0IGFtb3VudCgpIHtcblx0XHRcdGNvbnN0IHRyYW5zYWN0aW9ucyA9IE9iamVjdC52YWx1ZXModGhpcy50cmFuc2FjdGlvbnMpO1xuXHRcdFx0aWYgKHRyYW5zYWN0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiAwO1xuXHRcdFx0cmV0dXJuIHRyYW5zYWN0aW9ucy5yZWR1Y2UoKHByZXYsIGN1cikgPT4gcHJldiArIGN1ci5hbW91bnQgKyBjdXIuZmVlLCAwKTtcblx0XHR9LFxuXHRcdGFkZChcblx0XHRcdGlkOiBzdHJpbmcsXG5cdFx0XHR0eDoge1xuXHRcdFx0XHR0bzogc3RyaW5nO1xuXHRcdFx0XHR1dHhvSWRzOiBzdHJpbmdbXTtcblx0XHRcdFx0cmF3VHg6IHN0cmluZztcblx0XHRcdFx0YW1vdW50OiBudW1iZXI7XG5cdFx0XHRcdGZlZTogbnVtYmVyXG5cdFx0XHR9XG5cdFx0KSB7XG5cdFx0XHR0aGlzLnRyYW5zYWN0aW9uc1tpZF0gPSB0eDtcblx0XHR9XG5cdH07XG5cdC8qKlxuXHQgKiBUcmFuc2FjdGlvbnMgc29ydGVkIGJ5IGhhc2guXG5cdCAqL1xuXHR0cmFuc2FjdGlvbnM6UmVjb3JkPHN0cmluZywgeyByYXdUeDogc3RyaW5nOyB1dHhvSWRzOiBzdHJpbmdbXTsgYW1vdW50OiBudW1iZXI7IHRvOiBzdHJpbmc7IGZlZTogbnVtYmVyOyB9PiA9IHt9O1xuXG5cdC8qKlxuXHQgKiBUcmFuc2FjdGlvbiBhcnJheXMga2V5ZWQgYnkgYWRkcmVzcy5cblx0ICovXG5cdHRyYW5zYWN0aW9uc1N0b3JhZ2U6IFJlY29yZCA8IHN0cmluZywgQXBpLlRyYW5zYWN0aW9uW10gPiA9IHt9O1xuXG5cblx0b3B0aW9uczogV2FsbGV0T3B0O1xuXHRjb25uZWN0U2lnbmFsOmhlbHBlci5EZWZlcnJlZFByb21pc2U7XG5cdHR4U3RvcmU6VFhTdG9yZTtcblx0Y2FjaGVTdG9yZTpDYWNoZVN0b3JlO1xuXG5cdHVpZDpzdHJpbmc7XG5cblx0LyoqIENyZWF0ZSBhIHdhbGxldC5cblx0ICogQHBhcmFtIHdhbGxldFNhdmUgKG9wdGlvbmFsKVxuXHQgKiBAcGFyYW0gd2FsbGV0U2F2ZS5wcml2S2V5IFNhdmVkIHdhbGxldCdzIHByaXZhdGUga2V5LlxuXHQgKiBAcGFyYW0gd2FsbGV0U2F2ZS5zZWVkUGhyYXNlIFNhdmVkIHdhbGxldCdzIHNlZWQgcGhyYXNlLlxuXHQgKi9cblx0Y29uc3RydWN0b3IocHJpdktleTogc3RyaW5nLCBzZWVkUGhyYXNlOiBzdHJpbmcsIG5ldHdvcmtPcHRpb25zOiBOZXR3b3JrT3B0aW9ucywgb3B0aW9uczogV2FsbGV0T3B0aW9ucyA9IHt9KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmxvZ2dlciA9IENyZWF0ZUxvZ2dlcignS2FybHNlbldhbGxldCcpO1xuXHRcdHRoaXMuYXBpID0gbmV3IEthcmxzZW5BUEkoKTtcblx0XHQvL0B0cy1pZ25vcmVcblx0XHQvL3Bvc3RNZXNzYWdlKHtlcnJvcjpuZXcgQXBpRXJyb3IoXCJ0ZXN0XCIpIH0pXG5cdFx0bGV0IGRlZmF1bHRPcHQgPSB7XG5cdFx0XHRza2lwU3luY0JhbGFuY2U6IGZhbHNlLFxuXHRcdFx0c3luY09uY2U6IGZhbHNlLFxuXHRcdFx0YWRkcmVzc0Rpc2NvdmVyeUV4dGVudDoxNTAsXG5cdFx0XHRsb2dMZXZlbDonaW5mbycsXG5cdFx0XHRkaXNhYmxlQWRkcmVzc0Rlcml2YXRpb246ZmFsc2UsXG5cdFx0XHRjaGVja0dSUENGbGFnczpmYWxzZSxcblx0XHRcdG1pbmltdW1SZWxheVRyYW5zYWN0aW9uRmVlOjEwMDAsXG5cdFx0XHR1cGRhdGVUeFRpbWVzOnRydWVcblx0XHR9O1xuXHRcdC8vIGNvbnNvbGUubG9nKFwiQ1JFQVRJTkcgV0FMTEVUIEZPUiBORVRXT1JLXCIsIHRoaXMubmV0d29yayk7XG5cdFx0dGhpcy5vcHRpb25zID0gey4uLmRlZmF1bHRPcHQsXHQuLi5vcHRpb25zfTtcblx0XHQvL3RoaXMub3B0aW9ucy5hZGRyZXNzRGlzY292ZXJ5RXh0ZW50ID0gNTAwO1xuXHRcdHRoaXMuc2V0TG9nTGV2ZWwodGhpcy5vcHRpb25zLmxvZ0xldmVsKTsgXG5cblx0XHR0aGlzLm5ldHdvcmsgPSBuZXR3b3JrT3B0aW9ucy5uZXR3b3JrO1xuXHRcdHRoaXMuZGVmYXVsdEZlZSA9IG5ldHdvcmtPcHRpb25zLmRlZmF1bHRGZWUgfHwgdGhpcy5kZWZhdWx0RmVlO1xuXHRcdGlmIChuZXR3b3JrT3B0aW9ucy5ycGMpXG5cdFx0XHR0aGlzLmFwaS5zZXRSUEMobmV0d29ya09wdGlvbnMucnBjKTtcblxuXG5cdFx0aWYgKHByaXZLZXkgJiYgc2VlZFBocmFzZSkge1xuXHRcdFx0dGhpcy5IRFdhbGxldCA9IG5ldyBrYXJsc2VuY29yZS5IRFByaXZhdGVLZXkocHJpdktleSk7XG5cdFx0XHR0aGlzLm1uZW1vbmljID0gc2VlZFBocmFzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdGVtcCA9IG5ldyBNbmVtb25pYyhNbmVtb25pYy5Xb3Jkcy5FTkdMSVNIKTtcblx0XHRcdHRoaXMubW5lbW9uaWMgPSB0ZW1wLnRvU3RyaW5nKCk7XG5cdFx0XHR0aGlzLkhEV2FsbGV0ID0gbmV3IGthcmxzZW5jb3JlLkhEUHJpdmF0ZUtleSh0ZW1wLnRvSERQcml2YXRlS2V5KCkudG9TdHJpbmcoKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy51aWQgPSB0aGlzLmNyZWF0ZVVJRCgpO1xuXG5cdFx0dGhpcy51dHhvU2V0ID0gbmV3IFV0eG9TZXQodGhpcyk7XG5cdFx0dGhpcy50eFN0b3JlID0gbmV3IFRYU3RvcmUodGhpcyk7XG5cdFx0dGhpcy5jYWNoZVN0b3JlID0gbmV3IENhY2hlU3RvcmUodGhpcyk7XG5cdFx0Ly90aGlzLnV0eG9TZXQub24oXCJiYWxhbmNlLXVwZGF0ZVwiLCB0aGlzLnVwZGF0ZUJhbGFuY2UuYmluZCh0aGlzKSk7XG5cdFx0XG5cdFx0dGhpcy5hZGRyZXNzTWFuYWdlciA9IG5ldyBBZGRyZXNzTWFuYWdlcih0aGlzLkhEV2FsbGV0LCB0aGlzLm5ldHdvcmspO1xuXHRcdGlmKHRoaXMub3B0aW9ucy5kaXNhYmxlQWRkcmVzc0Rlcml2YXRpb24pXG5cdFx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLm5leHQoKTtcblx0XHQvL3RoaXMuaW5pdEFkZHJlc3NNYW5hZ2VyKCk7XG5cdFx0Ly90aGlzLnN5bmModGhpcy5vcHRpb25zLnN5bmNPbmNlKTtcblx0XHR0aGlzLmNvbm5lY3RTaWduYWwgPSBoZWxwZXIuRGVmZXJyZWQoKTtcblx0XHR0aGlzLmFwaS5vbihcImNvbm5lY3RcIiwgKCk9Pntcblx0XHRcdHRoaXMub25BcGlDb25uZWN0KClcblx0XHR9KVxuXHRcdHRoaXMuYXBpLm9uKFwiZGlzY29ubmVjdFwiLCAoKT0+e1xuXHRcdFx0dGhpcy5vbkFwaURpc2Nvbm5lY3QoKTtcblx0XHR9KVxuXHR9XG5cblx0Y3JlYXRlVUlEKCl7XG5cdFx0Y29uc3Qge3ByaXZhdGVLZXl9ID0gdGhpcy5IRFdhbGxldC5kZXJpdmVDaGlsZChgbS80NCcvOTcyLzAnLzEnLzAnYCk7XG5cdFx0bGV0IGFkZHJlc3MgPSBwcml2YXRlS2V5LnRvQWRkcmVzcyh0aGlzLm5ldHdvcmspLnRvU3RyaW5nKCkuc3BsaXQoXCI6XCIpWzFdXG5cdFx0cmV0dXJuIGhlbHBlci5jcmVhdGVIYXNoKGFkZHJlc3MpO1xuXHR9XG5cblx0YXN5bmMgb25BcGlDb25uZWN0KCl7XG5cdFx0dGhpcy5jb25uZWN0U2lnbmFsLnJlc29sdmUoKTtcblx0XHRsZXQge2Nvbm5lY3RlZH0gPSB0aGlzO1xuXHRcdHRoaXMuY29ubmVjdGVkID0gdHJ1ZTtcblx0XHR0aGlzLmxvZ2dlci5pbmZvKFwiZ1JQQyBjb25uZWN0ZWRcIik7XG5cdFx0dGhpcy5lbWl0KFwiYXBpLWNvbm5lY3RcIik7XG5cdFx0aWYodGhpcy5zeW5jU2lnbmFsICYmIGNvbm5lY3RlZCE9PXVuZGVmaW5lZCkgey8vaWYgc3luYyB3YXMgY2FsbGVkXG5cdFx0XHR0aGlzLmxvZ2dlci5pbmZvKFwic3RhcnRpbmcgd2FsbGV0IHJlLXN5bmMgLi4uXCIpO1xuXHRcdFx0YXdhaXQgdGhpcy5zeW5jKHRoaXMuc3luY09uY2UpO1xuXHRcdH1cblx0XHRcblx0fVxuXG5cdGNvbm5lY3RlZDpib29sZWFufHVuZGVmaW5lZDtcblx0b25BcGlEaXNjb25uZWN0KCkge1xuXHRcdHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5zeW5jVmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlU3RhcnRlZCA9IGZhbHNlO1xuXHRcdHRoaXMubG9nZ2VyLnZlcmJvc2UoXCJnUlBDIGRpc2Nvbm5lY3RlZFwiKTtcblx0XHR0aGlzLmVtaXQoXCJhcGktZGlzY29ubmVjdFwiKTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZShzeW5jT25jZTpib29sZWFuPXRydWUpe1xuXHRcdGF3YWl0IHRoaXMuc3luYyhzeW5jT25jZSk7XG5cdH1cblxuXHRzeW5jT25jZTpib29sZWFufHVuZGVmaW5lZDtcblx0c3luY1NpZ25hbDogaGVscGVyLkRlZmVycmVkUHJvbWlzZXx1bmRlZmluZWQ7XG5cdHdhaXRPclN5bmMoKXtcblx0XHRpZih0aGlzLnN5bmNTaWduYWwpXG5cdFx0XHRyZXR1cm4gdGhpcy5zeW5jU2lnbmFsO1xuXHRcdHJldHVybiB0aGlzLnN5bmMoKTtcblx0fVxuXHRhc3luYyBzeW5jKHN5bmNPbmNlOmJvb2xlYW58dW5kZWZpbmVkPXVuZGVmaW5lZCl7XG5cdFx0dGhpcy5zeW5jU2lnbmFsID0gaGVscGVyLkRlZmVycmVkKCk7XG5cdFx0YXdhaXQgdGhpcy5jb25uZWN0U2lnbmFsO1xuXHRcdGlmKHN5bmNPbmNlID09PSB1bmRlZmluZWQpXG5cdFx0XHRzeW5jT25jZSA9IHRoaXMub3B0aW9ucy5zeW5jT25jZTtcblx0XHRzeW5jT25jZSA9ICEhc3luY09uY2U7XG5cblx0XHR0aGlzLnN5bmNJblByb2dncmVzcyA9IHRydWU7XG5cdFx0dGhpcy5lbWl0KFwic3luYy1zdGFydFwiKTtcblx0XHRhd2FpdCB0aGlzLnR4U3RvcmUucmVzdG9yZSgpO1xuXHRcdGF3YWl0IHRoaXMuY2FjaGVTdG9yZS5yZXN0b3JlKCk7XG5cdFx0Y29uc3QgdHMwID0gRGF0ZS5ub3coKTtcblx0XHR0aGlzLmxvZ2dlci5pbmZvKGBzeW5jIC4uLiBzdGFydGluZyB3YWxsZXQgc3luY2ApOy8vICR7c3luY09uY2U/Jyhtb25pdG9yaW5nIGRpc2FibGVkKSc6Jyd9YCk7XG5cdFx0Ly90aGlzLmxvZ2dlci5pbmZvKGBzeW5jIC4uLi4uLi4uLi4uLiBzdGFydGVkLCBzeW5jT25jZToke3N5bmNPbmNlfWApXG5cblx0XHQvL2lmIGxhc3QgdGltZSBzeW5jT25jZSB3YXMgT0ZGIHdlIGhhdmUgc3Vic2NyaXB0aW9ucyB0byB1dHhvLWNoYW5nZVxuXHRcdGlmKHRoaXMuc3luY09uY2UgPT09IGZhbHNlICYmIHN5bmNPbmNlKXtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIldhbGxldCBzeW5jIHByb2Nlc3MgYWxyZWFkeSBydW5uaW5nLlwiKVxuXHRcdH1cblxuXHRcdHRoaXMuc3luY09uY2UgPSBzeW5jT25jZTtcblx0XHR0aGlzLmluaXRBZGRyZXNzTWFuYWdlcigpO1xuXG5cdFx0YXdhaXQgdGhpcy5pbml0Qmx1ZVNjb3JlU3luYyhzeW5jT25jZSlcblx0ICAgIC5jYXRjaChlPT57XG5cdCAgICAgICAgdGhpcy5sb2dnZXIuaW5mbyhcInN5bmNWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmU6ZXJyb3JcIiwgZSlcblx0ICAgIH0pXG5cdFx0XG5cdFx0aWYodGhpcy5vcHRpb25zLmRpc2FibGVBZGRyZXNzRGVyaXZhdGlvbil7XG5cdFx0XHR0aGlzLmxvZ2dlci53YXJuKCdzeW5jIC4uLiBydW5uaW5nIHdpdGggYWRkcmVzcyBkaXNjb3ZlcnkgZGlzYWJsZWQnKTtcblx0XHRcdHRoaXMudXR4b1NldC5zeW5jQWRkcmVzc2VzVXR4b3MoW3RoaXMucmVjZWl2ZUFkZHJlc3NdKTtcblx0XHR9ZWxzZXtcblx0XHQgICAgYXdhaXQgdGhpcy5hZGRyZXNzRGlzY292ZXJ5KHRoaXMub3B0aW9ucy5hZGRyZXNzRGlzY292ZXJ5RXh0ZW50KVxuXHRcdCAgICAuY2F0Y2goZT0+e1xuXHRcdCAgICAgICAgdGhpcy5sb2dnZXIuaW5mbyhcImFkZHJlc3NEaXNjb3Zlcnk6ZXJyb3JcIiwgZSlcblx0XHQgICAgfSlcblx0ICAgIH1cblxuXHQgICAgdGhpcy5zeW5jSW5Qcm9nZ3Jlc3MgPSBmYWxzZTtcblx0ICAgIGlmKCFzeW5jT25jZSlcblx0XHRcdGF3YWl0IHRoaXMudXR4b1NldC51dHhvU3Vic2NyaWJlKCk7XG5cblx0XHRjb25zdCB0czEgPSBEYXRlLm5vdygpO1xuXHRcdGNvbnN0IGRlbHRhID0gKCh0czEtdHMwKS8xMDAwKS50b0ZpeGVkKDEpO1xuXHQgICAgdGhpcy5sb2dnZXIuaW5mbyhgc3luYyAuLi4gJHt0aGlzLnV0eG9TZXQuY291bnR9IFVUWE8gZW50cmllcyBmb3VuZGApO1xuXHRcdHRoaXMubG9nZ2VyLmluZm8oYHN5bmMgLi4uIGluZGV4ZWQgJHt0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXJ9IHJlY2VpdmUgYW5kICR7dGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmNvdW50ZXJ9IGNoYW5nZSBhZGRyZXNzZXNgKTtcblx0ICAgIHRoaXMubG9nZ2VyLmluZm8oYHN5bmMgLi4uIGZpbmlzaGVkIChzeW5jIGRvbmUgaW4gJHtkZWx0YX0gc2Vjb25kcylgKTtcblx0XHR0aGlzLmVtaXQoXCJzeW5jLWZpbmlzaFwiKTtcblx0XHRjb25zdCB7YXZhaWxhYmxlLCBwZW5kaW5nLCB0b3RhbH0gPSB0aGlzLmJhbGFuY2U7XG5cdFx0dGhpcy5lbWl0KFwicmVhZHlcIiwge1xuXHRcdFx0YXZhaWxhYmxlLHBlbmRpbmcsIHRvdGFsLFxuXHRcdFx0Y29uZmlybWVkVXR4b3NDb3VudDogdGhpcy51dHhvU2V0LmNvbmZpcm1lZENvdW50XG5cdFx0fSk7XG5cdCAgICB0aGlzLmVtaXRCYWxhbmNlKCk7XG5cdCAgICB0aGlzLmVtaXRBZGRyZXNzKCk7XG5cdCAgICB0aGlzLnR4U3RvcmUuZW1pdFR4cygpO1xuXHQgICAgdGhpcy5zeW5jU2lnbmFsLnJlc29sdmUoKTtcblx0XHRpZighdGhpcy51dHhvU2V0LmNsZWFyTWlzc2luZygpKVxuXHRcdFx0dGhpcy51cGRhdGVEZWJ1Z0luZm8oKTtcblx0fVxuXG5cdGdldFZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5hcGkuZ2V0VmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlKCk7XG5cdH1cblxuXHRnZXRWaXJ0dWFsRGFhU2NvcmUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYXBpLmdldFZpcnR1YWxEYWFTY29yZSgpO1xuXHR9XG5cblx0YXN5bmMgaW5pdEJsdWVTY29yZVN5bmMob25jZTpib29sZWFuID0gZmFsc2UpIHtcblx0XHRpZih0aGlzLnN5bmNWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVTdGFydGVkKVxuXHRcdFx0cmV0dXJuO1xuXHRcdHRoaXMuc3luY1ZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZVN0YXJ0ZWQgPSB0cnVlO1xuXHRcdGxldCByID0gYXdhaXQgdGhpcy5nZXRWaXJ0dWFsRGFhU2NvcmUoKTtcblx0XHRsZXQge3ZpcnR1YWxEYWFTY29yZTpibHVlU2NvcmV9ID0gcjtcblx0XHRjb25zb2xlLmxvZyhcImdldFZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZSA6cmVzdWx0XCIsIHIpXG5cdFx0dGhpcy5ibHVlU2NvcmUgPSBibHVlU2NvcmU7XG5cdFx0dGhpcy5lbWl0KFwiYmx1ZS1zY29yZS1jaGFuZ2VkXCIsIHtibHVlU2NvcmV9KVxuXHRcdHRoaXMudXR4b1NldC51cGRhdGVVdHhvQmFsYW5jZSgpO1xuXG5cdFx0aWYob25jZSkge1xuXHRcdFx0dGhpcy5zeW5jVmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlU3RhcnRlZCA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmFwaS5zdWJzY3JpYmVWaXJ0dWFsRGFhU2NvcmVDaGFuZ2VkKChyZXN1bHQpID0+IHtcblx0XHRcdGxldCB7dmlydHVhbERhYVNjb3JlfSA9IHJlc3VsdDtcblx0XHRcdC8vY29uc29sZS5sb2coXCJzdWJzY3JpYmVWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVDaGFuZ2VkOnJlc3VsdFwiLCByZXN1bHQpXG5cdFx0XHR0aGlzLmJsdWVTY29yZSA9IHZpcnR1YWxEYWFTY29yZTtcblx0XHRcdHRoaXMuZW1pdChcImJsdWUtc2NvcmUtY2hhbmdlZFwiLCB7XG5cdFx0XHRcdGJsdWVTY29yZTogdmlydHVhbERhYVNjb3JlXG5cdFx0XHR9KVxuXHRcdFx0dGhpcy51dHhvU2V0LnVwZGF0ZVV0eG9CYWxhbmNlKCk7XG5cdFx0fSkudGhlbihyPT57XG5cdFx0XHRjb25zb2xlLmxvZyhcInN1YnNjcmliZVZpcnR1YWxEYWFTY29yZUNoYW5nZWQ6cmVzcG9uY2VcIiwgcilcblx0XHR9LCBlPT57XG5cdFx0XHRjb25zb2xlLmxvZyhcInN1YnNjcmliZVZpcnR1YWxEYWFTY29yZUNoYW5nZWQ6ZXJyb3JcIiwgZSlcblx0XHR9KVxuXHR9XG5cblx0YWRkcmVzc01hbmFnZXJJbml0aWFsaXplZDpib29sZWFufHVuZGVmaW5lZDtcblx0aW5pdEFkZHJlc3NNYW5hZ2VyKCkge1xuXHRcdGlmKHRoaXMuYWRkcmVzc01hbmFnZXJJbml0aWFsaXplZClcblx0XHRcdHJldHVyblxuXHRcdHRoaXMuYWRkcmVzc01hbmFnZXJJbml0aWFsaXplZCA9IHRydWU7XG5cblx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLm9uKFwibmV3LWFkZHJlc3NcIiwgZGV0YWlsID0+IHtcblx0XHRcdGlmKCF0aGlzLnN5bmNJblByb2dncmVzcyl7XG5cdFx0XHRcdHRoaXMuZW1pdEFkZHJlc3MoKTtcblx0XHRcdH1cblx0XHRcdC8vY29uc29sZS5sb2coXCJuZXctYWRkcmVzc1wiLCBkZXRhaWwpXG5cdFx0XHRpZiAodGhpcy5vcHRpb25zLnNraXBTeW5jQmFsYW5jZSlcblx0XHRcdFx0cmV0dXJuXG5cblx0XHRcdC8vY29uc29sZS5sb2coXCJuZXctYWRkcmVzczpkZXRhaWxcIiwgZGV0YWlsKVxuXHRcdFx0Y29uc3Qge1x0YWRkcmVzcywgdHlwZSB9ID0gZGV0YWlsO1xuXHRcdFx0dGhpcy51dHhvU2V0LnN5bmNBZGRyZXNzZXNVdHhvcyhbYWRkcmVzc10pO1xuXHRcdH0pXG5cdFx0aWYoIXRoaXMucmVjZWl2ZUFkZHJlc3Mpe1xuXHRcdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5uZXh0KCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgc3RhcnRVcGRhdGluZ1RyYW5zYWN0aW9ucyh2ZXJzaW9uOnVuZGVmaW5lZHxudW1iZXI9dW5kZWZpbmVkKTpQcm9taXNlPGJvb2xlYW4+e1xuXHRcdHJldHVybiBhd2FpdCB0aGlzLnR4U3RvcmUuc3RhcnRVcGRhdGluZ1RyYW5zYWN0aW9ucyh2ZXJzaW9uKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTZXQgcnBjIHByb3ZpZGVyXG5cdCAqIEBwYXJhbSBycGNcblx0ICovXG5cdHNldFJQQyhycGM6IElSUEMpIHtcblx0XHR0aGlzLmFwaS5zZXRSUEMocnBjKTtcblx0fVxuXG5cdC8qXG5cdHNldFN0b3JhZ2VUeXBlKHR5cGU6U3RvcmFnZVR5cGUpe1xuXHRcdHRoaXMuc3RvcmFnZS5zZXRUeXBlKHR5cGUpO1xuXHR9XG5cdHNldFN0b3JhZ2VGb2xkZXIoZm9sZGVyOnN0cmluZyl7XG5cdFx0dGhpcy5zdG9yYWdlLnNldEZvbGRlcihmb2xkZXIpO1xuXHR9XG5cdHNldFN0b3JhZ2VGaWxlTmFtZShmaWxlTmFtZTpzdHJpbmcpe1xuXHRcdHRoaXMuc3RvcmFnZS5zZXRGaWxlTmFtZShmaWxlTmFtZSk7XG5cdH1cblx0Ki9cblx0Lypcblx0X3N0b3JhZ2U6IHR5cGVvZiBzdG9yYWdlQ2xhc3Nlcy5TdG9yYWdlfHVuZGVmaW5lZDtcblxuXHRzZXRTdG9yYWdlUGFzc3dvcmQocGFzc3dvcmQ6IHN0cmluZykge1xuXHRcdGlmICghdGhpcy5zdG9yYWdlKVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiUGxlYXNlIGluaXQgc3RvcmFnZVwiKVxuXHRcdHRoaXMuc3RvcmFnZS5zZXRQYXNzd29yZChwYXNzd29yZCk7XG5cdH1cblx0Z2V0IHN0b3JhZ2UoKTogdHlwZW9mIHN0b3JhZ2VDbGFzc2VzLlN0b3JhZ2UgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9zdG9yYWdlO1xuXHR9XG5cblx0b3BlbkZpbGVTdG9yYWdlKGZpbGVOYW1lOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcsIGZvbGRlcjogc3RyaW5nID0gJycpIHtcblx0XHRsZXQgc3RvcmFnZSA9IENyZWF0ZVN0b3JhZ2UoKTtcblx0XHRpZiAoZm9sZGVyKVxuXHRcdFx0c3RvcmFnZS5zZXRGb2xkZXIoZm9sZGVyKTtcblx0XHRzdG9yYWdlLnNldEZpbGVOYW1lKGZpbGVOYW1lKTtcblx0XHRzdG9yYWdlLnNldFBhc3N3b3JkKHBhc3N3b3JkKTtcblx0XHR0aGlzLl9zdG9yYWdlID0gc3RvcmFnZTtcblx0fVxuXHQqL1xuXG5cdC8qKlxuXHQgKiBRdWVyaWVzIEFQSSBmb3IgYWRkcmVzc1tdIFVUWE9zLiBBZGRzIHR4IHRvIHRyYW5zYWN0aW9ucyBzdG9yYWdlLiBBbHNvIHNvcnRzIHRoZSBlbnRpcmUgdHJhbnNhY3Rpb24gc2V0LlxuXHQgKiBAcGFyYW0gYWRkcmVzc2VzXG5cdCAqL1xuXHRhc3luYyBmaW5kVXR4b3MoYWRkcmVzc2VzOiBzdHJpbmdbXSwgZGVidWcgPSBmYWxzZSk6IFByb21pc2UgPCB7XG5cdFx0dHhJRDJJbmZvOiBNYXAgPCBzdHJpbmcsXG5cdFx0e1xuXHRcdFx0dXR4b3M6IEFwaS5VdHhvW10sXG5cdFx0XHRhZGRyZXNzOiBzdHJpbmdcblx0XHR9ID4gLFxuXHRcdGFkZHJlc3Nlc1dpdGhVVFhPczogc3RyaW5nW11cblx0fSA+IHtcblx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKGBzY2FubmluZyBVVFhPIGVudHJpZXMgZm9yICR7YWRkcmVzc2VzLmxlbmd0aH0gYWRkcmVzc2VzYCk7XG5cblx0XHRjb25zdCB1dHhvc01hcCA9IGF3YWl0IHRoaXMuYXBpLmdldFV0eG9zQnlBZGRyZXNzZXMoYWRkcmVzc2VzKVxuXG5cdFx0Y29uc3QgYWRkcmVzc2VzV2l0aFVUWE9zOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IHR4SUQySW5mbyA9IG5ldyBNYXAoKTtcblxuXHRcdGlmIChkZWJ1Zykge1xuXHRcdFx0dXR4b3NNYXAuZm9yRWFjaCgodXR4b3MsIGFkZHJlc3MpID0+IHtcblx0XHRcdFx0Ly8gdXR4b3Muc29ydCgoYiwgYSk9PiBhLmluZGV4LWIuaW5kZXgpXG5cdFx0XHRcdHV0eG9zLm1hcCh0ID0+IHtcblx0XHRcdFx0XHRsZXQgaW5mbyA9IHR4SUQySW5mby5nZXQodC50cmFuc2FjdGlvbklkKTtcblx0XHRcdFx0XHRpZiAoIWluZm8pIHtcblx0XHRcdFx0XHRcdGluZm8gPSB7XG5cdFx0XHRcdFx0XHRcdHV0eG9zOiBbXSxcblx0XHRcdFx0XHRcdFx0YWRkcmVzc1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHR4SUQySW5mby5zZXQodC50cmFuc2FjdGlvbklkLCBpbmZvKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aW5mby51dHhvcy5wdXNoKHQpO1xuXHRcdFx0XHR9KVxuXHRcdFx0fSlcblx0XHR9XG5cblx0XHR1dHhvc01hcC5mb3JFYWNoKCh1dHhvcywgYWRkcmVzcykgPT4ge1xuXHRcdFx0Ly8gdXR4b3Muc29ydCgoYiwgYSk9PiBhLmluZGV4LWIuaW5kZXgpXG5cdFx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKGAke2FkZHJlc3N9IC0gJHt1dHhvcy5sZW5ndGh9IFVUWE8gZW50cmllcyBmb3VuZGApO1xuXHRcdFx0aWYgKHV0eG9zLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICBcdFx0dGhpcy5kaXNhYmxlQmFsYW5jZU5vdGlmaWNhdGlvbnMgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2VbYWRkcmVzc10gPSB1dHhvcztcblx0XHRcdFx0dGhpcy51dHhvU2V0LmFkZCh1dHhvcywgYWRkcmVzcyk7XG5cdFx0XHRcdGFkZHJlc3Nlc1dpdGhVVFhPcy5wdXNoKGFkZHJlc3MpO1xuXHRcdFx0XHR0aGlzLmRpc2FibGVCYWxhbmNlTm90aWZpY2F0aW9ucyA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLmVtaXRCYWxhbmNlKCk7XG4gICAgICBcdFx0fVxuXHRcdH0pXG5cblx0XHRjb25zdCBpc0FjdGl2aXR5T25SZWNlaXZlQWRkciA9XG5cdFx0XHR0aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2VbdGhpcy5yZWNlaXZlQWRkcmVzc10gIT09IHVuZGVmaW5lZDtcblx0XHRpZiAoaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIpIHtcblx0XHRcdHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MubmV4dCgpO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0YWRkcmVzc2VzV2l0aFVUWE9zLFxuXHRcdFx0dHhJRDJJbmZvXG5cdFx0fTtcblx0fVxuXG5cdFtCQUxBTkNFX0NPTkZJUk1FRF06bnVtYmVyID0gMDtcblx0W0JBTEFOQ0VfUEVORElOR106bnVtYmVyID0gMDtcblx0W0JBTEFOQ0VfVE9UQUxdOm51bWJlciA9IDA7XG5cdGFkanVzdEJhbGFuY2UoaXNDb25maXJtZWQ6Ym9vbGVhbiwgYW1vdW50Om51bWJlciwgbm90aWZ5OmJvb2xlYW49dHJ1ZSl7XG5cdFx0Y29uc3Qge2F2YWlsYWJsZSwgcGVuZGluZ30gPSB0aGlzLmJhbGFuY2U7XG5cdFx0aWYoaXNDb25maXJtZWQpe1xuXHRcdFx0dGhpc1tCQUxBTkNFX0NPTkZJUk1FRF0gKz0gYW1vdW50O1xuXHRcdH1lbHNle1xuXHRcdFx0dGhpc1tCQUxBTkNFX1BFTkRJTkddICs9IGFtb3VudDtcblx0XHR9XG5cblx0XHR0aGlzW0JBTEFOQ0VfVE9UQUxdID0gdGhpc1tCQUxBTkNFX0NPTkZJUk1FRF0gKyB0aGlzW0JBTEFOQ0VfUEVORElOR107XG5cblx0XHRpZihub3RpZnk9PT1mYWxzZSlcblx0XHRcdHJldHVyblxuXHRcdGNvbnN0IHthdmFpbGFibGU6X2F2YWlsYWJsZSwgcGVuZGluZzpfcGVuZGluZ30gPSB0aGlzLmJhbGFuY2U7XG5cdFx0aWYoIXRoaXMuc3luY0luUHJvZ2dyZXNzICYmICF0aGlzLmRpc2FibGVCYWxhbmNlTm90aWZpY2F0aW9ucyAmJiAoYXZhaWxhYmxlIT1fYXZhaWxhYmxlIHx8IHBlbmRpbmchPV9wZW5kaW5nKSlcblx0XHRcdHRoaXMuZW1pdEJhbGFuY2UoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFbWl0IHdhbGxldCBiYWxhbmNlLlxuXHQgKi9cblx0bGFzdEJhbGFuY2VOb3RpZmljYXRpb246e2F2YWlsYWJsZTpudW1iZXIsIHBlbmRpbmc6bnVtYmVyfSA9IHthdmFpbGFibGU6MCwgcGVuZGluZzowfVxuXHRlbWl0QmFsYW5jZSgpOiB2b2lkIHtcblx0XHRjb25zdCB7YXZhaWxhYmxlLCBwZW5kaW5nLCB0b3RhbH0gPSB0aGlzLmJhbGFuY2U7XG5cdFx0Y29uc3Qge2F2YWlsYWJsZTpfYXZhaWxhYmxlLCBwZW5kaW5nOl9wZW5kaW5nfSA9IHRoaXMubGFzdEJhbGFuY2VOb3RpZmljYXRpb247XG5cdFx0aWYoYXZhaWxhYmxlPT1fYXZhaWxhYmxlICYmIHBlbmRpbmc9PV9wZW5kaW5nKVxuXHRcdFx0cmV0dXJuXG5cdFx0dGhpcy5sYXN0QmFsYW5jZU5vdGlmaWNhdGlvbiA9IHthdmFpbGFibGUsIHBlbmRpbmd9O1xuXHRcdHRoaXMubG9nZ2VyLmRlYnVnKGBiYWxhbmNlIGF2YWlsYWJsZTogJHthdmFpbGFibGV9IHBlbmRpbmc6ICR7cGVuZGluZ31gKTtcblx0XHR0aGlzLmVtaXQoXCJiYWxhbmNlLXVwZGF0ZVwiLCB7XG5cdFx0XHRhdmFpbGFibGUsXG5cdFx0XHRwZW5kaW5nLFxuXHRcdFx0dG90YWwsXG5cdFx0XHRjb25maXJtZWRVdHhvc0NvdW50OiB0aGlzLnV0eG9TZXQuY29uZmlybWVkQ291bnRcblx0XHR9KTtcblx0fVxuXG5cdGRlYnVnSW5mbzpEZWJ1Z0luZm8gPSB7aW5Vc2VVVFhPczp7c2F0b3NoaXM6MCwgY291bnQ6MH19O1xuXHR1cGRhdGVEZWJ1Z0luZm8oKXtcblx0XHRsZXQgaW5Vc2VVVFhPcyA9IHtzYXRvc2hpczowLCBjb3VudDowfTtcblx0XHRsZXQge2NvbmZpcm1lZCwgcGVuZGluZywgdXNlZH0gPSB0aGlzLnV0eG9TZXQudXR4b3N8fHt9O1xuXHRcdHRoaXMudXR4b1NldC5pblVzZS5tYXAodXR4b0lkID0+IHtcblx0XHRcdGluVXNlVVRYT3Muc2F0b3NoaXMgKz0gY29uZmlybWVkLmdldCh1dHhvSWQpPy5zYXRvc2hpcyB8fFxuXHRcdFx0XHRwZW5kaW5nLmdldCh1dHhvSWQpPy5zYXRvc2hpcyB8fFxuXHRcdFx0XHR1c2VkLmdldCh1dHhvSWQpPy5zYXRvc2hpcyB8fCAwO1xuXHRcdH0pO1xuXHRcdGluVXNlVVRYT3MuY291bnQgPSB0aGlzLnV0eG9TZXQuaW5Vc2UubGVuZ3RoO1xuXHRcdHRoaXMuZGVidWdJbmZvID0ge2luVXNlVVRYT3N9O1xuXHRcdHRoaXMuZW1pdChcImRlYnVnLWluZm9cIiwge2RlYnVnSW5mbzp0aGlzLmRlYnVnSW5mb30pO1xuXHR9XG5cblx0Y2xlYXJVc2VkVVRYT3MoKXtcblx0XHR0aGlzLnV0eG9TZXQuY2xlYXJVc2VkKCk7XG5cdH1cblxuXHRlbWl0Q2FjaGUoKXtcblx0XHRsZXQge2NhY2hlfSA9IHRoaXM7XG5cdFx0dGhpcy5lbWl0KFwic3RhdGUtdXBkYXRlXCIsIHtjYWNoZX0pO1xuXHR9XG5cblx0bGFzdEFkZHJlc3NOb3RpZmljYXRpb246e3JlY2VpdmU/OnN0cmluZywgY2hhbmdlPzpzdHJpbmd9ID0ge307XG5cdGVtaXRBZGRyZXNzKCl7XG5cdFx0Y29uc3QgcmVjZWl2ZSA9IHRoaXMucmVjZWl2ZUFkZHJlc3M7XG5cdFx0Y29uc3QgY2hhbmdlID0gdGhpcy5jaGFuZ2VBZGRyZXNzO1xuXHRcdGxldCB7cmVjZWl2ZTpfcmVjZWl2ZSwgY2hhbmdlOl9jaGFuZ2V9PSB0aGlzLmxhc3RBZGRyZXNzTm90aWZpY2F0aW9uXG5cdFx0aWYocmVjZWl2ZSA9PSBfcmVjZWl2ZSAmJiBjaGFuZ2UgPT0gX2NoYW5nZSlcblx0XHRcdHJldHVyblxuXHRcdHRoaXMubGFzdEFkZHJlc3NOb3RpZmljYXRpb24gPSB7cmVjZWl2ZSwgY2hhbmdlfTtcblx0XHR0aGlzLmVtaXQoXCJuZXctYWRkcmVzc1wiLCB7XG5cdFx0XHRyZWNlaXZlLCBjaGFuZ2Vcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBVcGRhdGVzIHRoZSBzZWxlY3RlZCBuZXR3b3JrXG5cdCAqIEBwYXJhbSBuZXR3b3JrIG5hbWUgb2YgdGhlIG5ldHdvcmtcblx0ICovXG5cdGFzeW5jIHVwZGF0ZU5ldHdvcmsobmV0d29yazogU2VsZWN0ZWROZXR3b3JrKTogUHJvbWlzZSA8IHZvaWQgPiB7XG5cdFx0dGhpcy5kZW1vbGlzaFdhbGxldFN0YXRlKG5ldHdvcmsucHJlZml4KTtcblx0XHR0aGlzLm5ldHdvcmsgPSBuZXR3b3JrLnByZWZpeDtcblx0XHR0aGlzLmFwaUVuZHBvaW50ID0gbmV0d29yay5hcGlCYXNlVXJsO1xuXHR9XG5cblx0ZGVtb2xpc2hXYWxsZXRTdGF0ZShuZXR3b3JrUHJlZml4OiBOZXR3b3JrID0gdGhpcy5uZXR3b3JrKTogdm9pZCB7XG5cdFx0dGhpcy51dHhvU2V0LmNsZWFyKCk7XG5cdFx0dGhpcy5hZGRyZXNzTWFuYWdlciA9IG5ldyBBZGRyZXNzTWFuYWdlcih0aGlzLkhEV2FsbGV0LCBuZXR3b3JrUHJlZml4KTtcblx0XHQvL3RoaXMucGVuZGluZ0luZm8udHJhbnNhY3Rpb25zID0ge307XG5cdFx0dGhpcy50cmFuc2FjdGlvbnMgPSB7fTtcblx0XHR0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UgPSB7fTtcblx0fVxuXG5cdGFzeW5jIHNjYW5Nb3JlQWRkcmVzc2VzKGNvdW50PTEwMCwgZGVidWc9ZmFsc2UsIHJlY2VpdmVTdGFydD0tMSwgY2hhbmdlU3RhcnQ9LTEpOiBQcm9taXNlPFNjYW5lTW9yZVJlc3VsdD57XG5cdFx0aWYgKHRoaXMuc3luY0luUHJvZ2dyZXNzKVxuXHRcdFx0cmV0dXJuIHtlcnJvcjogXCJTeW5jIGluIHByb2dyZXNzXCIsIGNvZGU6XCJTWU5DLUlOLVBST0dSRVNTXCJ9O1xuXG5cdFx0aWYocmVjZWl2ZVN0YXJ0IDwgMClcblx0XHRcdHJlY2VpdmVTdGFydCA9IHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY291bnRlclxuXG5cdFx0aWYoY2hhbmdlU3RhcnQgPCAwKVxuXHRcdFx0Y2hhbmdlU3RhcnQgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuY291bnRlclxuXG5cdFx0dGhpcy5zeW5jSW5Qcm9nZ3Jlc3MgPSB0cnVlO1xuXHRcdHRoaXMuZW1pdChcInNjYW4tbW9yZS1hZGRyZXNzZXMtc3RhcnRlZFwiLCB7cmVjZWl2ZVN0YXJ0LCBjaGFuZ2VTdGFydH0pXG5cdFx0bGV0IGVycm9yID0gZmFsc2U7XG5cdFx0bGV0IHJlcyA9IGF3YWl0IHRoaXMuYWRkcmVzc0Rpc2NvdmVyeSh0aGlzLm9wdGlvbnMuYWRkcmVzc0Rpc2NvdmVyeUV4dGVudCwgZGVidWcsIHJlY2VpdmVTdGFydCwgY2hhbmdlU3RhcnQsIGNvdW50KVxuXHRcdC5jYXRjaChlPT57XG5cdFx0XHR0aGlzLmxvZ2dlci5pbmZvKFwiYWRkcmVzc0Rpc2NvdmVyeTplcnJvclwiLCBlKVxuXHRcdFx0ZXJyb3IgPSBlO1xuXHRcdH0pXG5cblx0XHR0aGlzLnN5bmNJblByb2dncmVzcyA9IGZhbHNlO1xuXHRcdGlmKCF0aGlzLnN5bmNPbmNlKVxuXHRcdFx0dGhpcy51dHhvU2V0LnV0eG9TdWJzY3JpYmUoKTtcblx0XHR0aGlzLmVtaXQoXCJzY2FuLW1vcmUtYWRkcmVzc2VzLWVuZGVkXCIsIHtlcnJvcn0pXG5cblx0XHRpZihlcnJvcilcblx0XHRcdHJldHVybiB7ZXJyb3IsIGNvZGU6XCJBRERSRVNTLURJU0NPVkVSWVwifTtcblxuXHRcdGxldCB7aGlnaGVzdEluZGV4PW51bGwsIGVuZFBvaW50cz1udWxsfSA9IHJlc3x8e307XG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhcInNjYW5Nb3JlQWRkcmVzc2VzOmhpZ2hlc3RJbmRleFwiLCBoaWdoZXN0SW5kZXgpXG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhcInNjYW5Nb3JlQWRkcmVzc2VzOmVuZFBvaW50c1wiLCBlbmRQb2ludHMpXG5cblx0XHR0aGlzLmVtaXQoXCJzY2FuLW1vcmUtYWRkcmVzc2VzLWVuZGVkXCIsIHtcblx0XHRcdHJlY2VpdmVGaW5hbDp0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXItMSxcblx0XHRcdGNoYW5nZUZpbmFsOnRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jb3VudGVyLTFcblx0XHR9KVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGNvZGU6XCJTVUNDRVNTXCIsXG5cdFx0XHRyZWNlaXZlOntcblx0XHRcdFx0c3RhcnQ6cmVjZWl2ZVN0YXJ0LFxuXHRcdFx0XHRlbmQ6IGVuZFBvaW50cz8ucmVjZWl2ZXx8cmVjZWl2ZVN0YXJ0K2NvdW50LFxuXHRcdFx0XHRmaW5hbDp0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXItMVxuXHRcdFx0fSxcblx0XHRcdGNoYW5nZTp7XG5cdFx0XHRcdHN0YXJ0OmNoYW5nZVN0YXJ0LFxuXHRcdFx0XHRlbmQ6IGVuZFBvaW50cz8uY2hhbmdlfHxjaGFuZ2VTdGFydCtjb3VudCxcblx0XHRcdFx0ZmluYWw6dGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmNvdW50ZXItMVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogRGVyaXZlcyByZWNlaXZlQWRkcmVzc2VzIGFuZCBjaGFuZ2VBZGRyZXNzZXMgYW5kIGNoZWNrcyB0aGVpciB0cmFuc2FjdGlvbnMgYW5kIFVUWE9zLlxuXHQgKiBAcGFyYW0gdGhyZXNob2xkIHN0b3AgZGlzY292ZXJpbmcgYWZ0ZXIgYHRocmVzaG9sZGAgYWRkcmVzc2VzIHdpdGggbm8gYWN0aXZpdHlcblx0ICovXG5cdGFzeW5jIGFkZHJlc3NEaXNjb3ZlcnkodGhyZXNob2xkID0gNjQsIGRlYnVnID0gZmFsc2UsIHJlY2VpdmVTdGFydD0wLCBjaGFuZ2VTdGFydD0wLCBjb3VudD0wKTogUHJvbWlzZSA8e1xuXHRcdGRlYnVnSW5mbzogTWFwIDxzdHJpbmcsIHt1dHhvczogQXBpLlV0eG9bXSwgYWRkcmVzczogc3RyaW5nfT58bnVsbDtcblx0XHRoaWdoZXN0SW5kZXg6e3JlY2VpdmU6bnVtYmVyLCBjaGFuZ2U6bnVtYmVyfSxcblx0XHRlbmRQb2ludHM6e3JlY2VpdmU6bnVtYmVyLCBjaGFuZ2U6bnVtYmVyfVxuXHR9PiB7XG5cdFx0bGV0IGFkZHJlc3NMaXN0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdGxldCBkZWJ1Z0luZm86IE1hcCA8IHN0cmluZywge3V0eG9zOiBBcGkuVXR4b1tdLCBhZGRyZXNzOiBzdHJpbmd9ID4gfCBudWxsID0gbnVsbDtcblxuXHRcdHRoaXMubG9nZ2VyLmluZm8oYHN5bmMgLi4uIHJ1bm5pbmcgYWRkcmVzcyBkaXNjb3ZlcnksIHRocmVzaG9sZDoke3RocmVzaG9sZH1gKTtcblx0XHRjb25zdCBjYWNoZUluZGV4ZXMgPSB0aGlzLmNhY2hlU3RvcmUuZ2V0QWRkcmVzc0luZGV4ZXMoKT8/e3JlY2VpdmU6MCwgY2hhbmdlOjB9XG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhgc3luYyAuLi5jYWNoZUluZGV4ZXM6IHJlY2VpdmU6JHtjYWNoZUluZGV4ZXMucmVjZWl2ZX0sIGNoYW5nZToke2NhY2hlSW5kZXhlcy5jaGFuZ2V9YCk7XG5cdFx0bGV0IGhpZ2hlc3RJbmRleCA9IHtcblx0XHRcdHJlY2VpdmU6dGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jb3VudGVyLTEsXG5cdFx0XHRjaGFuZ2U6dGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmNvdW50ZXItMVxuXHRcdH1cblx0XHRsZXQgZW5kUG9pbnRzID0ge1xuXHRcdFx0cmVjZWl2ZTowLFxuXHRcdFx0Y2hhbmdlOjBcblx0XHR9XG5cdFx0bGV0IG1heE9mZnNldCA9IHtcblx0XHRcdHJlY2VpdmU6IHJlY2VpdmVTdGFydCArIGNvdW50LFxuXHRcdFx0Y2hhbmdlOiBjaGFuZ2VTdGFydCArIGNvdW50XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9EaXNjb3ZlcnkgPSBhc3luYyhcblx0XHRcdG46bnVtYmVyLCBkZXJpdmVUeXBlOidyZWNlaXZlJ3wnY2hhbmdlJywgb2Zmc2V0Om51bWJlclxuXHRcdCk6IFByb21pc2UgPG51bWJlcj4gPT4ge1xuXG5cdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGBzeW5jIC4uLiBzY2FubmluZyAke29mZnNldH0gLSAke29mZnNldCtufSAke2Rlcml2ZVR5cGV9IGFkZHJlc3Nlc2ApO1xuXHRcdFx0dGhpcy5lbWl0KFwic3luYy1wcm9ncmVzc1wiLCB7XG5cdFx0XHRcdHN0YXJ0Om9mZnNldCxcblx0XHRcdFx0ZW5kOm9mZnNldCtuLFxuXHRcdFx0XHRhZGRyZXNzVHlwZTpkZXJpdmVUeXBlXG5cdFx0XHR9KVxuXHRcdFx0Y29uc3QgZGVyaXZlZEFkZHJlc3NlcyA9IHRoaXMuYWRkcmVzc01hbmFnZXIuZ2V0QWRkcmVzc2VzKG4sIGRlcml2ZVR5cGUsIG9mZnNldCk7XG5cdFx0XHRjb25zdCBhZGRyZXNzZXMgPSBkZXJpdmVkQWRkcmVzc2VzLm1hcCgob2JqKSA9PiBvYmouYWRkcmVzcyk7XG5cdFx0XHRhZGRyZXNzTGlzdCA9IFsuLi5hZGRyZXNzTGlzdCwgLi4uYWRkcmVzc2VzXTtcblx0XHRcdHRoaXMubG9nZ2VyLnZlcmJvc2UoXG5cdFx0XHRcdGAke2Rlcml2ZVR5cGV9OiBhZGRyZXNzIGRhdGEgZm9yIGRlcml2ZWQgaW5kaWNlcyAke2Rlcml2ZWRBZGRyZXNzZXNbMF0uaW5kZXh9Li4ke2Rlcml2ZWRBZGRyZXNzZXNbZGVyaXZlZEFkZHJlc3Nlcy5sZW5ndGgtMV0uaW5kZXh9YFxuXHRcdFx0KTtcblx0XHRcdC8vIGlmICh0aGlzLmxvZ2dlckxldmVsID4gMClcblx0XHRcdC8vIFx0dGhpcy5sb2dnZXIudmVyYm9zZShcImFkZHJlc3NEaXNjb3Zlcnk6IGZpbmRVdHhvcyBmb3IgYWRkcmVzc2VzOjpcIiwgYWRkcmVzc2VzKVxuXHRcdFx0Y29uc3Qge2FkZHJlc3Nlc1dpdGhVVFhPcywgdHhJRDJJbmZvfSA9IGF3YWl0IHRoaXMuZmluZFV0eG9zKGFkZHJlc3NlcywgZGVidWcpO1xuXHRcdFx0aWYgKCFkZWJ1Z0luZm8pXG5cdFx0XHRcdGRlYnVnSW5mbyA9IHR4SUQySW5mbztcblx0XHRcdGlmIChhZGRyZXNzZXNXaXRoVVRYT3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdC8vIGFkZHJlc3MgZGlzY292ZXJ5IGNvbXBsZXRlXG5cdFx0XHRcdGNvbnN0IGxhc3RBZGRyZXNzSW5kZXhXaXRoVHggPSBoaWdoZXN0SW5kZXhbZGVyaXZlVHlwZV07Ly9vZmZzZXQgLSAodGhyZXNob2xkIC0gbikgLSAxO1xuXHRcdFx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKGAke2Rlcml2ZVR5cGV9OiBhZGRyZXNzIGRpc2NvdmVyeSBjb21wbGV0ZWApO1xuXHRcdFx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKGAke2Rlcml2ZVR5cGV9OiBsYXN0IGFjdGl2aXR5IG9uIGFkZHJlc3MgIyR7bGFzdEFkZHJlc3NJbmRleFdpdGhUeH1gKTtcblx0XHRcdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgJHtkZXJpdmVUeXBlfTogbm8gYWN0aXZpdHkgZnJvbSAke29mZnNldH0uLiR7b2Zmc2V0ICsgbn1gKTtcblx0XHRcdFx0aWYob2Zmc2V0ID49IG1heE9mZnNldFtkZXJpdmVUeXBlXSAmJiBvZmZzZXQgPj0gY2FjaGVJbmRleGVzW2Rlcml2ZVR5cGVdKXtcblx0XHRcdFx0XHRlbmRQb2ludHNbZGVyaXZlVHlwZV0gPSBvZmZzZXQrbjtcblx0XHRcdFx0XHRyZXR1cm4gbGFzdEFkZHJlc3NJbmRleFdpdGhUeDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gZWxzZSBrZWVwIGRvaW5nIGRpc2NvdmVyeVxuXHRcdFx0Y29uc3QgaW5kZXggPVxuXHRcdFx0XHRkZXJpdmVkQWRkcmVzc2VzXG5cdFx0XHRcdC5maWx0ZXIoKG9iaikgPT4gYWRkcmVzc2VzV2l0aFVUWE9zLmluY2x1ZGVzKG9iai5hZGRyZXNzKSlcblx0XHRcdFx0LnJlZHVjZSgocHJldiwgY3VyKSA9PiBNYXRoLm1heChwcmV2LCBjdXIuaW5kZXgpLCBoaWdoZXN0SW5kZXhbZGVyaXZlVHlwZV0pO1xuXHRcdFx0aGlnaGVzdEluZGV4W2Rlcml2ZVR5cGVdID0gaW5kZXg7XG5cdFx0XHRyZXR1cm4gZG9EaXNjb3ZlcnkobiwgZGVyaXZlVHlwZSwgb2Zmc2V0ICsgbik7XG5cdFx0fTtcblx0XHRjb25zdCBoaWdoZXN0UmVjZWl2ZUluZGV4ID0gYXdhaXQgZG9EaXNjb3ZlcnkodGhyZXNob2xkLCAncmVjZWl2ZScsIHJlY2VpdmVTdGFydCk7XG5cdFx0Y29uc3QgaGlnaGVzdENoYW5nZUluZGV4ID0gYXdhaXQgZG9EaXNjb3ZlcnkodGhyZXNob2xkLCAnY2hhbmdlJywgY2hhbmdlU3RhcnQpO1xuXHRcdHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuYWR2YW5jZShoaWdoZXN0UmVjZWl2ZUluZGV4ICsgMSk7XG5cdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmFkdmFuY2UoaGlnaGVzdENoYW5nZUluZGV4ICsgMSk7XG5cdFx0dGhpcy5sb2dnZXIudmVyYm9zZShcblx0XHRcdGByZWNlaXZlIGFkZHJlc3MgaW5kZXg6ICR7aGlnaGVzdFJlY2VpdmVJbmRleH07IGNoYW5nZSBhZGRyZXNzIGluZGV4OiAke2hpZ2hlc3RDaGFuZ2VJbmRleH1gLFxuXHRcdFx0YHJlY2VpdmUtYWRkcmVzcy1pbmRleDogJHt0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXJ9OyBjaGFuZ2UgYWRkcmVzcyBpbmRleDogJHt0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuY291bnRlcn1gXG5cdFx0KTtcblxuXHRcdGlmKCF0aGlzLnN5bmNPbmNlICYmICF0aGlzLnN5bmNJblByb2dncmVzcylcblx0XHRcdGF3YWl0IHRoaXMudXR4b1NldC51dHhvU3Vic2NyaWJlKCk7XG5cblx0XHR0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcblx0XHRsZXQgYWRkcmVzc0luZGV4ZXMgPSB7XG5cdFx0XHRyZWNlaXZlOk1hdGgubWF4KGNhY2hlSW5kZXhlcy5yZWNlaXZlLCB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXIpLFxuXHRcdFx0Y2hhbmdlOk1hdGgubWF4KGNhY2hlSW5kZXhlcy5jaGFuZ2UsIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jb3VudGVyKVxuXHRcdH1cblx0XHR0aGlzLmxvZ2dlci5pbmZvKGBzeW5jIC4uLm5ldyBjYWNoZTogcmVjZWl2ZToke2FkZHJlc3NJbmRleGVzLnJlY2VpdmV9LCBjaGFuZ2U6JHthZGRyZXNzSW5kZXhlcy5jaGFuZ2V9YCk7XG5cdFx0dGhpcy5jYWNoZVN0b3JlLnNldEFkZHJlc3NJbmRleGVzKGFkZHJlc3NJbmRleGVzKVxuXHRcdHRoaXMuZW1pdChcInN5bmMtZW5kXCIsIGFkZHJlc3NJbmRleGVzKVxuXHRcdHJldHVybiB7aGlnaGVzdEluZGV4LCBlbmRQb2ludHMsIGRlYnVnSW5mb307XG5cdH1cblxuXHQvLyBUT0RPOiBjb252ZXJ0IGFtb3VudCB0byBzb21waXMgYWthIHNhdG9zaGlzXG5cdC8vIFRPRE86IGJuXG5cdC8qKlxuXHQgKiBDb21wb3NlIGEgc2VyaWFsaXplZCwgc2lnbmVkIHRyYW5zYWN0aW9uXG5cdCAqIEBwYXJhbSBvYmpcblx0ICogQHBhcmFtIG9iai50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FybHNlbnRlc3Q6cXEwZDZoMHByam01bXBkbGQ1cG5jc3QzYWR1MHlhbTZ4Y2g0dHI2OWsyKVxuXHQgKiBAcGFyYW0gb2JqLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLTFMpXG5cdCAqIEBwYXJhbSBvYmouZmVlIEZlZSBmb3IgbWluZXJzIGluIHNvbXBpc1xuXHQgKiBAcGFyYW0gb2JqLmNoYW5nZUFkZHJPdmVycmlkZSBVc2UgdGhpcyB0byBvdmVycmlkZSBhdXRvbWF0aWMgY2hhbmdlIGFkZHJlc3MgZGVyaXZhdGlvblxuXHQgKiBAdGhyb3dzIGlmIGFtb3VudCBpcyBhYm92ZSBgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJgXG5cdCAqL1xuXHRjb21wb3NlVHgoe1xuXHRcdHRvQWRkcixcblx0XHRhbW91bnQsXG5cdFx0ZmVlID0gREVGQVVMVF9GRUUsXG5cdFx0Y2hhbmdlQWRkck92ZXJyaWRlLFxuXHRcdHNraXBTaWduID0gZmFsc2UsXG5cdFx0cHJpdktleXNJbmZvID0gZmFsc2UsXG5cdFx0Y29tcG91bmRpbmdVVFhPID0gZmFsc2UsXG5cdFx0Y29tcG91bmRpbmdVVFhPTWF4Q291bnQgPSBDT01QT1VORF9VVFhPX01BWF9DT1VOVFxuXHR9OiBUeFNlbmQpOiBDb21wb3NlVHhJbmZvIHtcblx0XHQvLyBUT0RPOiBibiFcblx0XHRhbW91bnQgPSBwYXJzZUludChhbW91bnQgYXMgYW55KTtcblx0XHRmZWUgPSBwYXJzZUludChmZWUgYXMgYW55KTtcblx0XHQvLyBpZiAodGhpcy5sb2dnZXJMZXZlbCA+IDApIHtcblx0XHQvLyBcdGZvciAobGV0IGkgPSAwOyBpIDwgMTAwOyBpKyspXG5cdFx0Ly8gXHRcdGNvbnNvbGUubG9nKCdXYWxsZXQgdHJhbnNhY3Rpb24gcmVxdWVzdCBmb3InLCBhbW91bnQsIHR5cGVvZiBhbW91bnQpO1xuXHRcdC8vIH1cblx0XHQvL2lmICghTnVtYmVyLmlzU2FmZUludGVnZXIoYW1vdW50KSkgdGhyb3cgbmV3IEVycm9yKGBBbW91bnQgJHthbW91bnR9IGlzIHRvbyBsYXJnZWApO1xuXHRcdGxldCB1dHhvcywgdXR4b0lkcywgbWFzcztcblx0XHRpZihjb21wb3VuZGluZ1VUWE8pe1xuXHRcdFx0KHt1dHhvcywgdXR4b0lkcywgYW1vdW50LCBtYXNzfSA9IHRoaXMudXR4b1NldC5jb2xsZWN0VXR4b3MoY29tcG91bmRpbmdVVFhPTWF4Q291bnQpKTtcblx0XHR9ZWxzZXtcblx0XHRcdCh7dXR4b3MsIHV0eG9JZHMsIG1hc3N9ID0gdGhpcy51dHhvU2V0LnNlbGVjdFV0eG9zKGFtb3VudCArIGZlZSkpO1xuXHRcdH1cblx0XHQvL2lmKG1hc3MgPiBXYWxsZXQuTWF4TWFzc1VUWE9zKXtcblx0XHQvL1x0dGhyb3cgbmV3IEVycm9yKGBNYXhpbXVtIG51bWJlciBvZiBpbnB1dHMgKFVUWE9zKSByZWFjaGVkLiBQbGVhc2UgcmVkdWNlIHRoaXMgdHJhbnNhY3Rpb24gYW1vdW50LmApO1xuXHRcdC8vfVxuXHRcdGNvbnN0IHByaXZLZXlzID0gdXR4b3MucmVkdWNlKChwcmV2OiBzdHJpbmdbXSwgY3VyOlVuc3BlbnRPdXRwdXQpID0+IHtcblx0XHRcdHJldHVybiBbdGhpcy5hZGRyZXNzTWFuYWdlci5hbGxbU3RyaW5nKGN1ci5hZGRyZXNzKV0sIC4uLnByZXZdIGFzIHN0cmluZ1tdO1xuXHRcdH0sIFtdKTtcblxuXHRcdHRoaXMubG9nZ2VyLmluZm8oXCJ1dHhvcy5sZW5ndGhcIiwgdXR4b3MubGVuZ3RoKVxuXG5cdFx0Y29uc3QgY2hhbmdlQWRkciA9IGNoYW5nZUFkZHJPdmVycmlkZSB8fCB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MubmV4dCgpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB0eDoga2FybHNlbmNvcmUuVHJhbnNhY3Rpb24gPSBuZXcga2FybHNlbmNvcmUuVHJhbnNhY3Rpb24oKVxuXHRcdFx0XHQuZnJvbSh1dHhvcylcblx0XHRcdFx0LnRvKHRvQWRkciwgYW1vdW50KVxuXHRcdFx0XHQuc2V0VmVyc2lvbigwKVxuXHRcdFx0XHQuZmVlKGZlZSlcblx0XHRcdFx0LmNoYW5nZShjaGFuZ2VBZGRyKVxuXHRcdFx0aWYoIXNraXBTaWduKVxuXHRcdFx0XHR0eC5zaWduKHByaXZLZXlzLCBrYXJsc2VuY29yZS5jcnlwdG8uU2lnbmF0dXJlLlNJR0hBU0hfQUxMLCAnc2Nobm9ycicpO1xuXG5cdFx0XHQvL3dpbmRvdy50eHh4eCA9IHR4O1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHg6IHR4LFxuXHRcdFx0XHRpZDogdHguaWQsXG5cdFx0XHRcdHJhd1R4OiB0eC50b1N0cmluZygpLFxuXHRcdFx0XHR1dHhvSWRzLFxuXHRcdFx0XHRhbW91bnQsXG5cdFx0XHRcdGZlZSxcblx0XHRcdFx0dXR4b3MsXG5cdFx0XHRcdHRvQWRkcixcblx0XHRcdFx0cHJpdktleXM6IHByaXZLZXlzSW5mbz9wcml2S2V5czpbXVxuXHRcdFx0fTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhcImNvbXBvc2VUeDplcnJvclwiLCBlKVxuXHRcdFx0Ly8gISEhIEZJWE1FXG5cdFx0XHRpZighY2hhbmdlQWRkck92ZXJyaWRlKVxuXHRcdFx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MucmV2ZXJzZSgpO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH1cblxuXHRtaW5pbXVtUmVxdWlyZWRUcmFuc2FjdGlvblJlbGF5RmVlKG1hc3M6bnVtYmVyKTpudW1iZXJ7XG5cdFx0bGV0IG1pbmltdW1GZWUgPSAobWFzcyAqIHRoaXMub3B0aW9ucy5taW5pbXVtUmVsYXlUcmFuc2FjdGlvbkZlZSkgLyAxMDAwXG5cblx0XHRpZiAobWluaW11bUZlZSA9PSAwICYmIHRoaXMub3B0aW9ucy5taW5pbXVtUmVsYXlUcmFuc2FjdGlvbkZlZSA+IDApIHtcblx0XHRcdG1pbmltdW1GZWUgPSB0aGlzLm9wdGlvbnMubWluaW11bVJlbGF5VHJhbnNhY3Rpb25GZWVcblx0XHR9XG5cblx0XHQvLyBTZXQgdGhlIG1pbmltdW0gZmVlIHRvIHRoZSBtYXhpbXVtIHBvc3NpYmxlIHZhbHVlIGlmIHRoZSBjYWxjdWxhdGVkXG5cdFx0Ly8gZmVlIGlzIG5vdCBpbiB0aGUgdmFsaWQgcmFuZ2UgZm9yIG1vbmV0YXJ5IGFtb3VudHMuXG5cdFx0aWYgKG1pbmltdW1GZWUgPiBNYXhTb21waSkge1xuXHRcdFx0bWluaW11bUZlZSA9IE1heFNvbXBpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1pbmltdW1GZWVcblx0fVxuXG5cdC8qXG5cdHZhbGlkYXRlQWRkcmVzcyhhZGRyOnN0cmluZyk6Ym9vbGVhbntcblx0XHRsZXQgYWRkcmVzcyA9IG5ldyBrYXJsc2VuY29yZS5BZGRyZXNzKGFkZHIpO1xuXHRcdHJldHVybiBhZGRyZXNzLnR5cGUgPT0gXCJwdWJrZXlcIjtcblx0fVxuXHQqL1xuXG5cdC8qKlxuXHQgKiBFc3RpbWF0ZSB0cmFuc2FjdGlvbiBmZWUuIFJldHVybnMgdHJhbnNhY3Rpb24gZGF0YS5cblx0ICogQHBhcmFtIHR4UGFyYW1zXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FybHNlbnRlc3Q6cXEwZDZoMHByam01bXBkbGQ1cG5jc3QzYWR1MHlhbTZ4Y2g0dHI2OWsyKVxuXHQgKiBAcGFyYW0gdHhQYXJhbXMuYW1vdW50IEFtb3VudCB0byBzZW5kIGluIHNvbXBpcyAoMTAwMDAwMDAwICgxZTgpIHNvbXBpcyBpbiAxIEtMUylcblx0ICogQHBhcmFtIHR4UGFyYW1zLmZlZSBGZWUgZm9yIG1pbmVycyBpbiBzb21waXNcblx0ICogQHRocm93cyBgRmV0Y2hFcnJvcmAgaWYgZW5kcG9pbnQgaXMgZG93bi4gQVBJIGVycm9yIG1lc3NhZ2UgaWYgdHggZXJyb3IuIEVycm9yIGlmIGFtb3VudCBpcyB0b28gbGFyZ2UgdG8gYmUgcmVwcmVzZW50ZWQgYXMgYSBqYXZhc2NyaXB0IG51bWJlci5cblx0ICovXG5cdGFzeW5jIGVzdGltYXRlVHJhbnNhY3Rpb24odHhQYXJhbXNBcmc6IFR4U2VuZCk6IFByb21pc2UgPCBUeEluZm8gPiB7XG5cdFx0bGV0IGFkZHJlc3MgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuY3VycmVudC5hZGRyZXNzO1xuXHRcdGlmKCFhZGRyZXNzKXtcblx0XHRcdGFkZHJlc3MgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MubmV4dCgpO1xuXHRcdH1cblx0XHR0eFBhcmFtc0FyZy5jaGFuZ2VBZGRyT3ZlcnJpZGUgPSBhZGRyZXNzO1xuXHRcdHJldHVybiB0aGlzLmNvbXBvc2VUeEFuZE5ldHdvcmtGZWVJbmZvKHR4UGFyYW1zQXJnKTtcblx0fVxuXHRhc3luYyBjb21wb3NlVHhBbmROZXR3b3JrRmVlSW5mbyh0eFBhcmFtc0FyZzogVHhTZW5kKTogUHJvbWlzZSA8IFR4SW5mbyA+e1xuXHRcdGF3YWl0IHRoaXMud2FpdE9yU3luYygpO1xuXHRcdGlmKCF0eFBhcmFtc0FyZy5mZWUpXG5cdFx0XHR0eFBhcmFtc0FyZy5mZWUgPSAwO1xuXHRcdHRoaXMubG9nZ2VyLmluZm8oYHR4IC4uLiBzZW5kaW5nIHRvICR7dHhQYXJhbXNBcmcudG9BZGRyfWApXG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhgdHggLi4uIGFtb3VudDogJHtLTFModHhQYXJhbXNBcmcuYW1vdW50KX0gdXNlciBmZWU6ICR7S0xTKHR4UGFyYW1zQXJnLmZlZSl9IG1heCBkYXRhIGZlZTogJHtLTFModHhQYXJhbXNBcmcubmV0d29ya0ZlZU1heHx8MCl9YClcblxuXHRcdC8vaWYoIXRoaXMudmFsaWRhdGVBZGRyZXNzKHR4UGFyYW1zQXJnLnRvQWRkcikpe1xuXHRcdC8vXHR0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGFkZHJlc3NcIilcblx0XHQvL31cblxuXHRcdGxldCB0eFBhcmFtcyA6IFR4U2VuZCA9IHsgLi4udHhQYXJhbXNBcmcgfSBhcyBUeFNlbmQ7XG5cdFx0Y29uc3QgbmV0d29ya0ZlZU1heCA9IHR4UGFyYW1zLm5ldHdvcmtGZWVNYXggfHwgMDtcblx0XHRsZXQgY2FsY3VsYXRlTmV0d29ya0ZlZSA9ICEhdHhQYXJhbXMuY2FsY3VsYXRlTmV0d29ya0ZlZTtcblx0XHRsZXQgaW5jbHVzaXZlRmVlID0gISF0eFBhcmFtcy5pbmNsdXNpdmVGZWU7XG5cdFx0Y29uc3Qge3NraXBTaWduPXRydWUsIHByaXZLZXlzSW5mbz1mYWxzZX0gPSB0eFBhcmFtcztcblx0XHR0eFBhcmFtcy5za2lwU2lnbiA9IHNraXBTaWduO1xuXHRcdHR4UGFyYW1zLnByaXZLZXlzSW5mbyA9IHByaXZLZXlzSW5mbztcblxuXHRcdC8vY29uc29sZS5sb2coXCJjYWxjdWxhdGVOZXR3b3JrRmVlOlwiLCBjYWxjdWxhdGVOZXR3b3JrRmVlLCBcImluY2x1c2l2ZUZlZTpcIiwgaW5jbHVzaXZlRmVlKVxuXG5cdFx0bGV0IGRhdGEgPSB0aGlzLmNvbXBvc2VUeCh0eFBhcmFtcyk7XG5cdFx0XG5cdFx0bGV0IHt0eFNpemUsIG1hc3N9ID0gZGF0YS50eC5nZXRNYXNzQW5kU2l6ZSgpO1xuXHRcdGxldCBkYXRhRmVlID0gdGhpcy5taW5pbXVtUmVxdWlyZWRUcmFuc2FjdGlvblJlbGF5RmVlKG1hc3MpO1xuXHRcdGNvbnN0IHByaW9yaXR5RmVlID0gdHhQYXJhbXNBcmcuZmVlO1xuXG5cdFx0aWYodHhQYXJhbXNBcmcuY29tcG91bmRpbmdVVFhPKXtcblx0XHRcdGluY2x1c2l2ZUZlZSA9IHRydWU7XG5cdFx0XHRjYWxjdWxhdGVOZXR3b3JrRmVlID0gdHJ1ZTtcblx0XHRcdHR4UGFyYW1zQXJnLmFtb3VudCA9IGRhdGEuYW1vdW50O1xuXHRcdFx0dHhQYXJhbXMuYW1vdW50ID0gZGF0YS5hbW91bnQ7XG5cdFx0XHR0eFBhcmFtcy5jb21wb3VuZGluZ1VUWE8gPSBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCB0eEFtb3VudCA9IHR4UGFyYW1zQXJnLmFtb3VudDtcblx0XHRsZXQgYW1vdW50UmVxdWVzdGVkID0gdHhQYXJhbXNBcmcuYW1vdW50K3ByaW9yaXR5RmVlO1xuXG5cdFx0bGV0IGFtb3VudEF2YWlsYWJsZSA9IGRhdGEudXR4b3MubWFwKHV0eG89PnV0eG8uc2F0b3NoaXMpLnJlZHVjZSgoYSxiKT0+YStiLDApO1xuXHRcdHRoaXMubG9nZ2VyLnZlcmJvc2UoYHR4IC4uLiBuZWVkIGRhdGEgZmVlOiAke0tMUyhkYXRhRmVlKX0gdG90YWwgbmVlZGVkOiAke0tMUyhhbW91bnRSZXF1ZXN0ZWQrZGF0YUZlZSl9YClcblx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKGB0eCAuLi4gYXZhaWxhYmxlOiAke0tMUyhhbW91bnRBdmFpbGFibGUpfSBpbiAke2RhdGEudXR4b3MubGVuZ3RofSBVVFhPc2ApXG5cblx0XHRpZihuZXR3b3JrRmVlTWF4ICYmIGRhdGFGZWUgPiBuZXR3b3JrRmVlTWF4KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEZlZSBtYXggaXMgJHtuZXR3b3JrRmVlTWF4fSBidXQgdGhlIG1pbmltdW0gZmVlIHJlcXVpcmVkIGZvciB0aGlzIHRyYW5zYWN0aW9uIGlzICR7S0xTKGRhdGFGZWUpfSBLTFNgKTtcblx0XHR9XG5cblx0XHRpZihjYWxjdWxhdGVOZXR3b3JrRmVlKXtcblx0XHRcdGRvIHtcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyhgaW5zdWZmaWNpZW50IGRhdGEgZmVlcy4uLiBpbmNyZW1lbnRpbmcgYnkgJHtkYXRhRmVlfWApO1xuXHRcdFx0XHR0eFBhcmFtcy5mZWUgPSBwcmlvcml0eUZlZStkYXRhRmVlO1xuXHRcdFx0XHRpZihpbmNsdXNpdmVGZWUpe1xuXHRcdFx0XHRcdHR4UGFyYW1zLmFtb3VudCA9IHR4QW1vdW50LXR4UGFyYW1zLmZlZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKGB0eCAuLi4gaW5zdWZmaWNpZW50IGRhdGEgZmVlIGZvciB0cmFuc2FjdGlvbiBzaXplIG9mICR7dHhTaXplfSBieXRlc2ApO1xuXHRcdFx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKGB0eCAuLi4gbmVlZCBkYXRhIGZlZTogJHtLTFMoZGF0YUZlZSl9IGZvciAke2RhdGEudXR4b3MubGVuZ3RofSBVVFhPc2ApO1xuXHRcdFx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKGB0eCAuLi4gcmVidWlsZGluZyB0cmFuc2FjdGlvbiB3aXRoIGFkZGl0aW9uYWwgaW5wdXRzYCk7XG5cdFx0XHRcdGxldCB1dHhvTGVuID0gZGF0YS51dHhvcy5sZW5ndGg7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGBmaW5hbCBmZWUgJHt0eFBhcmFtcy5mZWV9YCk7XG5cdFx0XHRcdGRhdGEgPSB0aGlzLmNvbXBvc2VUeCh0eFBhcmFtcyk7XG5cdFx0XHRcdCh7dHhTaXplLCBtYXNzfSA9IGRhdGEudHguZ2V0TWFzc0FuZFNpemUoKSk7XG5cdFx0XHRcdGRhdGFGZWUgPSB0aGlzLm1pbmltdW1SZXF1aXJlZFRyYW5zYWN0aW9uUmVsYXlGZWUobWFzcyk7XG5cdFx0XHRcdGlmKGRhdGEudXR4b3MubGVuZ3RoICE9IHV0eG9MZW4pXG5cdFx0XHRcdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgdHggLi4uIGFnZ3JlZ2F0aW5nOiAke2RhdGEudXR4b3MubGVuZ3RofSBVVFhPc2ApO1xuXG5cdFx0XHR9IHdoaWxlKCghbmV0d29ya0ZlZU1heCB8fCB0eFBhcmFtcy5mZWUgPD0gbmV0d29ya0ZlZU1heCkgJiYgdHhQYXJhbXMuZmVlIDwgZGF0YUZlZStwcmlvcml0eUZlZSk7XG5cblx0XHRcdGlmKG5ldHdvcmtGZWVNYXggJiYgdHhQYXJhbXMuZmVlID4gbmV0d29ya0ZlZU1heClcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBNYXhpbXVtIG5ldHdvcmsgZmVlIGV4Y2VlZGVkOyBuZWVkOiAke0tMUyhkYXRhRmVlKX0gS0xTIG1heGltdW0gaXM6ICR7S0xTKG5ldHdvcmtGZWVNYXgpfSBLTFNgKTtcblxuXHRcdH1lbHNlIGlmKGRhdGFGZWUgPiBwcmlvcml0eUZlZSl7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE1pbmltdW0gZmVlIHJlcXVpcmVkIGZvciB0aGlzIHRyYW5zYWN0aW9uIGlzICR7S0xTKGRhdGFGZWUpfSBLTFNgKTtcblx0XHR9ZWxzZSBpZihpbmNsdXNpdmVGZWUpe1xuXHRcdFx0dHhQYXJhbXMuYW1vdW50IC09IHR4UGFyYW1zLmZlZTtcblx0XHRcdGRhdGEgPSB0aGlzLmNvbXBvc2VUeCh0eFBhcmFtcyk7XG5cdFx0fVxuXG5cdFx0ZGF0YS5kYXRhRmVlID0gZGF0YUZlZTtcblx0XHRkYXRhLnRvdGFsQW1vdW50ID0gdHhQYXJhbXMuZmVlK3R4UGFyYW1zLmFtb3VudDtcblx0XHRkYXRhLnR4U2l6ZSA9IHR4U2l6ZTtcblx0XHRkYXRhLm5vdGUgPSB0eFBhcmFtc0FyZy5ub3RlfHxcIlwiO1xuXG5cdFx0cmV0dXJuIGRhdGEgYXMgVHhJbmZvXG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgYSB0cmFuc2FjdGlvbi4gUmV0dXJucyB0cmFuc2FjdGlvbiBpbmZvLlxuXHQgKiBAcGFyYW0gdHhQYXJhbXNcblx0ICogQHBhcmFtIHR4UGFyYW1zLnRvQWRkciBUbyBhZGRyZXNzIGluIGNhc2hhZGRyIGZvcm1hdCAoZS5nLiBrYXJsc2VudGVzdDpxcTBkNmgwcHJqbTVtcGRsZDVwbmNzdDNhZHUweWFtNnhjaDR0cjY5azIpXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy5hbW91bnQgQW1vdW50IHRvIHNlbmQgaW4gc29tcGlzICgxMDAwMDAwMDAgKDFlOCkgc29tcGlzIGluIDEgS0xTKVxuXHQgKiBAcGFyYW0gdHhQYXJhbXMuZmVlIEZlZSBmb3IgbWluZXJzIGluIHNvbXBpc1xuXHQgKiBAdGhyb3dzIGBGZXRjaEVycm9yYCBpZiBlbmRwb2ludCBpcyBkb3duLiBBUEkgZXJyb3IgbWVzc2FnZSBpZiB0eCBlcnJvci4gRXJyb3IgaWYgYW1vdW50IGlzIHRvbyBsYXJnZSB0byBiZSByZXByZXNlbnRlZCBhcyBhIGphdmFzY3JpcHQgbnVtYmVyLlxuXHQgKi9cblx0YXN5bmMgYnVpbGRUcmFuc2FjdGlvbih0eFBhcmFtc0FyZzogVHhTZW5kLCBkZWJ1ZyA9IGZhbHNlKTogUHJvbWlzZSA8IEJ1aWxkVHhSZXN1bHQgPiB7XG5cdFx0Y29uc3QgdHMwID0gRGF0ZS5ub3coKTtcblx0XHR0eFBhcmFtc0FyZy5za2lwU2lnbiA9IHRydWU7XG5cdFx0dHhQYXJhbXNBcmcucHJpdktleXNJbmZvID0gdHJ1ZTtcblx0XHRjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jb21wb3NlVHhBbmROZXR3b3JrRmVlSW5mbyh0eFBhcmFtc0FyZyk7XG5cdFx0Y29uc3QgeyBcblx0XHRcdGlkLCB0eCwgdXR4b3MsIHV0eG9JZHMsIGFtb3VudCwgdG9BZGRyLFxuXHRcdFx0ZmVlLCBkYXRhRmVlLCB0b3RhbEFtb3VudCwgdHhTaXplLCBub3RlLCBwcml2S2V5c1xuXHRcdH0gPSBkYXRhO1xuXG5cdFx0Y29uc3QgdHNfMCA9IERhdGUubm93KCk7XG5cdFx0dHguc2lnbihwcml2S2V5cywga2FybHNlbmNvcmUuY3J5cHRvLlNpZ25hdHVyZS5TSUdIQVNIX0FMTCwgJ3NjaG5vcnInKTtcblx0XHRjb25zdCB7bWFzczp0eE1hc3N9ID0gdHguZ2V0TWFzc0FuZFNpemUoKTtcblx0XHR0aGlzLmxvZ2dlci5pbmZvKFwidHhNYXNzXCIsIHR4TWFzcylcblx0XHRpZih0eE1hc3MgPiBXYWxsZXQuTWF4TWFzc0FjY2VwdGVkQnlCbG9jayl7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRyYW5zYWN0aW9uIHNpemUvbWFzcyBsaW1pdCByZWFjaGVkLiBQbGVhc2UgcmVkdWNlIHRoaXMgdHJhbnNhY3Rpb24gYW1vdW50LiAoTWFzczogJHt0eE1hc3N9KWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRzXzEgPSBEYXRlLm5vdygpO1xuXHRcdC8vY29uc3QgcmF3VHggPSB0eC50b1N0cmluZygpO1xuXHRcdGNvbnN0IHRzXzIgPSBEYXRlLm5vdygpO1xuXG5cblx0XHR0aGlzLmxvZ2dlci5pbmZvKGB0eCAuLi4gcmVxdWlyZWQgZGF0YSBmZWU6ICR7S0xTKGRhdGFGZWUpfSAoJHt1dHhvcy5sZW5ndGh9IFVUWE9zKWApOy8vICgke0tMUyh0eFBhcmFtc0FyZy5mZWUpfSske0tMUyhkYXRhRmVlKX0pYCk7XG5cdFx0Ly90aGlzLmxvZ2dlci52ZXJib3NlKGB0eCAuLi4gZmluYWwgZmVlOiAke0tMUyhkYXRhRmVlK3R4UGFyYW1zQXJnLmZlZSl9ICgke0tMUyh0eFBhcmFtc0FyZy5mZWUpfSske0tMUyhkYXRhRmVlKX0pYCk7XG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhgdHggLi4uIHJlc3VsdGluZyB0b3RhbDogJHtLTFModG90YWxBbW91bnQpfWApO1xuXG5cblx0XHQvL2NvbnNvbGUubG9nKHV0eG9zKTtcblxuXHRcdGlmIChkZWJ1ZyB8fCB0aGlzLmxvZ2dlckxldmVsID4gMCkge1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoXCJzdWJtaXRUcmFuc2FjdGlvbjogZXN0aW1hdGVUeFwiLCBkYXRhKVxuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoXCJzZW5kVHg6dXR4b3NcIiwgdXR4b3MpXG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhcIjo6dXR4b3NbMF0uc2NyaXB0OjpcIiwgdXR4b3NbMF0uc2NyaXB0KVxuXHRcdFx0Ly9jb25zb2xlLmxvZyhcIjo6dXR4b3NbMF0uYWRkcmVzczo6XCIsIHV0eG9zWzBdLmFkZHJlc3MpXG5cdFx0fVxuXG5cdFx0Y29uc3Qge25Mb2NrVGltZTogbG9ja1RpbWUsIHZlcnNpb24gfSA9IHR4O1xuXG5cdFx0aWYgKGRlYnVnIHx8IHRoaXMubG9nZ2VyTGV2ZWwgPiAwKVxuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoXCJjb21wb3NlVHg6dHhcIiwgXCJ0eFNpemU6XCIsIHR4U2l6ZSlcblxuXHRcdGNvbnN0IHRzXzMgPSBEYXRlLm5vdygpO1xuXHRcdGNvbnN0IGlucHV0czogUlBDLlRyYW5zYWN0aW9uSW5wdXRbXSA9IHR4LmlucHV0cy5tYXAoKGlucHV0OiBrYXJsc2VuY29yZS5UcmFuc2FjdGlvbi5JbnB1dCkgPT4ge1xuXHRcdFx0aWYgKGRlYnVnIHx8IHRoaXMubG9nZ2VyTGV2ZWwgPiAwKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKFwiaW5wdXQuc2NyaXB0Lmluc3BlY3RcIiwgaW5wdXQuc2NyaXB0Lmluc3BlY3QoKSlcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cHJldmlvdXNPdXRwb2ludDoge1xuXHRcdFx0XHRcdHRyYW5zYWN0aW9uSWQ6IGlucHV0LnByZXZUeElkLnRvU3RyaW5nKFwiaGV4XCIpLFxuXHRcdFx0XHRcdGluZGV4OiBpbnB1dC5vdXRwdXRJbmRleFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzaWduYXR1cmVTY3JpcHQ6IGlucHV0LnNjcmlwdC50b0J1ZmZlcigpLnRvU3RyaW5nKFwiaGV4XCIpLFxuXHRcdFx0XHRzZXF1ZW5jZTogaW5wdXQuc2VxdWVuY2VOdW1iZXIsXG5cdFx0XHRcdHNpZ09wQ291bnQ6MVxuXHRcdFx0fTtcblx0XHR9KVxuXHRcdGNvbnN0IHRzXzQgPSBEYXRlLm5vdygpO1xuXHRcdGNvbnN0IG91dHB1dHM6IFJQQy5UcmFuc2FjdGlvbk91dHB1dFtdID0gdHgub3V0cHV0cy5tYXAoKG91dHB1dDoga2FybHNlbmNvcmUuVHJhbnNhY3Rpb24uT3V0cHV0KSA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRhbW91bnQ6IG91dHB1dC5zYXRvc2hpcyxcblx0XHRcdFx0c2NyaXB0UHVibGljS2V5OiB7XG5cdFx0XHRcdFx0c2NyaXB0UHVibGljS2V5OiBvdXRwdXQuc2NyaXB0LnRvQnVmZmVyKCkudG9TdHJpbmcoXCJoZXhcIiksXG5cdFx0XHRcdFx0dmVyc2lvbjogMFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSlcblx0XHRjb25zdCB0c181ID0gRGF0ZS5ub3coKTtcblxuXHRcdC8vY29uc3QgcGF5bG9hZFN0ciA9IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMFwiO1xuXHRcdC8vY29uc3QgcGF5bG9hZCA9IEJ1ZmZlci5mcm9tKHBheWxvYWRTdHIpLnRvU3RyaW5nKFwiYmFzZTY0XCIpO1xuXHRcdC8vY29uc29sZS5sb2coXCJwYXlsb2FkLWhleDpcIiwgQnVmZmVyLmZyb20ocGF5bG9hZFN0cikudG9TdHJpbmcoXCJoZXhcIikpXG5cdFx0Ly9AIHRzLWlnbm9yZVxuXHRcdC8vY29uc3QgcGF5bG9hZEhhc2ggPSBrYXJsc2VuY29yZS5jcnlwdG8uSGFzaC5zaGEyNTZzaGEyNTYoQnVmZmVyLmZyb20ocGF5bG9hZFN0cikpO1xuXHRcdGNvbnN0IHJwY1RYOiBSUEMuU3VibWl0VHJhbnNhY3Rpb25SZXF1ZXN0ID0ge1xuXHRcdFx0dHJhbnNhY3Rpb246IHtcblx0XHRcdFx0dmVyc2lvbixcblx0XHRcdFx0aW5wdXRzLFxuXHRcdFx0XHRvdXRwdXRzLFxuXHRcdFx0XHRsb2NrVGltZSxcblx0XHRcdFx0Ly9wYXlsb2FkOidmMDBmMDAwMDAwMDAwMDAwMDAwMDE5NzZhOTE0Nzg0YmY0YzI1NjJmMzhmZTBjNDlkMWUwNTM4Y2VlNDQxMGQzN2UwOTg4YWMnLFxuXHRcdFx0XHRwYXlsb2FkSGFzaDogJzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAnLFxuXHRcdFx0XHQvL3BheWxvYWRIYXNoOidhZmU3ZmM2ZmUzMjg4ZTc5ZjlhMGMwNWMyMmMxZWFkMmFhZTI5YjZkYTAxOTlkN2I0MzYyOGMyNTg4ZTI5NmY5Jyxcblx0XHRcdFx0Ly9cblx0XHRcdFx0c3VibmV0d29ya0lkOiB0aGlzLnN1Ym5ldHdvcmtJZCwgLy9CdWZmZXIuZnJvbSh0aGlzLnN1Ym5ldHdvcmtJZCwgXCJoZXhcIikudG9TdHJpbmcoXCJiYXNlNjRcIiksXG5cdFx0XHRcdGZlZSxcblx0XHRcdFx0Ly9nYXM6IDBcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL2NvbnN0IHJwY3R4ID0gSlNPTi5zdHJpbmdpZnkocnBjVFgsIG51bGwsIFwiICBcIik7XG5cblx0XHRjb25zdCB0czEgPSBEYXRlLm5vdygpO1xuXHRcdHRoaXMubG9nZ2VyLmluZm8oYHR4IC4uLiBnZW5lcmF0aW9uIHRpbWUgJHsoKHRzMS10czApLzEwMDApLnRvRml4ZWQoMil9IHNlY2ApXG5cblx0XHRpZiAoZGVidWcgfHwgdGhpcy5sb2dnZXJMZXZlbCA+IDApIHtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGBycGNUWCAke0pTT04uc3RyaW5naWZ5KHJwY1RYLCBudWxsLCBcIiAgXCIpfWApXG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhgcnBjVFggJHtKU09OLnN0cmluZ2lmeShycGNUWCl9YClcblx0XHR9XG5cblx0XHRjb25zdCB0c182ID0gRGF0ZS5ub3coKTtcblxuXHRcdHRoaXMubG9nZ2VyLmluZm8oYHRpbWUgaW4gbXNlY2AsIHtcblx0XHRcdFwidG90YWxcIjogdHNfNi10czAsXG5cdFx0XHRcImVzdGltYXRlLXRyYW5zYWN0aW9uXCI6IHRzXzAtdHMwLFxuXHRcdFx0XCJ0eC5zaWduXCI6IHRzXzEtdHNfMCxcblx0XHRcdFwidHgudG9TdHJpbmdcIjogdHNfMi10c18xLFxuXHRcdFx0Ly9cInRzXzMtdHNfMlwiOiB0c18zLXRzXzIsXG5cdFx0XHRcInR4LmlucHV0cy5tYXBcIjogdHNfNC10c18zLFxuXHRcdFx0XCJ0eC5vdXRwdXRzLm1hcFwiOiB0c181LXRzXzQsXG5cdFx0XHQvL1widHNfNi10c181XCI6IHRzXzYtdHNfNVxuXHRcdH0pXG5cblx0XHRpZih0eFBhcmFtc0FyZy5za2lwVVRYT0luVXNlTWFyayAhPT0gdHJ1ZSl7XG5cdFx0XHR0aGlzLnV0eG9TZXQudXBkYXRlVXNlZCh1dHhvcyk7XG5cdFx0fVxuXG5cdFx0Ly9jb25zdCBycGN0eCA9IEpTT04uc3RyaW5naWZ5KHJwY1RYLCBudWxsLCBcIiAgXCIpO1xuXHRcdC8vY29uc29sZS5sb2coXCJycGNUWFwiLCBycGNUWClcblx0XHQvL2NvbnNvbGUubG9nKFwiXFxuXFxuIyMjIyMjIyNycGN0eFxcblwiLCBycGN0eCtcIlxcblxcblxcblwiKVxuXHRcdC8vaWYoYW1vdW50LzFlOCA+IDMpXG5cdFx0Ly9cdHRocm93IG5ldyBFcnJvcihcIlRPRE8gWFhYWFhYXCIpXG5cdFx0cmV0dXJuIHsuLi5kYXRhLCBycGNUWH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTZW5kIGEgdHJhbnNhY3Rpb24uIFJldHVybnMgdHJhbnNhY3Rpb24gaWQuXG5cdCAqIEBwYXJhbSB0eFBhcmFtc1xuXHQgKiBAcGFyYW0gdHhQYXJhbXMudG9BZGRyIFRvIGFkZHJlc3MgaW4gY2FzaGFkZHIgZm9ybWF0IChlLmcuIGthcmxzZW50ZXN0OnFxMGQ2aDBwcmptNW1wZGxkNXBuY3N0M2FkdTB5YW02eGNoNHRyNjlrMilcblx0ICogQHBhcmFtIHR4UGFyYW1zLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLTFMpXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy5mZWUgRmVlIGZvciBtaW5lcnMgaW4gc29tcGlzXG5cdCAqIEB0aHJvd3MgYEZldGNoRXJyb3JgIGlmIGVuZHBvaW50IGlzIGRvd24uIEFQSSBlcnJvciBtZXNzYWdlIGlmIHR4IGVycm9yLiBFcnJvciBpZiBhbW91bnQgaXMgdG9vIGxhcmdlIHRvIGJlIHJlcHJlc2VudGVkIGFzIGEgamF2YXNjcmlwdCBudW1iZXIuXG5cdCAqL1xuXHRhc3luYyBzdWJtaXRUcmFuc2FjdGlvbih0eFBhcmFtc0FyZzogVHhTZW5kLCBkZWJ1ZyA9IGZhbHNlKTogUHJvbWlzZSA8IFR4UmVzcCB8IG51bGwgPiB7XG5cdFx0dHhQYXJhbXNBcmcuc2tpcFVUWE9JblVzZU1hcmsgPSB0cnVlO1xuXG5cdFx0bGV0IHJldmVyc2VDaGFuZ2VBZGRyZXNzID0gZmFsc2U7XG5cdFx0aWYoIXR4UGFyYW1zQXJnLmNoYW5nZUFkZHJPdmVycmlkZSl7XG5cdFx0XHR0eFBhcmFtc0FyZy5jaGFuZ2VBZGRyT3ZlcnJpZGUgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MubmV4dCgpO1xuXHRcdFx0cmV2ZXJzZUNoYW5nZUFkZHJlc3MgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHtcblx0XHRcdHJwY1RYLCB1dHhvSWRzLCBhbW91bnQsIHRvQWRkciwgbm90ZSwgdXR4b3Ncblx0XHR9ID0gYXdhaXQgdGhpcy5idWlsZFRyYW5zYWN0aW9uKHR4UGFyYW1zQXJnLCBkZWJ1Zyk7XG5cblx0XHQvL2NvbnNvbGUubG9nKFwicnBjVFg6XCIsIHJwY1RYKVxuXHRcdC8vdGhyb3cgbmV3IEVycm9yKFwiVE9ETyA6IFhYWFhcIilcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdHMgPSBEYXRlLm5vdygpO1xuXHRcdFx0bGV0IHR4aWQ6IHN0cmluZyA9IGF3YWl0IHRoaXMuYXBpLnN1Ym1pdFRyYW5zYWN0aW9uKHJwY1RYKTtcblx0XHRcdGNvbnN0IHRzMyA9IERhdGUubm93KCk7XG5cdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGB0eCAuLi4gc3VibWlzc2lvbiB0aW1lICR7KCh0czMtdHMpLzEwMDApLnRvRml4ZWQoMil9IHNlY2ApO1xuXHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhgdHhpZDogJHt0eGlkfWApO1xuXHRcdFx0aWYoIXR4aWQpe1xuXHRcdFx0XHRpZihyZXZlcnNlQ2hhbmdlQWRkcmVzcylcblx0XHRcdFx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MucmV2ZXJzZSgpO1xuXHRcdFx0XHRyZXR1cm4gbnVsbDsvLyBhcyBUeFJlc3A7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudXR4b1NldC5pblVzZS5wdXNoKC4uLnV0eG9JZHMpO1xuXHRcdFx0dGhpcy50eFN0b3JlLmFkZCh7XG5cdFx0XHRcdGluOmZhbHNlLCB0cywgaWQ6dHhpZCwgYW1vdW50LCBhZGRyZXNzOnRvQWRkciwgbm90ZSxcblx0XHRcdFx0Ymx1ZVNjb3JlOiB0aGlzLmJsdWVTY29yZSxcblx0XHRcdFx0dHg6cnBjVFgudHJhbnNhY3Rpb24sXG5cdFx0XHRcdG15QWRkcmVzczogdGhpcy5hZGRyZXNzTWFuYWdlci5pc091cih0b0FkZHIpLFxuXHRcdFx0XHRpc0NvaW5iYXNlOiBmYWxzZSxcblx0XHRcdFx0dmVyc2lvbjoyXG5cdFx0XHR9KVxuXHRcdFx0dGhpcy51cGRhdGVEZWJ1Z0luZm8oKTtcblx0XHRcdHRoaXMuZW1pdENhY2hlKClcblx0XHRcdC8qXG5cdFx0XHR0aGlzLnBlbmRpbmdJbmZvLmFkZCh0eGlkLCB7XG5cdFx0XHRcdHJhd1R4OiB0eC50b1N0cmluZygpLFxuXHRcdFx0XHR1dHhvSWRzLFxuXHRcdFx0XHRhbW91bnQsXG5cdFx0XHRcdHRvOiB0b0FkZHIsXG5cdFx0XHRcdGZlZVxuXHRcdFx0fSk7XG5cdFx0XHQqL1xuXHRcdFx0Y29uc3QgcmVzcDogVHhSZXNwID0ge1xuXHRcdFx0XHR0eGlkLFxuXHRcdFx0XHQvL3JwY3R4XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzcDtcblx0XHR9IGNhdGNoIChlOmFueSkge1xuXHRcdFx0aWYocmV2ZXJzZUNoYW5nZUFkZHJlc3MpXG5cdFx0XHRcdHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5yZXZlcnNlKCk7XG5cdFx0XHRpZiAodHlwZW9mIGUuc2V0RXh0cmFEZWJ1Z0luZm8gPT0gXCJmdW5jdGlvblwiKXtcblx0XHRcdFx0bGV0IG1hc3MgPSAwO1xuXHRcdFx0XHRsZXQgc2F0b3NoaXMgPSAwO1xuXHRcdFx0XHRsZXQgbGlzdCA9IHV0eG9zLm1hcCh0eD0+e1xuXHRcdFx0XHRcdG1hc3MgKz0gdHgubWFzcztcblx0XHRcdFx0XHRzYXRvc2hpcyArPSB0eC5zYXRvc2hpcztcblx0XHRcdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgdHgsIHtcblx0XHRcdFx0XHRcdGFkZHJlc3M6dHguYWRkcmVzcy50b1N0cmluZygpLFxuXHRcdFx0XHRcdFx0c2NyaXB0OnR4LnNjcmlwdD8udG9TdHJpbmcoKVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHQvLzg2NTAwLDAwMDAwMDAwXG5cdFx0XHRcdGxldCBpbmZvID0ge1xuXHRcdFx0XHRcdG1hc3MsXG5cdFx0XHRcdFx0c2F0b3NoaXMsXG5cdFx0XHRcdFx0dXR4b0NvdW50OiBsaXN0Lmxlbmd0aCxcblx0XHRcdFx0XHR1dHhvczogbGlzdFxuXHRcdFx0XHR9XG5cdFx0XHRcdGUuc2V0RXh0cmFEZWJ1Z0luZm8oaW5mbylcblx0XHRcdH1cblx0XHRcdHRocm93IGU7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0KiBDb21wb3VuZCBVVFhPcyBieSByZS1zZW5kaW5nIGZ1bmRzIHRvIGl0c2VsZlxuXHQqL1x0XG5cdGFzeW5jIGNvbXBvdW5kVVRYT3ModHhDb21wb3VuZE9wdGlvbnM6VHhDb21wb3VuZE9wdGlvbnM9e30sIGRlYnVnPWZhbHNlKTpQcm9taXNlPFR4UmVzcHxudWxsPiB7XG5cdFx0Y29uc3Qge1xuXHRcdFx0VVRYT01heENvdW50PUNPTVBPVU5EX1VUWE9fTUFYX0NPVU5ULFxuXHRcdFx0bmV0d29ya0ZlZU1heD0wLFxuXHRcdFx0ZmVlPTAsXG5cdFx0XHR1c2VMYXRlc3RDaGFuZ2VBZGRyZXNzPWZhbHNlXG5cdFx0fSA9IHR4Q29tcG91bmRPcHRpb25zO1xuXG5cdFx0Ly9sZXQgdG9BZGRyID0gdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLm5leHQoKVxuXG5cdFx0bGV0IHRvQWRkciA9IHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5hdEluZGV4WzBdO1xuXHRcdC8vY29uc29sZS5sb2coXCJjb21wb3VuZFVUWE9zOiB0byBhZGRyZXNzOlwiLCB0b0FkZHIsIFwidXNlTGF0ZXN0Q2hhbmdlQWRkcmVzczpcIit1c2VMYXRlc3RDaGFuZ2VBZGRyZXNzKVxuXHRcdGlmICh1c2VMYXRlc3RDaGFuZ2VBZGRyZXNzKXtcblx0XHRcdHRvQWRkciA9IHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jdXJyZW50LmFkZHJlc3M7XG5cdFx0fVxuXHRcdGlmKCF0b0FkZHIpe1xuXHRcdFx0dG9BZGRyID0gdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLm5leHQoKTtcblx0XHR9XG5cblx0XHRsZXQgdHhQYXJhbXNBcmcgPSB7XG5cdFx0XHR0b0FkZHIsXG5cdFx0XHRjaGFuZ2VBZGRyT3ZlcnJpZGU6dG9BZGRyLFxuXHRcdFx0YW1vdW50OiAtMSxcblx0XHRcdGZlZSxcblx0XHRcdG5ldHdvcmtGZWVNYXgsXG5cdFx0XHRjb21wb3VuZGluZ1VUWE86dHJ1ZSxcblx0XHRcdGNvbXBvdW5kaW5nVVRYT01heENvdW50OlVUWE9NYXhDb3VudFxuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0bGV0IHJlcyA9IGF3YWl0IHRoaXMuc3VibWl0VHJhbnNhY3Rpb24odHhQYXJhbXNBcmcsIGRlYnVnKTtcblx0XHRcdGlmKCFyZXM/LnR4aWQpXG5cdFx0XHRcdHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5yZXZlcnNlKClcblx0XHRcdHJldHVybiByZXM7XG5cdFx0fWNhdGNoKGUpe1xuXHRcdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLnJldmVyc2UoKTtcblx0XHRcdHRocm93IGU7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0dW5kb1BlbmRpbmdUeChpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qge1x0dXR4b0lkc1x0fSA9IHRoaXMucGVuZGluZ0luZm8udHJhbnNhY3Rpb25zW2lkXTtcblx0XHRkZWxldGUgdGhpcy5wZW5kaW5nSW5mby50cmFuc2FjdGlvbnNbaWRdO1xuXHRcdHRoaXMudXR4b1NldC5yZWxlYXNlKHV0eG9JZHMpO1xuXHRcdHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5yZXZlcnNlKCk7XG5cdFx0dGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG5cdH1cblx0Ki9cblxuXHQvKipcblx0ICogQWZ0ZXIgd2Ugc2VlIHRoZSB0cmFuc2FjdGlvbiBpbiB0aGUgQVBJIHJlc3VsdHMsIGRlbGV0ZSBpdCBmcm9tIG91ciBwZW5kaW5nIGxpc3QuXG5cdCAqIEBwYXJhbSBpZCBUaGUgdHggaGFzaFxuXHQgKi9cblx0IC8qXG5cdGRlbGV0ZVBlbmRpbmdUeChpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Ly8gdW5kbyArIGRlbGV0ZSBvbGQgdXR4b3Ncblx0XHRjb25zdCB7XHR1dHhvSWRzIH0gPSB0aGlzLnBlbmRpbmdJbmZvLnRyYW5zYWN0aW9uc1tpZF07XG5cdFx0ZGVsZXRlIHRoaXMucGVuZGluZ0luZm8udHJhbnNhY3Rpb25zW2lkXTtcblx0XHR0aGlzLnV0eG9TZXQucmVtb3ZlKHV0eG9JZHMpO1xuXHR9XG5cdCovXG5cblx0cnVuU3RhdGVDaGFuZ2VIb29rcygpOiB2b2lkIHtcblx0XHQvL3RoaXMudXR4b1NldC51cGRhdGVVdHhvQmFsYW5jZSgpO1xuXHRcdC8vdGhpcy51cGRhdGVCYWxhbmNlKCk7XG5cdH1cblxuXHQvL1VUWE9zUG9sbGluZ1N0YXJ0ZWQ6Ym9vbGVhbiA9IGZhbHNlO1xuXHRlbWl0ZWRVVFhPczpTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKVxuXHRzdGFydFVUWE9zUG9sbGluZygpe1xuXHRcdC8vaWYgKHRoaXMuVVRYT3NQb2xsaW5nU3RhcnRlZClcblx0XHQvL1x0cmV0dXJuXG5cdFx0Ly90aGlzLlVUWE9zUG9sbGluZ1N0YXJ0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuZW1pdFVUWE9zKCk7XG5cdH1cblxuXHRlbWl0VVRYT3MoKXtcblx0XHRsZXQgY2h1bmtzID0gaGVscGVyLmNodW5rcyhbLi4udGhpcy51dHhvU2V0LnV0eG9zLmNvbmZpcm1lZC52YWx1ZXMoKV0sIDEwMCk7XG5cdFx0Y2h1bmtzID0gY2h1bmtzLmNvbmNhdChoZWxwZXIuY2h1bmtzKFsuLi50aGlzLnV0eG9TZXQudXR4b3MucGVuZGluZy52YWx1ZXMoKV0sIDEwMCkpO1xuXG5cdFx0bGV0IHNlbmQgPSAoKT0+e1xuXHRcdFx0bGV0IHV0eG9zID0gY2h1bmtzLnBvcCgpO1xuXHRcdFx0aWYgKCF1dHhvcylcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHR1dHhvcyA9IHV0eG9zLm1hcCh0eD0+e1xuXHRcdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgdHgsIHtcblx0XHRcdFx0XHRhZGRyZXNzOnR4LmFkZHJlc3MudG9TdHJpbmcoKVxuXHRcdFx0XHR9KVxuXHRcdFx0fSlcblx0XHRcdHRoaXMuZW1pdChcInV0eG8tc3luY1wiLCB7dXR4b3N9KVxuXG5cdFx0XHRoZWxwZXIuZHBjKDIwMCwgc2VuZClcblx0XHR9XG5cblx0XHRzZW5kKCk7XG5cdH1cblxuXHRnZXQgY2FjaGUoKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdC8vcGVuZGluZ1R4OiB0aGlzLnBlbmRpbmdJbmZvLnRyYW5zYWN0aW9ucyxcblx0XHRcdHV0eG9zOiB7XG5cdFx0XHRcdC8vdXR4b1N0b3JhZ2U6IHRoaXMudXR4b1NldC51dHhvU3RvcmFnZSxcblx0XHRcdFx0aW5Vc2U6IHRoaXMudXR4b1NldC5pblVzZSxcblx0XHRcdH0sXG5cdFx0XHQvL3RyYW5zYWN0aW9uc1N0b3JhZ2U6IHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSxcblx0XHRcdGFkZHJlc3Nlczoge1xuXHRcdFx0XHRyZWNlaXZlQ291bnRlcjogdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jb3VudGVyLFxuXHRcdFx0XHRjaGFuZ2VDb3VudGVyOiB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuY291bnRlcixcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cmVzdG9yZUNhY2hlKGNhY2hlOiBXYWxsZXRDYWNoZSk6IHZvaWQge1xuXHRcdC8vdGhpcy5wZW5kaW5nSW5mby50cmFuc2FjdGlvbnMgPSBjYWNoZS5wZW5kaW5nVHg7XG5cdFx0Ly90aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2UgPSBjYWNoZS51dHhvcy51dHhvU3RvcmFnZTtcblx0XHR0aGlzLnV0eG9TZXQuaW5Vc2UgPSBjYWNoZS51dHhvcy5pblVzZTtcblx0XHQvKlxuXHRcdE9iamVjdC5lbnRyaWVzKHRoaXMudXR4b1NldC51dHhvU3RvcmFnZSkuZm9yRWFjaCgoW2FkZHIsIHV0eG9zXTogW3N0cmluZywgQXBpLlV0eG9bXV0pID0+IHtcblx0XHRcdHRoaXMudXR4b1NldC5hZGQodXR4b3MsIGFkZHIpO1xuXHRcdH0pO1xuXHRcdHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSA9IGNhY2hlLnRyYW5zYWN0aW9uc1N0b3JhZ2U7XG5cdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5nZXRBZGRyZXNzZXMoY2FjaGUuYWRkcmVzc2VzLnJlY2VpdmVDb3VudGVyICsgMSwgJ3JlY2VpdmUnKTtcblx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLmdldEFkZHJlc3NlcyhjYWNoZS5hZGRyZXNzZXMuY2hhbmdlQ291bnRlciArIDEsICdjaGFuZ2UnKTtcblx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmFkdmFuY2UoY2FjaGUuYWRkcmVzc2VzLnJlY2VpdmVDb3VudGVyIC0gMSk7XG5cdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmFkdmFuY2UoY2FjaGUuYWRkcmVzc2VzLmNoYW5nZUNvdW50ZXIpO1xuXHRcdC8vdGhpcy50cmFuc2FjdGlvbnMgPSB0eFBhcnNlcih0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UsIE9iamVjdC5rZXlzKHRoaXMuYWRkcmVzc01hbmFnZXIuYWxsKSk7XG5cdFx0dGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG5cdFx0Ki9cblx0fVxuXG5cdC8qKlxuXHQgKiBHZW5lcmF0ZXMgZW5jcnlwdGVkIHdhbGxldCBkYXRhLlxuXHQgKiBAcGFyYW0gcGFzc3dvcmQgdXNlcidzIGNob3NlbiBwYXNzd29yZFxuXHQgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gb2JqZWN0LWxpa2Ugc3RyaW5nLiBTdWdnZXN0ZWQgdG8gc3RvcmUgYXMgc3RyaW5nIGZvciAuaW1wb3J0KCkuXG5cdCAqL1xuXHRhc3luYyBleHBvcnQgKHBhc3N3b3JkOiBzdHJpbmcpOiBQcm9taXNlIDwgc3RyaW5nID4ge1xuXHRcdGNvbnN0IHNhdmVkV2FsbGV0OiBXYWxsZXRTYXZlID0ge1xuXHRcdFx0cHJpdktleTogdGhpcy5IRFdhbGxldC50b1N0cmluZygpLFxuXHRcdFx0c2VlZFBocmFzZTogdGhpcy5tbmVtb25pY1xuXHRcdH07XG5cdFx0cmV0dXJuIENyeXB0by5lbmNyeXB0KHBhc3N3b3JkLCBKU09OLnN0cmluZ2lmeShzYXZlZFdhbGxldCkpO1xuXHR9XG5cblxuXHRsb2dnZXI6IExvZ2dlcjtcblx0bG9nZ2VyTGV2ZWw6IG51bWJlciA9IDA7XG5cdHNldExvZ0xldmVsKGxldmVsOiBzdHJpbmcpIHtcblx0XHR0aGlzLmxvZ2dlci5zZXRMZXZlbChsZXZlbCk7XG5cdFx0dGhpcy5sb2dnZXJMZXZlbCA9IGxldmVsIT0nbm9uZSc/MjowO1xuXHRcdGthcmxzZW5jb3JlLnNldERlYnVnTGV2ZWwobGV2ZWw/MTowKTtcblx0fVxufVxuXG5leHBvcnQge1dhbGxldH1cbiJdfQ==

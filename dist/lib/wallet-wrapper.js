"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletWrapper = exports.initPugdagFramework = exports.COINBASE_CFM_COUNT = exports.CONFIRMATION_COUNT = exports.workerLog = void 0;
//@ts-ignore
const IS_NODE_CLI = typeof window == 'undefined';
const logger_1 = require("./logger");
Object.defineProperty(exports, "workerLog", { enumerable: true, get: function () { return logger_1.workerLog; } });
const wallet_1 = require("@pugdag/wallet");
Object.defineProperty(exports, "CONFIRMATION_COUNT", { enumerable: true, get: function () { return wallet_1.CONFIRMATION_COUNT; } });
Object.defineProperty(exports, "COINBASE_CFM_COUNT", { enumerable: true, get: function () { return wallet_1.COINBASE_CFM_COUNT; } });
const { HDPrivateKey } = wallet_1.pugdagcore;
let Worker_ = IS_NODE_CLI ? require('@aspectron/web-worker') : Worker;
logger_1.workerLog.info("Worker:", (Worker_ + "").substr(0, 32) + "....");
const rpc_1 = require("./rpc");
let worker, workerReady = wallet_1.helper.Deferred();
let onWorkerMessage = (op, data) => {
    logger_1.workerLog.info("abstract onWorkerMessage");
};
const initPugdagFramework = (opt = {}) => {
    return new Promise((resolve, reject) => {
        wallet_1.helper.dpc(2000, () => {
            let url, baseURL;
            if (IS_NODE_CLI) {
                baseURL = 'file://' + __dirname + '/';
                url = new URL('worker.js', baseURL);
            }
            else {
                baseURL = window.location.origin;
                let { workerPath = "/node_modules/@pugdag/wallet-worker/worker.js" } = opt;
                url = new URL(workerPath, baseURL);
            }
            logger_1.workerLog.info("initPugdagFramework", url, baseURL);
            try {
                worker = new Worker_(url, { type: 'module' });
            }
            catch (e) {
                logger_1.workerLog.info("Worker error", e);
            }
            logger_1.workerLog.info("worker instance created", worker + "");
            worker.onmessage = (msg) => {
                const { op, data } = msg.data;
                if (op == 'ready') {
                    logger_1.workerLog.info("worker.onmessage", op, data);
                    workerReady.resolve();
                    resolve();
                    return;
                }
                onWorkerMessage(op, data);
            };
        });
    });
};
exports.initPugdagFramework = initPugdagFramework;
class WalletWrapper extends wallet_1.EventTargetImpl {
    static checkPasswordValidity(password, encryptedMnemonic) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const decrypted = yield this.Crypto.decrypt(password, encryptedMnemonic);
                const savedWallet = JSON.parse(decrypted);
                return !!(savedWallet === null || savedWallet === void 0 ? void 0 : savedWallet.privKey);
            }
            catch (e) {
                return false;
            }
        });
    }
    static setWorkerLogLevel(level) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.workerLog.setLevel(level);
            yield workerReady;
            yield this.postMessage('worker-log-level', { level });
        });
    }
    static postMessage(op, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (op != "wallet-init") {
                logger_1.workerLog.info(`postMessage:: ${op}, ${JSON.stringify(data)}`);
            }
            //@ts-ignore
            worker.postMessage({ op, data });
        });
    }
    static fromMnemonic(seedPhrase, networkOptions, options = {}) {
        if (!networkOptions || !networkOptions.network)
            throw new Error(`fromMnemonic(seedPhrase,networkOptions): missing network argument`);
        const privKey = new wallet_1.Wallet.Mnemonic(seedPhrase.trim()).toHDPrivateKey().toString();
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
            const decrypted = yield wallet_1.Wallet.passwordHandler.decrypt(password, encryptedMnemonic);
            const savedWallet = JSON.parse(decrypted);
            const myWallet = new this(savedWallet.privKey, savedWallet.seedPhrase, networkOptions, options);
            return myWallet;
        });
    }
    constructor(privKey, seedPhrase, networkOptions, options = {}) {
        var _a;
        super();
        this.isWorkerReady = false;
        this._pendingCB = new Map();
        this.workerReady = workerReady;
        this.balance = { available: 0, pending: 0, total: 0 };
        this._rid2subUid = new Map();
        this.grpcFlags = {};
        let { rpc } = networkOptions;
        if (rpc) {
            this.rpc = rpc;
            if (options.checkGRPCFlags) {
                this.checkGRPCFlags();
            }
        }
        delete networkOptions.rpc;
        if (privKey && seedPhrase) {
            this.HDWallet = new wallet_1.pugdagcore.HDPrivateKey(privKey);
        }
        else {
            const temp = new wallet_1.Wallet.Mnemonic(wallet_1.Wallet.Mnemonic.Words.ENGLISH);
            this.HDWallet = new wallet_1.pugdagcore.HDPrivateKey(temp.toHDPrivateKey().toString());
        }
        this.uid = this.createUID(networkOptions.network);
        //@ts-ignore
        (_a = rpc === null || rpc === void 0 ? void 0 : rpc.setStreamUid) === null || _a === void 0 ? void 0 : _a.call(rpc, this.uid);
        console.log("wallet.uid", this.uid);
        this.initWorker();
        this.initWallet(privKey, seedPhrase, networkOptions, options);
    }
    checkGRPCFlags() {
        const { rpc } = this;
        if (!rpc)
            return;
        this.grpcFlagsSyncSignal = wallet_1.helper.Deferred();
        rpc.onConnect(() => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            //console.log("#####rpc onConnect#######")
            let result = yield rpc.getUtxosByAddresses([])
                .catch((err) => {
                //error = err;
            });
            if (result) {
                this.grpcFlags.utxoIndex = !((_b = (_a = result.error) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.includes('--utxoindex'));
                this.emit("grpc-flags", this.grpcFlags);
            }
            (_c = this.grpcFlagsSyncSignal) === null || _c === void 0 ? void 0 : _c.resolve();
        }));
    }
    createUID(network) {
        const { privateKey } = this.HDWallet.deriveChild(`m/44'/972/0'/1'/0'`);
        let address = privateKey.toAddress(network).toString().split(":")[1];
        return wallet_1.helper.sha256(address);
    }
    initWallet(privKey, seedPhrase, networkOptions, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workerReady;
            this.postMessage('wallet-init', {
                privKey,
                seedPhrase,
                networkOptions,
                options
            });
        });
    }
    initWorker() {
        if (!worker)
            throw new Error("Please init pugdag framework using 'await initPugdagFramework();'.");
        this.worker = worker;
        onWorkerMessage = (op, data) => {
            //if(op != 'rpc-request'){
            //if (data?.fn != "mnemonic"){
            //workerLog.info(`onWorkerMessage: ${op}, ${JSON.stringify(data)}`)
            //}
            //}
            switch (op) {
                case 'rpc-request':
                    return this.handleRPCRequest(data);
                case 'wallet-response':
                    return this.handleResponse(data);
                case 'wallet-events':
                    return this.handleEvents(data);
                case 'wallet-property':
                    return this.handleProperty(data);
            }
        };
    }
    handleProperty(msg) {
        //@ts-ignore
        this[name] = value;
    }
    handleEvents(msg) {
        let { name, data } = msg;
        if (name == 'balance-update') {
            this.balance = data;
        }
        this.emit(name, data);
    }
    handleResponse(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            let { rid, error, result } = msg;
            let item = this._pendingCB.get(rid);
            if (!item)
                return;
            item.cb(error, result);
            this._pendingCB.delete(rid);
        });
    }
    handleRPCRequest(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.workerLog.debug(`RPCRequest: ${JSON.stringify(msg)}`);
            const { fn, args, rid } = msg;
            const utxoRelatedFns = [
                'notifyUtxosChangedRequest',
                'getUtxosByAddressesRequest',
                'stopNotifyingUtxosChangedRequest'
            ];
            //console.log("fnfn", fn, args[0])
            if (args[0] && utxoRelatedFns.includes(args[0]) && this.grpcFlagsSyncSignal) {
                yield this.grpcFlagsSyncSignal;
                if (!this.grpcFlags.utxoIndex) {
                    this.postMessage("rpc-response", {
                        rid,
                        result: {
                            error: {
                                errorCode: "UTXOINDEX-FLAG-MISSING",
                                message: "UTXOINDEX FLAG ISSUE"
                            }
                        }
                    });
                    return;
                }
            }
            if (fn == "unSubscribe") {
                if (args[1]) {
                    args[1] = this._rid2subUid.get(args[1]); //rid to subid
                    if (!args[1])
                        return;
                }
                //@ts-ignore
                this.rpc.unSubscribe(...args);
                return;
            }
            let directFns = [
                'onConnect', 'onDisconnect', 'onConnectFailure', 'onError',
                'disconnect', 'connect'
            ];
            if (directFns.includes(fn)) {
                if (rid) {
                    args.push((result) => {
                        this.postMessage("rpc-direct", { rid, result });
                    });
                }
                //@ts-ignore
                this.rpc[fn](...args);
                return;
            }
            if (fn == 'subscribe') {
                args.push((result) => {
                    this.postMessage("rpc-publish", { method: args[0], rid, result });
                });
            }
            //@ts-ignore
            let p = this.rpc[fn](...args);
            let { uid: subUid } = p;
            let error;
            let result = yield p
                .catch((err) => {
                error = err;
            });
            if (fn == 'subscribe' && rid) {
                this._rid2subUid.set(rid, subUid);
            }
            this.postMessage("rpc-response", { rid, result, error });
        });
    }
    postMessage(op, data) {
        WalletWrapper.postMessage(op, data);
    }
    request(fn, args, callback = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workerReady;
            let rid = undefined;
            if (callback) {
                rid = this.createPendingCall(callback);
            }
            logger_1.workerLog.debug(`wallet-request: ${fn}, ${JSON.stringify(args)},  ${rid}`);
            this.worker.postMessage({ op: "wallet-request", data: { fn, args, rid } });
        });
    }
    requestPromisify(fn, ...args) {
        return new Promise((resolve, reject) => {
            this.request(fn, args, (error, result) => {
                if (error)
                    return reject(error);
                resolve(result);
            });
        });
    }
    createPendingCall(cb) {
        const uid = (0, rpc_1.UID)();
        this._pendingCB.set(uid, { uid, cb });
        return uid;
    }
    sync(syncOnce = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            this.syncSignal = wallet_1.helper.Deferred();
            let args = [];
            if (syncOnce !== undefined)
                args.push(syncOnce);
            this.request("sync", args, () => {
                var _a;
                (_a = this.syncSignal) === null || _a === void 0 ? void 0 : _a.resolve();
            });
            return this.syncSignal;
        });
    }
    setLogLevel(level) {
        this.request("setLogLevel", [level]);
    }
    startUTXOsPolling() {
        this.request("startUTXOsPolling", []);
    }
    get(name, waitForSync = false) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if (waitForSync)
                yield this.syncSignal;
            this.request(name, [], (error, result) => {
                if (error)
                    return reject(error);
                resolve(result);
            });
        }));
    }
    getAfterSync(name) {
        return this.get(name, true);
    }
    get mnemonic() {
        return this.get("mnemonic");
    }
    get receiveAddress() {
        return this.getAfterSync("receiveAddress");
    }
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. pugdagtest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KLS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    submitTransaction(txParamsArg, debug = false) {
        return this.requestPromisify("submitTransaction", txParamsArg, debug);
    }
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. pugdagtest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KLS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    estimateTransaction(txParamsArg) {
        return this.requestPromisify("estimateTransaction", txParamsArg);
    }
    /**
     * Update transcations time
     */
    startUpdatingTransactions(version = undefined) {
        return this.requestPromisify("startUpdatingTransactions", version);
    }
    /**
    * Compound UTXOs by re-sending funds to itself
    */
    compoundUTXOs(txCompoundOptions = {}, debug = false) {
        return this.requestPromisify("compoundUTXOs", txCompoundOptions, debug);
    }
    scanMoreAddresses(count = 100, debug = false, receiveStart = -1, changeStart = -1) {
        return this.requestPromisify("scanMoreAddresses", count, debug, receiveStart, changeStart);
    }
    /**
     * Generates encrypted wallet data.
     * @param password user's chosen password
     * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
     */
    export(password) {
        return this.requestPromisify("export", password);
    }
    restoreCache(cache) {
        this.request("restoreCache", [cache]);
    }
    clearUsedUTXOs() {
        this.request("clearUsedUTXOs", []);
    }
}
exports.WalletWrapper = WalletWrapper;
WalletWrapper.networkTypes = wallet_1.Wallet.networkTypes;
WalletWrapper.KLS = wallet_1.Wallet.KLS;
WalletWrapper.networkAliases = wallet_1.Wallet.networkAliases;
WalletWrapper.Mnemonic = wallet_1.Wallet.Mnemonic;
WalletWrapper.Crypto = wallet_1.Wallet.Crypto;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FsbGV0LXdyYXBwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvd2FsbGV0LXdyYXBwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEsWUFBWTtBQUNaLE1BQU0sV0FBVyxHQUFHLE9BQU8sTUFBTSxJQUFJLFdBQVcsQ0FBQztBQUNqRCxxQ0FBbUM7QUFJM0IsMEZBSkEsa0JBQVMsT0FJQTtBQUhqQiw0Q0FBcUg7QUFHbEcsbUdBSG1DLDJCQUFrQixPQUduQztBQUFFLG1HQUhtQywyQkFBa0IsT0FHbkM7QUFGekQsTUFBTSxFQUFDLFlBQVksRUFBQyxHQUFHLG9CQUFXLENBQUM7QUFJbkMsSUFBSSxPQUFPLEdBQUcsV0FBVyxDQUFBLENBQUMsQ0FBQSxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQSxDQUFDLENBQUEsTUFBTSxDQUFDO0FBQ2xFLGtCQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sR0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFDLE1BQU0sQ0FBQyxDQUFBO0FBRzVELCtCQUFrQztBQUdsQyxJQUFJLE1BQWEsRUFBRSxXQUFXLEdBQTBCLGVBQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUcxRSxJQUFJLGVBQWUsR0FBRyxDQUFDLEVBQVMsRUFBRSxJQUFRLEVBQUMsRUFBRTtJQUM1QyxrQkFBUyxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFBO0FBQzNDLENBQUMsQ0FBQTtBQUVNLE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxNQUF5QixFQUFFLEVBQUMsRUFBRTtJQUNsRSxPQUFPLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBQyxFQUFFO1FBQzNDLGVBQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUUsRUFBRTtZQUdwQixJQUFJLEdBQUcsRUFBRSxPQUFPLENBQUM7WUFD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R0FBQyxDQUFDLENBQUM7UUFDeEUsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQXVCLG1CQUFtQixFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ2xILENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsTUFBTSxDQUFFLFFBQWdCO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFTLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQTtJQUN6RCxDQUFDO0lBRUQsWUFBWSxDQUFDLEtBQWtCO1FBQzlCLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtJQUN0QyxDQUFDO0lBQ0QsY0FBYztRQUNiLElBQUksQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxDQUFDLENBQUE7SUFDbkMsQ0FBQzs7QUFJTSxzQ0FBYTtBQXRZYiwwQkFBWSxHQUFDLGVBQU0sQ0FBQyxZQUFZLEFBQXBCLENBQXFCO0FBQ2pDLGlCQUFHLEdBQUMsZUFBTSxDQUFDLEdBQUcsQUFBWCxDQUFZO0FBQ2YsNEJBQWMsR0FBQyxlQUFNLENBQUMsY0FBYyxBQUF0QixDQUF1QjtBQUNyQyxzQkFBUSxHQUFDLGVBQU0sQ0FBQyxRQUFRLEFBQWhCLENBQWlCO0FBQ3pCLG9CQUFNLEdBQUMsZUFBTSxDQUFDLE1BQU0sQUFBZCxDQUFlIiwic291cmNlc0NvbnRlbnQiOlsiLy9AdHMtaWdub3JlXG5jb25zdCBJU19OT0RFX0NMSSA9IHR5cGVvZiB3aW5kb3cgPT0gJ3VuZGVmaW5lZCc7XG5pbXBvcnQge3dvcmtlckxvZ30gZnJvbSAnLi9sb2dnZXInO1xuaW1wb3J0IHtXYWxsZXQsIEV2ZW50VGFyZ2V0SW1wbCwgaGVscGVyLCBrYXJsc2VuY29yZSwgQ09ORklSTUFUSU9OX0NPVU5ULCBDT0lOQkFTRV9DRk1fQ09VTlR9IGZyb20gJ0BrYXJsc2VuL3dhbGxldCc7XG5jb25zdCB7SERQcml2YXRlS2V5fSA9IGthcmxzZW5jb3JlO1xuXG5leHBvcnQge3dvcmtlckxvZywgQ09ORklSTUFUSU9OX0NPVU5ULCBDT0lOQkFTRV9DRk1fQ09VTlR9O1xuXG5sZXQgV29ya2VyXyA9IElTX05PREVfQ0xJP3JlcXVpcmUoJ0Bhc3BlY3Ryb24vd2ViLXdvcmtlcicpOldvcmtlcjtcbndvcmtlckxvZy5pbmZvKFwiV29ya2VyOlwiLCAoV29ya2VyXytcIlwiKS5zdWJzdHIoMCwgMzIpK1wiLi4uLlwiKVxuXG5cbmltcG9ydCB7VUlELCBDQkl0ZW19IGZyb20gJy4vcnBjJztcblxuXG5sZXQgd29ya2VyOldvcmtlciwgd29ya2VyUmVhZHk6aGVscGVyLkRlZmVycmVkUHJvbWlzZSA9IGhlbHBlci5EZWZlcnJlZCgpO1xuXG5cbmxldCBvbldvcmtlck1lc3NhZ2UgPSAob3A6c3RyaW5nLCBkYXRhOmFueSk9Pntcblx0d29ya2VyTG9nLmluZm8oXCJhYnN0cmFjdCBvbldvcmtlck1lc3NhZ2VcIilcbn1cblxuZXhwb3J0IGNvbnN0IGluaXRLYXJsc2VuRnJhbWV3b3JrID0gKG9wdDp7d29ya2VyUGF0aD86c3RyaW5nfT17fSk9Pntcblx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpPT57XG5cdFx0aGVscGVyLmRwYygyMDAwLCAoKT0+e1xuXHRcdFx0XG5cdFx0XHRcblx0XHRcdGxldCB1cmwsIGJhc2VVUkw7XG5cdFx0XHRpZihJU19OT0RFX0NMSSl7XG5cdFx0XHRcdGJhc2VVUkwgPSAnZmlsZTovLycrX19kaXJuYW1lKycvJ1xuXHRcdFx0XHR1cmwgPSBuZXcgVVJMKCd3b3JrZXIuanMnLCBiYXNlVVJMKVxuXHRcdFx0fVxuXHRcdFx0ZWxzZXtcblx0XHRcdFx0YmFzZVVSTCA9IHdpbmRvdy5sb2NhdGlvbi5vcmlnaW47XG5cdFx0XHRcdGxldCB7XG5cdFx0XHRcdFx0d29ya2VyUGF0aD1cIi9ub2RlX21vZHVsZXMvQGthcmxzZW4vd2FsbGV0LXdvcmtlci93b3JrZXIuanNcIlxuXHRcdFx0XHR9ID0gb3B0XG5cdFx0XHRcdHVybCA9IG5ldyBVUkwod29ya2VyUGF0aCwgYmFzZVVSTCk7XG5cdFx0XHR9XG5cdFx0XHR3b3JrZXJMb2cuaW5mbyhcImluaXRLYXJsc2VuRnJhbWV3b3JrXCIsIHVybCwgYmFzZVVSTClcblxuXHRcdFx0dHJ5e1xuXHRcdFx0XHR3b3JrZXIgPSBuZXcgV29ya2VyXyh1cmwsIHt0eXBlOidtb2R1bGUnfSk7XG5cdFx0XHR9Y2F0Y2goZSl7XG5cdFx0XHRcdHdvcmtlckxvZy5pbmZvKFwiV29ya2VyIGVycm9yXCIsIGUpXG5cdFx0XHR9XG5cblx0XHRcdHdvcmtlckxvZy5pbmZvKFwid29ya2VyIGluc3RhbmNlIGNyZWF0ZWRcIiwgd29ya2VyK1wiXCIpXG5cblx0XHRcdHdvcmtlci5vbm1lc3NhZ2UgPSAobXNnOntkYXRhOntvcDpzdHJpbmcsIGRhdGE6YW55fX0pPT57XG5cdFx0XHRcdGNvbnN0IHtvcCwgZGF0YX0gPSBtc2cuZGF0YTtcblx0XHRcdFx0aWYob3A9PSdyZWFkeScpe1xuXHRcdFx0XHRcdHdvcmtlckxvZy5pbmZvKFwid29ya2VyLm9ubWVzc2FnZVwiLCBvcCwgZGF0YSlcblx0XHRcdFx0XHR3b3JrZXJSZWFkeS5yZXNvbHZlKCk7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHR9XG5cdFx0XHRcdG9uV29ya2VyTWVzc2FnZShvcCwgZGF0YSk7XG5cdFx0XHR9XG5cdFx0fSlcblx0fSlcbn1cblxuXG5pbXBvcnQge1xuXHROZXR3b3JrLCBOZXR3b3JrT3B0aW9ucywgU2VsZWN0ZWROZXR3b3JrLCBXYWxsZXRTYXZlLCBBcGksIFR4U2VuZCwgVHhSZXNwLFxuXHRQZW5kaW5nVHJhbnNhY3Rpb25zLCBXYWxsZXRDYWNoZSwgSVJQQywgUlBDLCBXYWxsZXRPcHRpb25zLFx0V2FsbGV0T3B0LCBUeEluZm8sXG5cdFR4Q29tcG91bmRPcHRpb25zLCBTY2FuZU1vcmVSZXN1bHRcbn0gZnJvbSAnQGthcmxzZW4vd2FsbGV0L3R5cGVzL2N1c3RvbS10eXBlcyc7XG5cbmNsYXNzIFdhbGxldFdyYXBwZXIgZXh0ZW5kcyBFdmVudFRhcmdldEltcGx7XG5cblx0c3RhdGljIG5ldHdvcmtUeXBlcz1XYWxsZXQubmV0d29ya1R5cGVzO1xuXHRzdGF0aWMgS0xTPVdhbGxldC5LTFM7XG5cdHN0YXRpYyBuZXR3b3JrQWxpYXNlcz1XYWxsZXQubmV0d29ya0FsaWFzZXM7XG5cdHN0YXRpYyBNbmVtb25pYz1XYWxsZXQuTW5lbW9uaWM7XG5cdHN0YXRpYyBDcnlwdG89V2FsbGV0LkNyeXB0bztcblxuXHRzdGF0aWMgYXN5bmMgY2hlY2tQYXNzd29yZFZhbGlkaXR5KHBhc3N3b3JkOnN0cmluZywgZW5jcnlwdGVkTW5lbW9uaWM6IHN0cmluZyl7XG5cdFx0dHJ5e1xuXHRcdFx0Y29uc3QgZGVjcnlwdGVkID0gYXdhaXQgdGhpcy5DcnlwdG8uZGVjcnlwdChwYXNzd29yZCwgZW5jcnlwdGVkTW5lbW9uaWMpO1xuXHRcdFx0Y29uc3Qgc2F2ZWRXYWxsZXQgPSBKU09OLnBhcnNlKGRlY3J5cHRlZCkgYXMgV2FsbGV0U2F2ZTtcblx0XHRcdHJldHVybiAhIXNhdmVkV2FsbGV0Py5wcml2S2V5O1xuXHRcdH1jYXRjaChlKXtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgYXN5bmMgc2V0V29ya2VyTG9nTGV2ZWwobGV2ZWw6c3RyaW5nKXtcblx0XHR3b3JrZXJMb2cuc2V0TGV2ZWwobGV2ZWwpO1xuXHRcdGF3YWl0IHdvcmtlclJlYWR5O1xuXHRcdGF3YWl0IHRoaXMucG9zdE1lc3NhZ2UoJ3dvcmtlci1sb2ctbGV2ZWwnLCB7bGV2ZWx9KTtcblx0fVxuXG5cdHN0YXRpYyBhc3luYyBwb3N0TWVzc2FnZShvcDpzdHJpbmcsIGRhdGE6YW55KXtcblx0XHRpZiAob3AhPVwid2FsbGV0LWluaXRcIil7XG5cdFx0XHR3b3JrZXJMb2cuaW5mbyhgcG9zdE1lc3NhZ2U6OiAke29wfSwgJHtKU09OLnN0cmluZ2lmeShkYXRhKX1gKVxuXHRcdH1cblx0XHQvL0B0cy1pZ25vcmVcblx0XHR3b3JrZXIucG9zdE1lc3NhZ2Uoe29wLCBkYXRhfSlcblx0fVxuXG5cdHN0YXRpYyBmcm9tTW5lbW9uaWMoc2VlZFBocmFzZTogc3RyaW5nLCBuZXR3b3JrT3B0aW9uczogTmV0d29ya09wdGlvbnMsIG9wdGlvbnM6IFdhbGxldE9wdGlvbnMgPSB7fSk6IFdhbGxldFdyYXBwZXIge1xuXHRcdGlmICghbmV0d29ya09wdGlvbnMgfHwgIW5ldHdvcmtPcHRpb25zLm5ldHdvcmspXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGZyb21NbmVtb25pYyhzZWVkUGhyYXNlLG5ldHdvcmtPcHRpb25zKTogbWlzc2luZyBuZXR3b3JrIGFyZ3VtZW50YCk7XG5cdFx0Y29uc3QgcHJpdktleSA9IG5ldyBXYWxsZXQuTW5lbW9uaWMoc2VlZFBocmFzZS50cmltKCkpLnRvSERQcml2YXRlS2V5KCkudG9TdHJpbmcoKTtcblx0XHRjb25zdCB3YWxsZXQgPSBuZXcgdGhpcyhwcml2S2V5LCBzZWVkUGhyYXNlLCBuZXR3b3JrT3B0aW9ucywgb3B0aW9ucyk7XG5cdFx0cmV0dXJuIHdhbGxldDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IFdhbGxldCBmcm9tIGVuY3J5cHRlZCB3YWxsZXQgZGF0YS5cblx0ICogQHBhcmFtIHBhc3N3b3JkIHRoZSBwYXNzd29yZCB0aGUgdXNlciBlbmNyeXB0ZWQgdGhlaXIgc2VlZCBwaHJhc2Ugd2l0aFxuXHQgKiBAcGFyYW0gZW5jcnlwdGVkTW5lbW9uaWMgdGhlIGVuY3J5cHRlZCBzZWVkIHBocmFzZSBmcm9tIGxvY2FsIHN0b3JhZ2Vcblx0ICogQHRocm93cyBXaWxsIHRocm93IFwiSW5jb3JyZWN0IHBhc3N3b3JkXCIgaWYgcGFzc3dvcmQgaXMgd3Jvbmdcblx0ICovXG5cdHN0YXRpYyBhc3luYyBpbXBvcnQgKHBhc3N3b3JkOiBzdHJpbmcsIGVuY3J5cHRlZE1uZW1vbmljOiBzdHJpbmcsIG5ldHdvcmtPcHRpb25zOiBOZXR3b3JrT3B0aW9ucywgb3B0aW9uczogV2FsbGV0T3B0aW9ucyA9IHt9KTogUHJvbWlzZSA8IFdhbGxldFdyYXBwZXIgPiB7XG5cdFx0Y29uc3QgZGVjcnlwdGVkID0gYXdhaXQgV2FsbGV0LnBhc3N3b3JkSGFuZGxlci5kZWNyeXB0KHBhc3N3b3JkLCBlbmNyeXB0ZWRNbmVtb25pYyk7XG5cdFx0Y29uc3Qgc2F2ZWRXYWxsZXQgPSBKU09OLnBhcnNlKGRlY3J5cHRlZCkgYXMgV2FsbGV0U2F2ZTtcblx0XHRjb25zdCBteVdhbGxldCA9IG5ldyB0aGlzKHNhdmVkV2FsbGV0LnByaXZLZXksIHNhdmVkV2FsbGV0LnNlZWRQaHJhc2UsIG5ldHdvcmtPcHRpb25zLCBvcHRpb25zKTtcblx0XHRyZXR1cm4gbXlXYWxsZXQ7XG5cdH1cblxuXHQvL0B0cy1pZ25vcmVcblx0d29ya2VyOldvcmtlcjtcblx0aXNXb3JrZXJSZWFkeT1mYWxzZTtcblx0cnBjOklSUEN8dW5kZWZpbmVkO1xuXHRfcGVuZGluZ0NCOk1hcDxzdHJpbmcsIENCSXRlbT4gPSBuZXcgTWFwKCk7XG5cdHN5bmNTaWduYWw6aGVscGVyLkRlZmVycmVkUHJvbWlzZXx1bmRlZmluZWQ7XG5cdGdycGNGbGFnc1N5bmNTaWduYWw6aGVscGVyLkRlZmVycmVkUHJvbWlzZXx1bmRlZmluZWQ7XG5cdHdvcmtlclJlYWR5OmhlbHBlci5EZWZlcnJlZFByb21pc2UgPSB3b3JrZXJSZWFkeTtcblx0YmFsYW5jZTp7YXZhaWxhYmxlOm51bWJlciwgcGVuZGluZzpudW1iZXIsIHRvdGFsOm51bWJlcn0gPSB7YXZhaWxhYmxlOjAsIHBlbmRpbmc6MCwgdG90YWw6MH07XG5cdF9yaWQyc3ViVWlkOk1hcDxzdHJpbmcsIHN0cmluZz4gPSBuZXcgTWFwKCk7XG5cdHVpZDpzdHJpbmc7XG5cdEhEV2FsbGV0OiBrYXJsc2VuY29yZS5IRFByaXZhdGVLZXk7XG5cdGdycGNGbGFnczp7dXR4b0luZGV4PzpCb29sZWFufSA9IHt9O1xuXG5cdGNvbnN0cnVjdG9yKHByaXZLZXk6IHN0cmluZywgc2VlZFBocmFzZTogc3RyaW5nLCBuZXR3b3JrT3B0aW9uczogTmV0d29ya09wdGlvbnMsIG9wdGlvbnM6IFdhbGxldE9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGxldCB7cnBjfSA9IG5ldHdvcmtPcHRpb25zO1xuXHRcdGlmKHJwYyl7XG5cdFx0XHR0aGlzLnJwYyA9IHJwYztcblx0XHRcdGlmKG9wdGlvbnMuY2hlY2tHUlBDRmxhZ3Mpe1xuXHRcdFx0XHR0aGlzLmNoZWNrR1JQQ0ZsYWdzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGRlbGV0ZSBuZXR3b3JrT3B0aW9ucy5ycGM7XG5cblx0XHRpZiAocHJpdktleSAmJiBzZWVkUGhyYXNlKSB7XG5cdFx0XHR0aGlzLkhEV2FsbGV0ID0gbmV3IGthcmxzZW5jb3JlLkhEUHJpdmF0ZUtleShwcml2S2V5KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdGVtcCA9IG5ldyBXYWxsZXQuTW5lbW9uaWMoV2FsbGV0Lk1uZW1vbmljLldvcmRzLkVOR0xJU0gpO1xuXHRcdFx0dGhpcy5IRFdhbGxldCA9IG5ldyBrYXJsc2VuY29yZS5IRFByaXZhdGVLZXkodGVtcC50b0hEUHJpdmF0ZUtleSgpLnRvU3RyaW5nKCkpO1xuXHRcdH1cblxuXHRcdHRoaXMudWlkID0gdGhpcy5jcmVhdGVVSUQobmV0d29ya09wdGlvbnMubmV0d29yayk7XG5cdFx0Ly9AdHMtaWdub3JlXG5cdFx0cnBjPy5zZXRTdHJlYW1VaWQ/Lih0aGlzLnVpZCk7XG5cdFx0Y29uc29sZS5sb2coXCJ3YWxsZXQudWlkXCIsIHRoaXMudWlkKVxuXG5cblx0XHR0aGlzLmluaXRXb3JrZXIoKTtcblxuXHRcdHRoaXMuaW5pdFdhbGxldChwcml2S2V5LCBzZWVkUGhyYXNlLCBuZXR3b3JrT3B0aW9ucywgb3B0aW9ucyk7XG5cdH1cblxuXHRjaGVja0dSUENGbGFncygpe1xuXHRcdGNvbnN0IHtycGN9ID0gdGhpcztcblx0XHRpZighcnBjKVxuXHRcdFx0cmV0dXJuXG5cdFx0dGhpcy5ncnBjRmxhZ3NTeW5jU2lnbmFsID0gaGVscGVyLkRlZmVycmVkKCk7XG5cdFx0cnBjLm9uQ29ubmVjdChhc3luYygpPT57XG5cdFx0XHQvL2NvbnNvbGUubG9nKFwiIyMjIyNycGMgb25Db25uZWN0IyMjIyMjI1wiKVxuXHRcdFx0bGV0IHJlc3VsdCA9IGF3YWl0IHJwYy5nZXRVdHhvc0J5QWRkcmVzc2VzKFtdKVxuXHRcdFx0LmNhdGNoKChlcnIpPT57XG5cdFx0XHRcdC8vZXJyb3IgPSBlcnI7XG5cdFx0XHR9KVxuXG5cdFx0XHRpZihyZXN1bHQpe1xuXHRcdFx0XHR0aGlzLmdycGNGbGFncy51dHhvSW5kZXggPSAhcmVzdWx0LmVycm9yPy5tZXNzYWdlPy5pbmNsdWRlcygnLS11dHhvaW5kZXgnKTtcblx0XHRcdFx0dGhpcy5lbWl0KFwiZ3JwYy1mbGFnc1wiLCB0aGlzLmdycGNGbGFncylcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5ncnBjRmxhZ3NTeW5jU2lnbmFsPy5yZXNvbHZlKCk7XG5cdFx0fSlcblx0fVxuXG5cdGNyZWF0ZVVJRChuZXR3b3JrOnN0cmluZyl7XG5cdFx0Y29uc3Qge3ByaXZhdGVLZXl9ID0gdGhpcy5IRFdhbGxldC5kZXJpdmVDaGlsZChgbS80NCcvOTcyLzAnLzEnLzAnYCk7XG5cdFx0bGV0IGFkZHJlc3MgPSBwcml2YXRlS2V5LnRvQWRkcmVzcyhuZXR3b3JrKS50b1N0cmluZygpLnNwbGl0KFwiOlwiKVsxXVxuXHRcdHJldHVybiBoZWxwZXIuc2hhMjU2KGFkZHJlc3MpO1xuXHR9XG5cblx0YXN5bmMgaW5pdFdhbGxldChwcml2S2V5OiBzdHJpbmcsIHNlZWRQaHJhc2U6IHN0cmluZywgbmV0d29ya09wdGlvbnM6IE5ldHdvcmtPcHRpb25zLCBvcHRpb25zOiBXYWxsZXRPcHRpb25zID0ge30pe1xuXHRcdGF3YWl0IHRoaXMud29ya2VyUmVhZHk7XG5cdFx0dGhpcy5wb3N0TWVzc2FnZSgnd2FsbGV0LWluaXQnLCB7XG5cdFx0XHRwcml2S2V5LFxuXHRcdFx0c2VlZFBocmFzZSxcblx0XHRcdG5ldHdvcmtPcHRpb25zLFxuXHRcdFx0b3B0aW9uc1xuXHRcdH0pO1xuXHR9XG5cblx0aW5pdFdvcmtlcigpe1xuXHRcdGlmKCF3b3JrZXIpXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJQbGVhc2UgaW5pdCBrYXJsc2VuIGZyYW1ld29yayB1c2luZyAnYXdhaXQgaW5pdEthcmxzZW5GcmFtZXdvcmsoKTsnLlwiKVxuXHRcdHRoaXMud29ya2VyID0gd29ya2VyO1xuXHRcdG9uV29ya2VyTWVzc2FnZSA9IChvcDpzdHJpbmcsIGRhdGE6YW55KT0+e1xuXHRcdFx0Ly9pZihvcCAhPSAncnBjLXJlcXVlc3QnKXtcblx0XHRcdFx0Ly9pZiAoZGF0YT8uZm4gIT0gXCJtbmVtb25pY1wiKXtcblx0XHRcdFx0XHQvL3dvcmtlckxvZy5pbmZvKGBvbldvcmtlck1lc3NhZ2U6ICR7b3B9LCAke0pTT04uc3RyaW5naWZ5KGRhdGEpfWApXG5cdFx0XHRcdC8vfVxuXHRcdFx0Ly99XG5cdFx0XHRzd2l0Y2gob3Ape1xuXHRcdFx0XHRjYXNlICdycGMtcmVxdWVzdCc6XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaGFuZGxlUlBDUmVxdWVzdChkYXRhKTtcblx0XHRcdFx0Y2FzZSAnd2FsbGV0LXJlc3BvbnNlJzpcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5oYW5kbGVSZXNwb25zZShkYXRhKTtcblx0XHRcdFx0Y2FzZSAnd2FsbGV0LWV2ZW50cyc6XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaGFuZGxlRXZlbnRzKGRhdGEpO1xuXHRcdFx0XHRjYXNlICd3YWxsZXQtcHJvcGVydHknOlxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmhhbmRsZVByb3BlcnR5KGRhdGEpO1xuXHRcdFx0fVxuXG5cdFx0fVxuXHR9XG5cblx0aGFuZGxlUHJvcGVydHkobXNnOntuYW1lOnN0cmluZywgdmFsdWU6YW55fSl7XG5cdFx0Ly9AdHMtaWdub3JlXG5cdFx0dGhpc1tuYW1lXSA9IHZhbHVlO1xuXHR9XG5cblx0aGFuZGxlRXZlbnRzKG1zZzp7bmFtZTpzdHJpbmcsIGRhdGE6YW55fSl7XG5cdFx0bGV0IHtuYW1lLCBkYXRhfSA9IG1zZztcblx0XHRpZihuYW1lID09ICdiYWxhbmNlLXVwZGF0ZScpe1xuXHRcdFx0dGhpcy5iYWxhbmNlID0gZGF0YTtcblx0XHR9XG5cdFx0dGhpcy5lbWl0KG5hbWUsIGRhdGEpO1xuXHR9XG5cblx0YXN5bmMgaGFuZGxlUmVzcG9uc2UobXNnOntyaWQ6c3RyaW5nLCBlcnJvcj86YW55LCByZXN1bHQ/OmFueX0pe1xuXHRcdGxldCB7cmlkLCBlcnJvciwgcmVzdWx0fSA9IG1zZztcblx0XHRsZXQgaXRlbTpDQkl0ZW18dW5kZWZpbmVkID0gdGhpcy5fcGVuZGluZ0NCLmdldChyaWQpO1xuXHRcdGlmKCFpdGVtKVxuXHRcdFx0cmV0dXJuXG5cdFx0XG5cdFx0aXRlbS5jYihlcnJvciwgcmVzdWx0KTtcblx0XHR0aGlzLl9wZW5kaW5nQ0IuZGVsZXRlKHJpZCk7XG5cdH1cblx0YXN5bmMgaGFuZGxlUlBDUmVxdWVzdChtc2c6e2ZuOnN0cmluZywgYXJnczphbnksIHJpZD86c3RyaW5nfSl7XG5cdFx0d29ya2VyTG9nLmRlYnVnKGBSUENSZXF1ZXN0OiAke0pTT04uc3RyaW5naWZ5KG1zZyl9YClcblx0XHRjb25zdCB7Zm4sIGFyZ3MsIHJpZH0gPSBtc2c7XG5cblxuXHRcdGNvbnN0IHV0eG9SZWxhdGVkRm5zID0gW1xuXHRcdFx0J25vdGlmeVV0eG9zQ2hhbmdlZFJlcXVlc3QnLFxuXHRcdFx0J2dldFV0eG9zQnlBZGRyZXNzZXNSZXF1ZXN0Jyxcblx0XHRcdCdzdG9wTm90aWZ5aW5nVXR4b3NDaGFuZ2VkUmVxdWVzdCdcblx0XHRdO1xuXHRcdC8vY29uc29sZS5sb2coXCJmbmZuXCIsIGZuLCBhcmdzWzBdKVxuXHRcdGlmKGFyZ3NbMF0gJiYgdXR4b1JlbGF0ZWRGbnMuaW5jbHVkZXMoYXJnc1swXSkgJiYgdGhpcy5ncnBjRmxhZ3NTeW5jU2lnbmFsKXtcblx0XHRcdGF3YWl0IHRoaXMuZ3JwY0ZsYWdzU3luY1NpZ25hbDtcblx0XHRcdGlmKCF0aGlzLmdycGNGbGFncy51dHhvSW5kZXgpe1xuXHRcdFx0XHR0aGlzLnBvc3RNZXNzYWdlKFwicnBjLXJlc3BvbnNlXCIsIHtcblx0XHRcdFx0XHRyaWQsXG5cdFx0XHRcdFx0cmVzdWx0Ontcblx0XHRcdFx0XHRcdGVycm9yOntcblx0XHRcdFx0XHRcdFx0ZXJyb3JDb2RlOlwiVVRYT0lOREVYLUZMQUctTUlTU0lOR1wiLFxuXHRcdFx0XHRcdFx0XHRtZXNzYWdlOlwiVVRYT0lOREVYIEZMQUcgSVNTVUVcIlxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmKGZuPT1cInVuU3Vic2NyaWJlXCIpe1xuXHRcdFx0aWYoYXJnc1sxXSl7XG5cdFx0XHRcdGFyZ3NbMV0gPSB0aGlzLl9yaWQyc3ViVWlkLmdldChhcmdzWzFdKTsvL3JpZCB0byBzdWJpZFxuXHRcdFx0XHRpZighYXJnc1sxXSlcblx0XHRcdFx0XHRyZXR1cm5cblx0XHRcdH1cblx0XHRcdC8vQHRzLWlnbm9yZVxuXHRcdFx0dGhpcy5ycGMudW5TdWJzY3JpYmUoLi4uYXJncyk7XG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cblx0XHRsZXQgZGlyZWN0Rm5zID0gW1xuXHRcdFx0J29uQ29ubmVjdCcsICdvbkRpc2Nvbm5lY3QnLCAnb25Db25uZWN0RmFpbHVyZScsICdvbkVycm9yJywgXG5cdFx0XHQnZGlzY29ubmVjdCcsICdjb25uZWN0J1xuXHRcdF07XG5cblx0XHRpZihkaXJlY3RGbnMuaW5jbHVkZXMoZm4pKXtcblx0XHRcdGlmKHJpZCl7XG5cdFx0XHRcdGFyZ3MucHVzaCgocmVzdWx0OmFueSk9Pntcblx0XHRcdFx0XHR0aGlzLnBvc3RNZXNzYWdlKFwicnBjLWRpcmVjdFwiLCB7cmlkLCByZXN1bHR9KVxuXHRcdFx0XHR9KVxuXHRcdFx0fVxuXHRcdFx0Ly9AdHMtaWdub3JlXG5cdFx0XHR0aGlzLnJwY1tmbl0oLi4uYXJncylcblx0XHRcdHJldHVyblxuXHRcdH1cblxuXG5cdFx0aWYoZm49PSdzdWJzY3JpYmUnKXtcblx0XHRcdGFyZ3MucHVzaCgocmVzdWx0OmFueSk9Pntcblx0XHRcdFx0dGhpcy5wb3N0TWVzc2FnZShcInJwYy1wdWJsaXNoXCIsIHttZXRob2Q6YXJnc1swXSwgcmlkLCByZXN1bHR9KVxuXHRcdFx0fSlcblx0XHR9XG5cblx0XHQvL0B0cy1pZ25vcmVcblx0XHRsZXQgcCA9IHRoaXMucnBjW2ZuXSguLi5hcmdzKVxuXHRcdGxldCB7dWlkOnN1YlVpZH0gPSBwO1xuXHRcdGxldCBlcnJvcjtcblx0XHRsZXQgcmVzdWx0ID0gYXdhaXQgcFxuXHRcdC5jYXRjaCgoZXJyOmFueSk9Pntcblx0XHRcdGVycm9yID0gZXJyO1xuXHRcdH0pO1xuXG5cdFx0aWYoZm49PSdzdWJzY3JpYmUnICYmIHJpZCl7XG5cdFx0XHR0aGlzLl9yaWQyc3ViVWlkLnNldChyaWQsIHN1YlVpZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5wb3N0TWVzc2FnZShcInJwYy1yZXNwb25zZVwiLCB7cmlkLCByZXN1bHQsIGVycm9yfSlcblx0fVxuXG5cdHBvc3RNZXNzYWdlKG9wOnN0cmluZywgZGF0YTphbnkpe1xuXHRcdFdhbGxldFdyYXBwZXIucG9zdE1lc3NhZ2Uob3AsIGRhdGEpXG5cdH1cblxuXHRhc3luYyByZXF1ZXN0KGZuOnN0cmluZywgYXJnczphbnlbXSwgY2FsbGJhY2s6RnVuY3Rpb258dW5kZWZpbmVkPXVuZGVmaW5lZCl7XG5cdFx0YXdhaXQgdGhpcy53b3JrZXJSZWFkeVxuXHRcdGxldCByaWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYoY2FsbGJhY2spe1xuXHRcdFx0cmlkID0gdGhpcy5jcmVhdGVQZW5kaW5nQ2FsbChjYWxsYmFjaylcblx0XHR9XG5cdFx0d29ya2VyTG9nLmRlYnVnKGB3YWxsZXQtcmVxdWVzdDogJHtmbn0sICR7SlNPTi5zdHJpbmdpZnkoYXJncyl9LCAgJHtyaWR9YClcblx0XHR0aGlzLndvcmtlci5wb3N0TWVzc2FnZSh7b3A6XCJ3YWxsZXQtcmVxdWVzdFwiLCBkYXRhOntmbiwgYXJncywgcmlkfX0pXG5cdH1cblxuXHRyZXF1ZXN0UHJvbWlzaWZ5PFQ+KGZuOnN0cmluZywgLi4uYXJnczphbnlbXSk6UHJvbWlzZTxUPntcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9Pntcblx0XHRcdHRoaXMucmVxdWVzdChmbiwgYXJncywgKGVycm9yOmFueSwgcmVzdWx0OmFueSk9Pntcblx0XHRcdFx0aWYoZXJyb3IpXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChlcnJvcik7XG5cdFx0XHRcdHJlc29sdmUocmVzdWx0KTtcblx0XHRcdH0pXG5cdFx0fSlcblx0fVxuXG5cdGNyZWF0ZVBlbmRpbmdDYWxsKGNiOkZ1bmN0aW9uKTpzdHJpbmd7XG5cdFx0Y29uc3QgdWlkID0gVUlEKCk7XG5cdFx0dGhpcy5fcGVuZGluZ0NCLnNldCh1aWQsIHt1aWQsIGNifSk7XG5cdFx0cmV0dXJuIHVpZDtcblx0fVxuXG5cdGFzeW5jIHN5bmMoc3luY09uY2U6Ym9vbGVhbnx1bmRlZmluZWQgPSB1bmRlZmluZWQpe1xuXHRcdHRoaXMuc3luY1NpZ25hbCA9IGhlbHBlci5EZWZlcnJlZCgpO1xuXHRcdGxldCBhcmdzID0gW107XG5cdFx0aWYoc3luY09uY2UgIT09IHVuZGVmaW5lZClcblx0XHRcdGFyZ3MucHVzaChzeW5jT25jZSk7XG5cblx0XHR0aGlzLnJlcXVlc3QoXCJzeW5jXCIsIGFyZ3MsICgpPT57XG5cdFx0XHR0aGlzLnN5bmNTaWduYWw/LnJlc29sdmUoKTtcblx0XHR9KVxuXG5cdFx0cmV0dXJuIHRoaXMuc3luY1NpZ25hbDtcblx0fVxuXG5cdHNldExvZ0xldmVsKGxldmVsOiBzdHJpbmcpe1xuXHRcdHRoaXMucmVxdWVzdChcInNldExvZ0xldmVsXCIsIFtsZXZlbF0pXG5cdH1cblxuXHRzdGFydFVUWE9zUG9sbGluZygpe1xuXHRcdHRoaXMucmVxdWVzdChcInN0YXJ0VVRYT3NQb2xsaW5nXCIsIFtdKTtcblx0fVxuXG5cdGdldChuYW1lOnN0cmluZywgd2FpdEZvclN5bmM6Ym9vbGVhbj1mYWxzZSl7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jKHJlc29sdmUsIHJlamVjdCk9Pntcblx0XHRcdGlmKHdhaXRGb3JTeW5jKVxuXHRcdFx0XHRhd2FpdCB0aGlzLnN5bmNTaWduYWw7XG5cdFx0XHR0aGlzLnJlcXVlc3QobmFtZSwgW10sIChlcnJvcjphbnksIHJlc3VsdDphbnkpPT57XG5cdFx0XHRcdGlmKGVycm9yKVxuXHRcdFx0XHRcdHJldHVybiByZWplY3QoZXJyb3IpXG5cblx0XHRcdFx0cmVzb2x2ZShyZXN1bHQpO1xuXHRcdFx0fSlcblx0XHR9KVxuXHR9XG5cblx0Z2V0QWZ0ZXJTeW5jKG5hbWU6c3RyaW5nKXtcblx0XHRyZXR1cm4gdGhpcy5nZXQobmFtZSwgdHJ1ZSlcblx0fVxuXG5cdGdldCBtbmVtb25pYygpe1xuXHRcdHJldHVybiB0aGlzLmdldChcIm1uZW1vbmljXCIpXG5cdH1cblx0Z2V0IHJlY2VpdmVBZGRyZXNzKCl7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QWZ0ZXJTeW5jKFwicmVjZWl2ZUFkZHJlc3NcIilcblx0fVxuXG5cdC8qKlxuXHQgKiBTZW5kIGEgdHJhbnNhY3Rpb24uIFJldHVybnMgdHJhbnNhY3Rpb24gaWQuXG5cdCAqIEBwYXJhbSB0eFBhcmFtc1xuXHQgKiBAcGFyYW0gdHhQYXJhbXMudG9BZGRyIFRvIGFkZHJlc3MgaW4gY2FzaGFkZHIgZm9ybWF0IChlLmcuIGthcmxzZW50ZXN0OnFxMGQ2aDBwcmptNW1wZGxkNXBuY3N0M2FkdTB5YW02eGNoNHRyNjlrMilcblx0ICogQHBhcmFtIHR4UGFyYW1zLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLTFMpXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy5mZWUgRmVlIGZvciBtaW5lcnMgaW4gc29tcGlzXG5cdCAqIEB0aHJvd3MgYEZldGNoRXJyb3JgIGlmIGVuZHBvaW50IGlzIGRvd24uIEFQSSBlcnJvciBtZXNzYWdlIGlmIHR4IGVycm9yLiBFcnJvciBpZiBhbW91bnQgaXMgdG9vIGxhcmdlIHRvIGJlIHJlcHJlc2VudGVkIGFzIGEgamF2YXNjcmlwdCBudW1iZXIuXG5cdCAqL1xuXHRzdWJtaXRUcmFuc2FjdGlvbih0eFBhcmFtc0FyZzpUeFNlbmQsIGRlYnVnID0gZmFsc2UpOiBQcm9taXNlIDxUeFJlc3B8bnVsbD4ge1xuXHRcdHJldHVybiB0aGlzLnJlcXVlc3RQcm9taXNpZnk8VHhSZXNwfG51bGw+KFwic3VibWl0VHJhbnNhY3Rpb25cIiwgdHhQYXJhbXNBcmcsIGRlYnVnKVxuXHR9XG5cblx0LyoqXG5cdCAqIFNlbmQgYSB0cmFuc2FjdGlvbi4gUmV0dXJucyB0cmFuc2FjdGlvbiBpZC5cblx0ICogQHBhcmFtIHR4UGFyYW1zXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FybHNlbnRlc3Q6cXEwZDZoMHByam01bXBkbGQ1cG5jc3QzYWR1MHlhbTZ4Y2g0dHI2OWsyKVxuXHQgKiBAcGFyYW0gdHhQYXJhbXMuYW1vdW50IEFtb3VudCB0byBzZW5kIGluIHNvbXBpcyAoMTAwMDAwMDAwICgxZTgpIHNvbXBpcyBpbiAxIEtMUylcblx0ICogQHBhcmFtIHR4UGFyYW1zLmZlZSBGZWUgZm9yIG1pbmVycyBpbiBzb21waXNcblx0ICogQHRocm93cyBgRmV0Y2hFcnJvcmAgaWYgZW5kcG9pbnQgaXMgZG93bi4gQVBJIGVycm9yIG1lc3NhZ2UgaWYgdHggZXJyb3IuIEVycm9yIGlmIGFtb3VudCBpcyB0b28gbGFyZ2UgdG8gYmUgcmVwcmVzZW50ZWQgYXMgYSBqYXZhc2NyaXB0IG51bWJlci5cblx0ICovXG5cdGVzdGltYXRlVHJhbnNhY3Rpb24odHhQYXJhbXNBcmc6VHhTZW5kKTogUHJvbWlzZTxUeEluZm8+e1xuXHRcdHJldHVybiB0aGlzLnJlcXVlc3RQcm9taXNpZnk8VHhJbmZvPihcImVzdGltYXRlVHJhbnNhY3Rpb25cIiwgdHhQYXJhbXNBcmcpXG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlIHRyYW5zY2F0aW9ucyB0aW1lXG5cdCAqL1xuXHRzdGFydFVwZGF0aW5nVHJhbnNhY3Rpb25zKHZlcnNpb246dW5kZWZpbmVkfG51bWJlcj11bmRlZmluZWQpOlByb21pc2U8Ym9vbGVhbj57XG5cdFx0cmV0dXJuIHRoaXMucmVxdWVzdFByb21pc2lmeTxib29sZWFuPihcInN0YXJ0VXBkYXRpbmdUcmFuc2FjdGlvbnNcIiwgdmVyc2lvbilcblx0fVxuXG5cdC8qKlxuXHQqIENvbXBvdW5kIFVUWE9zIGJ5IHJlLXNlbmRpbmcgZnVuZHMgdG8gaXRzZWxmXG5cdCovXHRcblx0Y29tcG91bmRVVFhPcyh0eENvbXBvdW5kT3B0aW9uczpUeENvbXBvdW5kT3B0aW9ucz17fSwgZGVidWc9ZmFsc2UpOiBQcm9taXNlIDxUeFJlc3B8bnVsbD4ge1xuXHRcdHJldHVybiB0aGlzLnJlcXVlc3RQcm9taXNpZnk8VHhSZXNwfG51bGw+KFwiY29tcG91bmRVVFhPc1wiLCB0eENvbXBvdW5kT3B0aW9ucywgZGVidWcpO1xuXHR9XG5cblx0c2Nhbk1vcmVBZGRyZXNzZXMoY291bnQ9MTAwLCBkZWJ1Zz1mYWxzZSwgcmVjZWl2ZVN0YXJ0PS0xLCBjaGFuZ2VTdGFydD0tMSk6IFByb21pc2U8U2NhbmVNb3JlUmVzdWx0fG51bGw+e1xuXHRcdHJldHVybiB0aGlzLnJlcXVlc3RQcm9taXNpZnk8U2NhbmVNb3JlUmVzdWx0fG51bGw+KFwic2Nhbk1vcmVBZGRyZXNzZXNcIiwgY291bnQsIGRlYnVnLCByZWNlaXZlU3RhcnQsIGNoYW5nZVN0YXJ0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZW5lcmF0ZXMgZW5jcnlwdGVkIHdhbGxldCBkYXRhLlxuXHQgKiBAcGFyYW0gcGFzc3dvcmQgdXNlcidzIGNob3NlbiBwYXNzd29yZFxuXHQgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gb2JqZWN0LWxpa2Ugc3RyaW5nLiBTdWdnZXN0ZWQgdG8gc3RvcmUgYXMgc3RyaW5nIGZvciAuaW1wb3J0KCkuXG5cdCAqL1xuXHRleHBvcnQgKHBhc3N3b3JkOiBzdHJpbmcpOiBQcm9taXNlIDxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0UHJvbWlzaWZ5PHN0cmluZz4oXCJleHBvcnRcIiwgcGFzc3dvcmQpXG5cdH1cblxuXHRyZXN0b3JlQ2FjaGUoY2FjaGU6IFdhbGxldENhY2hlKXtcblx0XHR0aGlzLnJlcXVlc3QoXCJyZXN0b3JlQ2FjaGVcIiwgW2NhY2hlXSlcblx0fVxuXHRjbGVhclVzZWRVVFhPcygpe1xuXHRcdHRoaXMucmVxdWVzdChcImNsZWFyVXNlZFVUWE9zXCIsIFtdKVxuXHR9XG59XG5cblxuZXhwb3J0IHtXYWxsZXRXcmFwcGVyfVxuIl19
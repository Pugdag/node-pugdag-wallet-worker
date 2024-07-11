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
exports.UtxoSet = exports.COINBASE_CFM_COUNT = exports.CONFIRMATION_COUNT = exports.UnspentOutput = void 0;
const unspent_output_1 = require("./unspent-output");
Object.defineProperty(exports, "UnspentOutput", { enumerable: true, get: function () { return unspent_output_1.UnspentOutput; } });
const helper = __importStar(require("../utils/helper"));
// import * as api from './apiHelpers';
const wallet_1 = require("./wallet");
const event_target_impl_1 = require("./event-target-impl");
const KLS = helper.KLS;
exports.CONFIRMATION_COUNT = 10;
exports.COINBASE_CFM_COUNT = 100;
let seq = 0;
class UtxoSet extends event_target_impl_1.EventTargetImpl {
    constructor(wallet) {
        super();
        this.utxos = {
            confirmed: new Map(),
            pending: new Map(),
            used: new Map()
        };
        this.inUse = [];
        this.totalBalance = 0;
        this.availableBalance = 0;
        this.debug = false;
        this.utxoStorage = {};
        this.addressesUtxoSyncStatuses = new Map();
        this.wallet = wallet;
    }
    /**
     * Add UTXOs to UTXO set.
     * @param utxos Array of UTXOs from pugdag API.
     * @param address Address of UTXO owner.
     */
    add(utxos, address) {
        const utxoIds = [];
        this.logger.utxodebug("add utxos", utxos);
        const { blueScore } = this.wallet;
        utxos.forEach((utxo) => {
            const utxoId = utxo.transactionId + utxo.index.toString();
            const utxoInUse = this.inUse.includes(utxoId);
            const alreadyHaveIt = !!(this.utxos.confirmed.has(utxoId) || this.utxos.pending.has(utxoId));
            //console.log("utxo.scriptPubKey", utxo)
            //console.log("utxoInUse", {utxoInUse, alreadyHaveIt})
            if (!utxoInUse && !alreadyHaveIt /*&& utxo.isSpendable*/) {
                utxoIds.push(utxoId);
                let confirmed = (blueScore - utxo.blockDaaScore >= (utxo.isCoinbase ? exports.COINBASE_CFM_COUNT : exports.CONFIRMATION_COUNT));
                let unspentOutput = new unspent_output_1.UnspentOutput({
                    txid: utxo.transactionId,
                    address,
                    vout: utxo.index,
                    scriptPubKey: utxo.scriptPublicKey.scriptPublicKey,
                    scriptPublicKeyVersion: utxo.scriptPublicKey.version,
                    satoshis: +utxo.amount,
                    blockDaaScore: utxo.blockDaaScore,
                    isCoinbase: utxo.isCoinbase
                });
                //confirmed = confirmed || this.isOurChange(unspentOutput);
                //confirmed = /*confirmed || */this.isOurChange(unspentOutput);
                //if(confirmed){
                //	console.log("Change address: unspentOutput", blueScore-utxo.blockDaaScore, unspentOutput)
                //}
                let map = this.utxos[confirmed ? 'confirmed' : 'pending'];
                map.set(utxoId, unspentOutput);
                this.wallet.adjustBalance(confirmed, unspentOutput.satoshis);
            }
            else if (utxoInUse) {
                let unspentOutput = new unspent_output_1.UnspentOutput({
                    txid: utxo.transactionId,
                    address,
                    vout: utxo.index,
                    scriptPubKey: utxo.scriptPublicKey.scriptPublicKey,
                    scriptPublicKeyVersion: utxo.scriptPublicKey.version,
                    satoshis: +utxo.amount,
                    blockDaaScore: utxo.blockDaaScore,
                    isCoinbase: utxo.isCoinbase
                });
                this.utxos.used.set(utxoId, unspentOutput);
            }
        });
        if (utxoIds.length) {
            this.logger.utxodebug(`adding ${utxoIds.length} UTXO entries:\n`, utxoIds);
            this.logger.utxo(`incoming ${utxoIds.length} UTXO entries`);
        }
        this.wallet.txStore.addAddressUTXOs(address, utxos);
        return utxoIds;
    }
    get logger() {
        return this.wallet.logger;
    }
    remove(utxoIds) {
        this.release(utxoIds);
        let { blueScore } = this.wallet;
        let utxo;
        utxoIds.forEach(id => {
            utxo = this.utxos.confirmed.get(id);
            if (utxo) {
                this.utxos.confirmed.delete(id);
                this.wallet.adjustBalance(true, -utxo.satoshis);
            }
            utxo = this.utxos.pending.get(id);
            if (utxo) {
                this.utxos.pending.delete(id);
                this.wallet.adjustBalance(false, -utxo.satoshis);
                //duplicate tx issue handling
                if (utxo.blockDaaScore - blueScore < 70) {
                    let apiUTXO = {
                        transactionId: utxo.txId,
                        amount: utxo.satoshis,
                        scriptPublicKey: {
                            version: utxo.scriptPublicKeyVersion,
                            scriptPublicKey: utxo.scriptPubKey
                        },
                        blockDaaScore: utxo.blockDaaScore,
                        index: utxo.outputIndex,
                        isCoinbase: utxo.isCoinbase
                    };
                    this.wallet.txStore.removePendingUTXO(apiUTXO, utxo.address.toString());
                }
            }
        });
    }
    clearUsed() {
        this.inUse = [];
        this.utxos.used.clear();
        this.wallet.updateDebugInfo();
        this.wallet.emitCache();
    }
    clearMissing() {
        const { confirmed, pending, used } = this.utxos;
        let missing = this.inUse.filter(utxoId => {
            return !(confirmed.has(utxoId) || pending.has(utxoId) || used.has(utxoId));
        });
        if (!missing.length)
            return false;
        this.release(missing);
        return true;
    }
    release(utxoIdsToEnable) {
        // assigns new array without any utxoIdsToEnable
        this.inUse = this.inUse.filter((utxoId) => !utxoIdsToEnable.includes(utxoId));
        utxoIdsToEnable.forEach(utxoId => {
            this.utxos.used.delete(utxoId);
        });
        this.wallet.updateDebugInfo();
        this.wallet.emitCache();
        // this.updateUtxoBalance();
    }
    updateUtxoBalance() {
        const { blueScore } = this.wallet;
        [...this.utxos.pending.values()].forEach(utxo => {
            if (blueScore - utxo.blockDaaScore < (utxo.isCoinbase ? exports.COINBASE_CFM_COUNT : exports.CONFIRMATION_COUNT))
                return;
            this.utxos.pending.delete(utxo.txId + utxo.outputIndex);
            this.wallet.adjustBalance(false, -utxo.satoshis, false);
            this.utxos.confirmed.set(utxo.txId + utxo.outputIndex, utxo);
            this.wallet.adjustBalance(true, utxo.satoshis);
        });
    }
    clear() {
        this.utxos.confirmed.clear();
        this.utxos.pending.clear();
        this.utxos.used.clear();
        this.inUse = [];
        this.availableBalance = 0;
        this.utxoStorage = {};
        this.logger.info('UTXO set cleared.');
    }
    updateUsed(utxos) {
        utxos.forEach(utxo => {
            this.inUse.push(utxo.id);
            this.utxos.used.set(utxo.txId, utxo);
        });
        this.wallet.updateDebugInfo();
        this.wallet.emitCache();
    }
    /**
     * Naively select UTXOs.
     * @param txAmount Provide the amount that the UTXOs should cover.
     * @throws Error message if the UTXOs can't cover the `txAmount`
     */
    selectUtxos(txAmount) {
        const utxos = [];
        const utxoIds = [];
        let totalVal = 0;
        let list = [...this.utxos.confirmed.values()];
        list = list.filter((utxo) => {
            return !this.inUse.includes(utxo.id);
        });
        list.sort((a, b) => {
            return a.blockDaaScore - b.blockDaaScore || b.satoshis - a.satoshis || a.txId.localeCompare(b.txId) || a.outputIndex - b.outputIndex;
        });
        let mass = 0;
        for (const utxo of list) {
            //console.log("info",`UTXO ID: ${utxoId}  , UTXO: ${utxo}`);
            //if (!this.inUse.includes(utxoId)) {
            utxoIds.push(utxo.id);
            utxos.push(utxo);
            mass += utxo.mass;
            totalVal += utxo.satoshis;
            //}
            if (totalVal >= txAmount)
                break;
        }
        if (totalVal < txAmount)
            throw new Error(`Insufficient balance - need: ${KLS(txAmount)} KLS, available: ${KLS(totalVal)} KLS`);
        return {
            utxoIds,
            utxos,
            mass
        };
    }
    /**
     * Naively collect UTXOs.
     * @param maxCount Provide the max UTXOs count.
     */
    collectUtxos(maxCount = 10000) {
        const utxos = [];
        const utxoIds = [];
        let totalVal = 0;
        let list = [...this.utxos.confirmed.values()];
        list = list.filter((utxo) => {
            return !this.inUse.includes(utxo.id);
        });
        list.sort((a, b) => {
            return a.blockDaaScore - b.blockDaaScore || b.satoshis - a.satoshis || a.txId.localeCompare(b.txId) || a.outputIndex - b.outputIndex;
        });
        let maxMass = wallet_1.Wallet.MaxMassUTXOs;
        let mass = 0;
        for (const utxo of list) {
            if (utxos.length >= maxCount || mass + utxo.mass >= maxMass)
                break;
            utxoIds.push(utxo.id);
            utxos.push(utxo);
            totalVal += utxo.satoshis;
            mass += utxo.mass;
        }
        //console.log("maxMass:"+maxMass, "mass:"+mass)
        return {
            utxoIds,
            utxos,
            amount: totalVal,
            mass
        };
    }
    syncAddressesUtxos(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const newAddresses = addresses.map(address => {
                if (this.addressesUtxoSyncStatuses.has(address))
                    return;
                this.addressesUtxoSyncStatuses.set(address, false);
                return address;
            }).filter(address => address);
            //in sync process addressDiscovery calls findUtxos
            if (!newAddresses.length || (this.wallet.syncInProggress && !this.wallet.options.disableAddressDerivation))
                return;
            yield this.wallet.findUtxos(newAddresses);
            if (!this.wallet.syncOnce)
                yield this.utxoSubscribe();
        });
    }
    utxoSubscribe() {
        return __awaiter(this, void 0, void 0, function* () {
            let addresses = [];
            this.addressesUtxoSyncStatuses.forEach((sent, address) => {
                //if(sent)
                //  return
                //  !!!FIXME prevent multiple address subscriptions
                //if(!this.addressesUtxoSyncStatuses.get(address)) {
                //this.addressesUtxoSyncStatuses.set(address, true);
                addresses.push(address);
                //}
            });
            if (!addresses.length)
                return addresses;
            //console.log(`[${this.wallet.network}] !!! +++++++++++++++ SUBSCRIBING TO ADDRESSES :)\n`,addresses);
            let utxoChangedRes = yield this.wallet.api.subscribeUtxosChanged(addresses, this.onUtxosChanged.bind(this))
                .catch((error) => {
                console.log(`[${this.wallet.network}] RPC ERROR in uxtoSync! while registering addresses:`, error, addresses);
                addresses.map(address => {
                    this.addressesUtxoSyncStatuses.set(address, false);
                });
            });
            //console.log("utxoSync:utxoChangedRes:", utxoChangedRes, "\n utxoSync addresses:", addresses)
            return addresses;
        });
    }
    onUtxosChanged(added, removed) {
        // console.log("onUtxosChanged:res", added, removed)
        added.forEach((utxos, address) => {
            //this.logger.log('info', `${address}: ${utxos.length} utxos found.+=+=+=+=+=+=+++++=======+===+====+====+====+`);
            if (!utxos.length)
                return;
            if (!this.utxoStorage[address]) {
                this.utxoStorage[address] = utxos;
            }
            else {
                let txid2Utxo = {};
                utxos.forEach(utxo => {
                    txid2Utxo[utxo.transactionId + utxo.index] = utxo;
                });
                let oldUtxos = this.utxoStorage[address].filter(utxo => {
                    return !txid2Utxo[utxo.transactionId + utxo.index];
                });
                this.utxoStorage[address] = [...oldUtxos, ...utxos];
            }
            this.add(utxos, address);
        });
        this.wallet.txStore.addFromUTXOs(added);
        let utxoIds = [];
        removed.forEach((utxos, address) => {
            let txid2Outpoint = {};
            utxos.forEach(utxo => {
                txid2Outpoint[utxo.transactionId + utxo.index] = utxo;
                utxoIds.push(utxo.transactionId + utxo.index);
            });
            if (!this.utxoStorage[address])
                return;
            this.utxoStorage[address] = this.utxoStorage[address].filter(utxo => {
                return !txid2Outpoint[utxo.transactionId + utxo.index];
            });
        });
        if (utxoIds.length)
            this.remove(utxoIds);
        const isActivityOnReceiveAddr = this.utxoStorage[this.wallet.receiveAddress] !== undefined;
        if (isActivityOnReceiveAddr)
            this.wallet.addressManager.receiveAddress.next();
        //this.updateUtxoBalance();
        this.wallet.emit("utxo-change", { added, removed });
    }
    isOur(utxo) {
        return (!!this.wallet.transactions[utxo.txId]) || this.isOurChange(utxo);
    }
    isOurChange(utxo) {
        return this.wallet.addressManager.isOurChange(String(utxo.address));
    }
    get count() {
        return this.utxos.confirmed.size + this.utxos.pending.size;
    }
    get confirmedCount() {
        return this.utxos.confirmed.size;
    }
}
exports.UtxoSet = UtxoSet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXR4by5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3dhbGxldC91dHhvLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EscURBQStDO0FBU3ZDLDhGQVRBLDhCQUFhLE9BU0E7QUFMckIsd0RBQTBDO0FBQzFDLHVDQUF1QztBQUN2QyxxQ0FBZ0M7QUFDaEMsMkRBQW9EO0FBQ3BELE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUM7QUFFVixRQUFBLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztBQUN4QixRQUFBLGtCQUFrQixHQUFHLEdBQUcsQ0FBQztBQUV0QyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDWixNQUFhLE9BQVEsU0FBUSxtQ0FBZTtJQXdCM0MsWUFBWSxNQUFjO1FBQ3pCLEtBQUssRUFBRSxDQUFDO1FBeEJULFVBQUssR0FJRDtZQUNILFNBQVMsRUFBRSxJQUFJLEdBQUcsRUFBRTtZQUNwQixPQUFPLEVBQUUsSUFBSSxHQUFHLEVBQUU7WUFDbEIsSUFBSSxFQUFFLElBQUksR0FBRyxFQUFFO1NBQ2YsQ0FBQztRQUVGLFVBQUssR0FBYSxFQUFFLENBQUM7UUFFckIsaUJBQVksR0FBRyxDQUFDLENBQUM7UUFFakIscUJBQWdCLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLFVBQUssR0FBWSxLQUFLLENBQUM7UUFFdkIsZ0JBQVcsR0FBa0MsRUFBRSxDQUFDO1FBSWhELDhCQUF5QixHQUE0QixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBSTlELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3RCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsR0FBRyxDQUFDLEtBQWlCLEVBQUUsT0FBZTtRQUNyQyxNQUFNLE9BQU8sR0FBYSxFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFB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MkI7UUFDM0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUMsS0FBSyxFQUFFLE9BQU8sRUFBQyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFrQjtRQUN2QixPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDekUsQ0FBQztJQUVELFdBQVcsQ0FBQyxJQUFrQjtRQUM3QixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUE7SUFDcEUsQ0FBQztJQUNELElBQUksS0FBSztRQUNSLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUM1RCxDQUFDO0lBRUQsSUFBSSxjQUFjO1FBQ2pCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFBO0lBQ2pDLENBQUM7Q0FDRDtBQTdYRCwwQkE2WEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0FwaSxSUEN9IGZyb20gJ2N1c3RvbS10eXBlcyc7XG5pbXBvcnQge1Vuc3BlbnRPdXRwdXR9IGZyb20gJy4vdW5zcGVudC1vdXRwdXQnO1xuLy8gQHRzLWlnbm9yZVxuaW1wb3J0ICogYXMga2FybHNlbmNvcmUgZnJvbSAnQGthcmxzZW4vY29yZS1saWInO1xuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgKiBhcyBoZWxwZXIgZnJvbSAnLi4vdXRpbHMvaGVscGVyJztcbi8vIGltcG9ydCAqIGFzIGFwaSBmcm9tICcuL2FwaUhlbHBlcnMnO1xuaW1wb3J0IHtXYWxsZXR9IGZyb20gJy4vd2FsbGV0JztcbmltcG9ydCB7RXZlbnRUYXJnZXRJbXBsfSBmcm9tICcuL2V2ZW50LXRhcmdldC1pbXBsJztcbmNvbnN0IEtMUyA9IGhlbHBlci5LTFM7XG5leHBvcnQge1Vuc3BlbnRPdXRwdXR9O1xuZXhwb3J0IGNvbnN0IENPTkZJUk1BVElPTl9DT1VOVCA9IDEwO1xuZXhwb3J0IGNvbnN0IENPSU5CQVNFX0NGTV9DT1VOVCA9IDEwMDtcblxubGV0IHNlcSA9IDA7XG5leHBvcnQgY2xhc3MgVXR4b1NldCBleHRlbmRzIEV2ZW50VGFyZ2V0SW1wbCB7XG5cdHV0eG9zOiB7XG5cdFx0Y29uZmlybWVkOiBNYXAgPHN0cmluZywgVW5zcGVudE91dHB1dCA+O1xuXHRcdHBlbmRpbmc6IE1hcCA8c3RyaW5nLCBVbnNwZW50T3V0cHV0ID47XG5cdFx0dXNlZDpNYXAgPHN0cmluZywgVW5zcGVudE91dHB1dCA+O1xuXHR9ID0ge1xuXHRcdGNvbmZpcm1lZDogbmV3IE1hcCgpLFxuXHRcdHBlbmRpbmc6IG5ldyBNYXAoKSxcblx0XHR1c2VkOiBuZXcgTWFwKClcblx0fTtcblxuXHRpblVzZTogc3RyaW5nW10gPSBbXTtcblxuXHR0b3RhbEJhbGFuY2UgPSAwO1xuXG5cdGF2YWlsYWJsZUJhbGFuY2UgPSAwO1xuXHRkZWJ1ZzogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHV0eG9TdG9yYWdlOiBSZWNvcmQgPCBzdHJpbmcsIEFwaS5VdHhvW10gPiA9IHt9O1xuXG5cdHdhbGxldDogV2FsbGV0O1xuXG5cdGFkZHJlc3Nlc1V0eG9TeW5jU3RhdHVzZXM6IE1hcCA8IHN0cmluZywgYm9vbGVhbiA+ID0gbmV3IE1hcCgpO1xuXG5cdGNvbnN0cnVjdG9yKHdhbGxldDogV2FsbGV0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLndhbGxldCA9IHdhbGxldDtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGQgVVRYT3MgdG8gVVRYTyBzZXQuXG5cdCAqIEBwYXJhbSB1dHhvcyBBcnJheSBvZiBVVFhPcyBmcm9tIGthcmxzZW4gQVBJLlxuXHQgKiBAcGFyYW0gYWRkcmVzcyBBZGRyZXNzIG9mIFVUWE8gb3duZXIuXG5cdCAqL1xuXHRhZGQodXR4b3M6IEFwaS5VdHhvW10sIGFkZHJlc3M6IHN0cmluZyk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCB1dHhvSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdHRoaXMubG9nZ2VyLnV0eG9kZWJ1ZyhcImFkZCB1dHhvc1wiLCB1dHhvcylcblx0XHRjb25zdCB7Ymx1ZVNjb3JlfSA9IHRoaXMud2FsbGV0O1xuXHRcdHV0eG9zLmZvckVhY2goKHV0eG8pID0+IHtcblx0XHRcdGNvbnN0IHV0eG9JZCA9IHV0eG8udHJhbnNhY3Rpb25JZCArIHV0eG8uaW5kZXgudG9TdHJpbmcoKTtcblx0XHRcdGNvbnN0IHV0eG9JblVzZSA9IHRoaXMuaW5Vc2UuaW5jbHVkZXModXR4b0lkKTtcblx0XHRcdGNvbnN0IGFscmVhZHlIYXZlSXQgPSAhISh0aGlzLnV0eG9zLmNvbmZpcm1lZC5oYXModXR4b0lkKSB8fCB0aGlzLnV0eG9zLnBlbmRpbmcuaGFzKHV0eG9JZCkpO1xuXHRcdFx0Ly9jb25zb2xlLmxvZyhcInV0eG8uc2NyaXB0UHViS2V5XCIsIHV0eG8pXG5cdFx0XHQvL2NvbnNvbGUubG9nKFwidXR4b0luVXNlXCIsIHt1dHhvSW5Vc2UsIGFscmVhZHlIYXZlSXR9KVxuXHRcdFx0aWYgKCF1dHhvSW5Vc2UgJiYgIWFscmVhZHlIYXZlSXQgLyomJiB1dHhvLmlzU3BlbmRhYmxlKi8gKSB7XG5cdFx0XHRcdHV0eG9JZHMucHVzaCh1dHhvSWQpO1xuXHRcdFx0XHRsZXQgY29uZmlybWVkID0gKGJsdWVTY29yZS11dHhvLmJsb2NrRGFhU2NvcmU+PSAodXR4by5pc0NvaW5iYXNlPyBDT0lOQkFTRV9DRk1fQ09VTlQgOiBDT05GSVJNQVRJT05fQ09VTlQpKTtcblx0XHRcdFx0bGV0IHVuc3BlbnRPdXRwdXQgPSBuZXcgVW5zcGVudE91dHB1dCh7XG5cdFx0XHRcdFx0dHhpZDogdXR4by50cmFuc2FjdGlvbklkLFxuXHRcdFx0XHRcdGFkZHJlc3MsXG5cdFx0XHRcdFx0dm91dDogdXR4by5pbmRleCxcblx0XHRcdFx0XHRzY3JpcHRQdWJLZXk6IHV0eG8uc2NyaXB0UHVibGljS2V5LnNjcmlwdFB1YmxpY0tleSxcblx0XHRcdFx0XHRzY3JpcHRQdWJsaWNLZXlWZXJzaW9uOiB1dHhvLnNjcmlwdFB1YmxpY0tleS52ZXJzaW9uLFxuXHRcdFx0XHRcdHNhdG9zaGlzOiArdXR4by5hbW91bnQsXG5cdFx0XHRcdFx0YmxvY2tEYWFTY29yZTogdXR4by5ibG9ja0RhYVNjb3JlLFxuXHRcdFx0XHRcdGlzQ29pbmJhc2U6IHV0eG8uaXNDb2luYmFzZVxuXHRcdFx0XHR9KVxuXHRcdFx0XHQvL2NvbmZpcm1lZCA9IGNvbmZpcm1lZCB8fCB0aGlzLmlzT3VyQ2hhbmdlKHVuc3BlbnRPdXRwdXQpO1xuXHRcdFx0XHQvL2NvbmZpcm1lZCA9IC8qY29uZmlybWVkIHx8ICovdGhpcy5pc091ckNoYW5nZSh1bnNwZW50T3V0cHV0KTtcblx0XHRcdFx0Ly9pZihjb25maXJtZWQpe1xuXHRcdFx0XHQvL1x0Y29uc29sZS5sb2coXCJDaGFuZ2UgYWRkcmVzczogdW5zcGVudE91dHB1dFwiLCBibHVlU2NvcmUtdXR4by5ibG9ja0RhYVNjb3JlLCB1bnNwZW50T3V0cHV0KVxuXHRcdFx0XHQvL31cblx0XHRcdFx0bGV0IG1hcCA9IHRoaXMudXR4b3NbY29uZmlybWVkPydjb25maXJtZWQnOidwZW5kaW5nJ107XG5cdFx0XHRcdG1hcC5zZXQodXR4b0lkLCB1bnNwZW50T3V0cHV0KTtcblx0XHRcdFx0dGhpcy53YWxsZXQuYWRqdXN0QmFsYW5jZShjb25maXJtZWQsIHVuc3BlbnRPdXRwdXQuc2F0b3NoaXMpO1xuXHRcdFx0fWVsc2UgaWYodXR4b0luVXNlKXtcblx0XHRcdFx0bGV0IHVuc3BlbnRPdXRwdXQgPSBuZXcgVW5zcGVudE91dHB1dCh7XG5cdFx0XHRcdFx0dHhpZDogdXR4by50cmFuc2FjdGlvbklkLFxuXHRcdFx0XHRcdGFkZHJlc3MsXG5cdFx0XHRcdFx0dm91dDogdXR4by5pbmRleCxcblx0XHRcdFx0XHRzY3JpcHRQdWJLZXk6IHV0eG8uc2NyaXB0UHVibGljS2V5LnNjcmlwdFB1YmxpY0tleSxcblx0XHRcdFx0XHRzY3JpcHRQdWJsaWNLZXlWZXJzaW9uOiB1dHhvLnNjcmlwdFB1YmxpY0tleS52ZXJzaW9uLFxuXHRcdFx0XHRcdHNhdG9zaGlzOiArdXR4by5hbW91bnQsXG5cdFx0XHRcdFx0YmxvY2tEYWFTY29yZTogdXR4by5ibG9ja0RhYVNjb3JlLFxuXHRcdFx0XHRcdGlzQ29pbmJhc2U6IHV0eG8uaXNDb2luYmFzZVxuXHRcdFx0XHR9KVxuXHRcdFx0XHR0aGlzLnV0eG9zLnVzZWQuc2V0KHV0eG9JZCwgdW5zcGVudE91dHB1dCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aWYgKHV0eG9JZHMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci51dHhvZGVidWcoYGFkZGluZyAke3V0eG9JZHMubGVuZ3RofSBVVFhPIGVudHJpZXM6XFxuYCwgdXR4b0lkcyk7XG5cdFx0XHR0aGlzLmxvZ2dlci51dHhvKGBpbmNvbWluZyAke3V0eG9JZHMubGVuZ3RofSBVVFhPIGVudHJpZXNgKTtcblx0XHR9XG5cdFx0dGhpcy53YWxsZXQudHhTdG9yZS5hZGRBZGRyZXNzVVRYT3MoYWRkcmVzcywgdXR4b3MpO1xuXHRcdHJldHVybiB1dHhvSWRzO1xuXHR9XG5cblx0Z2V0IGxvZ2dlcigpe1xuXHRcdHJldHVybiB0aGlzLndhbGxldC5sb2dnZXJcblx0fVxuXG5cdHJlbW92ZSh1dHhvSWRzOiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdHRoaXMucmVsZWFzZSh1dHhvSWRzKTtcblx0XHRsZXQge2JsdWVTY29yZX0gPSB0aGlzLndhbGxldDtcblx0XHRsZXQgdXR4bztcblx0XHR1dHhvSWRzLmZvckVhY2goaWQ9PiB7XG5cdFx0XHR1dHhvID0gdGhpcy51dHhvcy5jb25maXJtZWQuZ2V0KGlkKTtcblx0XHRcdGlmKHV0eG8pe1xuXHRcdFx0XHR0aGlzLnV0eG9zLmNvbmZpcm1lZC5kZWxldGUoaWQpO1xuXHRcdFx0XHR0aGlzLndhbGxldC5hZGp1c3RCYWxhbmNlKHRydWUsIC11dHhvLnNhdG9zaGlzKTtcblx0XHRcdH1cblxuXHRcdFx0dXR4byA9IHRoaXMudXR4b3MucGVuZGluZy5nZXQoaWQpO1xuXHRcdFx0aWYodXR4byl7XG5cdFx0XHRcdHRoaXMudXR4b3MucGVuZGluZy5kZWxldGUoaWQpO1xuXHRcdFx0XHR0aGlzLndhbGxldC5hZGp1c3RCYWxhbmNlKGZhbHNlLCAtdXR4by5zYXRvc2hpcyk7XG5cblx0XHRcdFx0Ly9kdXBsaWNhdGUgdHggaXNzdWUgaGFuZGxpbmdcblx0XHRcdFx0aWYodXR4by5ibG9ja0RhYVNjb3JlLWJsdWVTY29yZSA8IDcwKXtcblx0XHRcdFx0XHRsZXQgYXBpVVRYTzpBcGkuVXR4byA9IHtcblx0XHRcdFx0XHRcdHRyYW5zYWN0aW9uSWQ6IHV0eG8udHhJZCxcblx0XHRcdFx0XHRcdGFtb3VudDp1dHhvLnNhdG9zaGlzLFxuXHRcdFx0XHRcdFx0c2NyaXB0UHVibGljS2V5Ontcblx0XHRcdFx0XHRcdFx0dmVyc2lvbjp1dHhvLnNjcmlwdFB1YmxpY0tleVZlcnNpb24sXG5cdFx0XHRcdFx0XHRcdHNjcmlwdFB1YmxpY0tleTogdXR4by5zY3JpcHRQdWJLZXlcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRibG9ja0RhYVNjb3JlOnV0eG8uYmxvY2tEYWFTY29yZSxcblx0XHRcdFx0XHRcdGluZGV4OnV0eG8ub3V0cHV0SW5kZXgsXG5cdFx0XHRcdFx0XHRpc0NvaW5iYXNlOnV0eG8uaXNDb2luYmFzZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLndhbGxldC50eFN0b3JlLnJlbW92ZVBlbmRpbmdVVFhPKGFwaVVUWE8sIHV0eG8uYWRkcmVzcy50b1N0cmluZygpKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRjbGVhclVzZWQoKXtcblx0XHR0aGlzLmluVXNlID0gW107XG5cdFx0dGhpcy51dHhvcy51c2VkLmNsZWFyKCk7XG5cdFx0dGhpcy53YWxsZXQudXBkYXRlRGVidWdJbmZvKCk7XG5cdFx0dGhpcy53YWxsZXQuZW1pdENhY2hlKCk7XG5cdH1cblxuXHRjbGVhck1pc3NpbmcoKTpib29sZWFue1xuXHRcdGNvbnN0IHtjb25maXJtZWQsIHBlbmRpbmcsIHVzZWR9ID0gdGhpcy51dHhvcztcblx0XHRsZXQgbWlzc2luZyA9IHRoaXMuaW5Vc2UuZmlsdGVyKHV0eG9JZD0+e1xuXHRcdFx0cmV0dXJuICEoY29uZmlybWVkLmhhcyh1dHhvSWQpIHx8IHBlbmRpbmcuaGFzKHV0eG9JZCkgfHwgdXNlZC5oYXModXR4b0lkKSlcblx0XHR9KVxuXHRcdGlmKCFtaXNzaW5nLmxlbmd0aClcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdHRoaXMucmVsZWFzZShtaXNzaW5nKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHJlbGVhc2UodXR4b0lkc1RvRW5hYmxlOiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdC8vIGFzc2lnbnMgbmV3IGFycmF5IHdpdGhvdXQgYW55IHV0eG9JZHNUb0VuYWJsZVxuXHRcdHRoaXMuaW5Vc2UgPSB0aGlzLmluVXNlLmZpbHRlcigodXR4b0lkKSA9PiAhdXR4b0lkc1RvRW5hYmxlLmluY2x1ZGVzKHV0eG9JZCkpO1xuXHRcdHV0eG9JZHNUb0VuYWJsZS5mb3JFYWNoKHV0eG9JZD0+e1xuXHRcdFx0dGhpcy51dHhvcy51c2VkLmRlbGV0ZSh1dHhvSWQpO1xuXHRcdH0pXG5cdFx0dGhpcy53YWxsZXQudXBkYXRlRGVidWdJbmZvKCk7XG5cdFx0dGhpcy53YWxsZXQuZW1pdENhY2hlKCk7XG5cdFx0Ly8gdGhpcy51cGRhdGVVdHhvQmFsYW5jZSgpO1xuXHR9XG5cblx0dXBkYXRlVXR4b0JhbGFuY2UoKTogdm9pZCB7XG5cdFx0Y29uc3Qge2JsdWVTY29yZX0gPSB0aGlzLndhbGxldDtcblx0XHRbLi4udGhpcy51dHhvcy5wZW5kaW5nLnZhbHVlcygpXS5mb3JFYWNoKHV0eG89Pntcblx0XHRcdGlmKGJsdWVTY29yZS11dHhvLmJsb2NrRGFhU2NvcmUgPCAodXR4by5pc0NvaW5iYXNlPyBDT0lOQkFTRV9DRk1fQ09VTlQgOiBDT05GSVJNQVRJT05fQ09VTlQpKVxuXHRcdFx0XHRyZXR1cm5cblx0XHRcdHRoaXMudXR4b3MucGVuZGluZy5kZWxldGUodXR4by50eElkK3V0eG8ub3V0cHV0SW5kZXgpO1xuXHRcdFx0dGhpcy53YWxsZXQuYWRqdXN0QmFsYW5jZShmYWxzZSwgLXV0eG8uc2F0b3NoaXMsIGZhbHNlKTtcblx0XHRcdHRoaXMudXR4b3MuY29uZmlybWVkLnNldCh1dHhvLnR4SWQrdXR4by5vdXRwdXRJbmRleCwgdXR4byk7XG5cdFx0XHR0aGlzLndhbGxldC5hZGp1c3RCYWxhbmNlKHRydWUsIHV0eG8uc2F0b3NoaXMpO1xuXHRcdH0pXG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLnV0eG9zLmNvbmZpcm1lZC5jbGVhcigpO1xuXHRcdHRoaXMudXR4b3MucGVuZGluZy5jbGVhcigpO1xuXHRcdHRoaXMudXR4b3MudXNlZC5jbGVhcigpO1xuXHRcdHRoaXMuaW5Vc2UgPSBbXTtcblx0XHR0aGlzLmF2YWlsYWJsZUJhbGFuY2UgPSAwO1xuXHRcdHRoaXMudXR4b1N0b3JhZ2UgPSB7fTtcblx0XHR0aGlzLmxvZ2dlci5pbmZvKCdVVFhPIHNldCBjbGVhcmVkLicpO1xuXHR9XG5cblx0dXBkYXRlVXNlZCh1dHhvczpVbnNwZW50T3V0cHV0W10pe1xuXHRcdHV0eG9zLmZvckVhY2godXR4bz0+e1xuXHRcdFx0dGhpcy5pblVzZS5wdXNoKHV0eG8uaWQpO1xuXHRcdFx0dGhpcy51dHhvcy51c2VkLnNldCh1dHhvLnR4SWQsIHV0eG8pO1xuXHRcdH0pXG5cdFx0dGhpcy53YWxsZXQudXBkYXRlRGVidWdJbmZvKCk7XG5cdFx0dGhpcy53YWxsZXQuZW1pdENhY2hlKCk7XG5cdH1cblxuXHQvKipcblx0ICogTmFpdmVseSBzZWxlY3QgVVRYT3MuXG5cdCAqIEBwYXJhbSB0eEFtb3VudCBQcm92aWRlIHRoZSBhbW91bnQgdGhhdCB0aGUgVVRYT3Mgc2hvdWxkIGNvdmVyLlxuXHQgKiBAdGhyb3dzIEVycm9yIG1lc3NhZ2UgaWYgdGhlIFVUWE9zIGNhbid0IGNvdmVyIHRoZSBgdHhBbW91bnRgXG5cdCAqL1xuXHRzZWxlY3RVdHhvcyh0eEFtb3VudDogbnVtYmVyKToge1xuXHRcdHV0eG9JZHM6IHN0cmluZ1tdO1xuXHRcdHV0eG9zOiBVbnNwZW50T3V0cHV0W10sXG5cdFx0bWFzczogbnVtYmVyXG5cdH0ge1xuXHRcdGNvbnN0IHV0eG9zOiBVbnNwZW50T3V0cHV0W10gPSBbXTtcblx0XHRjb25zdCB1dHhvSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGxldCB0b3RhbFZhbCA9IDA7XG5cdFx0bGV0IGxpc3QgPSBbLi4udGhpcy51dHhvcy5jb25maXJtZWQudmFsdWVzKCldO1xuXG5cdFx0bGlzdCA9IGxpc3QuZmlsdGVyKCh1dHhvKSA9PiB7XG5cdFx0XHRyZXR1cm4gIXRoaXMuaW5Vc2UuaW5jbHVkZXModXR4by5pZCk7XG5cdFx0fSk7XG5cblx0XHRsaXN0LnNvcnQoKGE6IFVuc3BlbnRPdXRwdXQsIGI6IFVuc3BlbnRPdXRwdXQpOiBudW1iZXIgPT4ge1xuXHRcdFx0cmV0dXJuIGEuYmxvY2tEYWFTY29yZSAtIGIuYmxvY2tEYWFTY29yZSB8fCBiLnNhdG9zaGlzIC0gYS5zYXRvc2hpcyB8fCBhLnR4SWQubG9jYWxlQ29tcGFyZShiLnR4SWQpIHx8IGEub3V0cHV0SW5kZXggLSBiLm91dHB1dEluZGV4O1xuXHRcdH0pXG5cdFx0bGV0IG1hc3MgPSAwO1xuXHRcdGZvciAoY29uc3QgdXR4byBvZiBsaXN0KSB7XG5cdFx0XHQvL2NvbnNvbGUubG9nKFwiaW5mb1wiLGBVVFhPIElEOiAke3V0eG9JZH0gICwgVVRYTzogJHt1dHhvfWApO1xuXHRcdFx0Ly9pZiAoIXRoaXMuaW5Vc2UuaW5jbHVkZXModXR4b0lkKSkge1xuXHRcdFx0XHR1dHhvSWRzLnB1c2godXR4by5pZCk7XG5cdFx0XHRcdHV0eG9zLnB1c2godXR4byk7XG5cdFx0XHRcdG1hc3MgKz0gdXR4by5tYXNzO1xuXHRcdFx0XHR0b3RhbFZhbCArPSB1dHhvLnNhdG9zaGlzO1xuXHRcdFx0Ly99XG5cdFx0XHRpZiAodG90YWxWYWwgPj0gdHhBbW91bnQpIGJyZWFrO1xuXHRcdH1cblx0XHRpZiAodG90YWxWYWwgPCB0eEFtb3VudClcblx0XHRcdHRocm93IG5ldyBFcnJvcihgSW5zdWZmaWNpZW50IGJhbGFuY2UgLSBuZWVkOiAke0tMUyh0eEFtb3VudCl9IEtMUywgYXZhaWxhYmxlOiAke0tMUyh0b3RhbFZhbCl9IEtMU2ApO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHV0eG9JZHMsXG5cdFx0XHR1dHhvcyxcblx0XHRcdG1hc3Ncblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIE5haXZlbHkgY29sbGVjdCBVVFhPcy5cblx0ICogQHBhcmFtIG1heENvdW50IFByb3ZpZGUgdGhlIG1heCBVVFhPcyBjb3VudC5cblx0ICovXG5cdGNvbGxlY3RVdHhvcyhtYXhDb3VudDogbnVtYmVyID0gMTAwMDApOiB7XG5cdFx0dXR4b0lkczogc3RyaW5nW107XG5cdFx0dXR4b3M6IFVuc3BlbnRPdXRwdXRbXSxcblx0XHRhbW91bnQ6IG51bWJlcixcblx0XHRtYXNzOiBudW1iZXJcblx0fSB7XG5cdFx0Y29uc3QgdXR4b3M6IFVuc3BlbnRPdXRwdXRbXSA9IFtdO1xuXHRcdGNvbnN0IHV0eG9JZHM6IHN0cmluZ1tdID0gW107XG5cdFx0bGV0IHRvdGFsVmFsID0gMDtcblx0XHRsZXQgbGlzdCA9IFsuLi50aGlzLnV0eG9zLmNvbmZpcm1lZC52YWx1ZXMoKV07XG5cblx0XHRsaXN0ID0gbGlzdC5maWx0ZXIoKHV0eG8pID0+IHtcblx0XHRcdHJldHVybiAhdGhpcy5pblVzZS5pbmNsdWRlcyh1dHhvLmlkKTtcblx0XHR9KTtcblxuXHRcdGxpc3Quc29ydCgoYTogVW5zcGVudE91dHB1dCwgYjogVW5zcGVudE91dHB1dCk6IG51bWJlciA9PiB7XG5cdFx0XHRyZXR1cm4gYS5ibG9ja0RhYVNjb3JlIC0gYi5ibG9ja0RhYVNjb3JlIHx8IGIuc2F0b3NoaXMgLSBhLnNhdG9zaGlzIHx8IGEudHhJZC5sb2NhbGVDb21wYXJlKGIudHhJZCkgfHwgYS5vdXRwdXRJbmRleCAtIGIub3V0cHV0SW5kZXg7XG5cdFx0fSlcblx0XHRsZXQgbWF4TWFzcyA9IFdhbGxldC5NYXhNYXNzVVRYT3M7XG5cdFx0XG5cdFx0bGV0IG1hc3MgPSAwO1xuXHRcdGZvciAoY29uc3QgdXR4byBvZiBsaXN0KSB7XG5cdFx0XHRpZiAodXR4b3MubGVuZ3RoID49IG1heENvdW50IHx8IG1hc3MrdXR4by5tYXNzID49IG1heE1hc3MpXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0dXR4b0lkcy5wdXNoKHV0eG8uaWQpO1xuXHRcdFx0dXR4b3MucHVzaCh1dHhvKTtcblx0XHRcdHRvdGFsVmFsICs9IHV0eG8uc2F0b3NoaXM7XG5cdFx0XHRtYXNzICs9IHV0eG8ubWFzcztcblx0XHR9XG5cdFx0Ly9jb25zb2xlLmxvZyhcIm1heE1hc3M6XCIrbWF4TWFzcywgXCJtYXNzOlwiK21hc3MpXG5cdFx0cmV0dXJuIHtcblx0XHRcdHV0eG9JZHMsXG5cdFx0XHR1dHhvcyxcblx0XHRcdGFtb3VudDogdG90YWxWYWwsXG5cdFx0XHRtYXNzXG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIHN5bmNBZGRyZXNzZXNVdHhvcyhhZGRyZXNzZXM6IHN0cmluZ1tdKSB7XG5cdFx0Y29uc3QgbmV3QWRkcmVzc2VzID0gYWRkcmVzc2VzLm1hcChhZGRyZXNzID0+IHtcblx0XHRcdGlmICh0aGlzLmFkZHJlc3Nlc1V0eG9TeW5jU3RhdHVzZXMuaGFzKGFkZHJlc3MpKVxuXHRcdFx0XHRyZXR1cm5cblx0XHRcdHRoaXMuYWRkcmVzc2VzVXR4b1N5bmNTdGF0dXNlcy5zZXQoYWRkcmVzcywgZmFsc2UpO1xuXHRcdFx0cmV0dXJuIGFkZHJlc3M7XG5cdFx0fSkuZmlsdGVyKGFkZHJlc3MgPT4gYWRkcmVzcykgYXMgc3RyaW5nW107XG5cblx0XHQvL2luIHN5bmMgcHJvY2VzcyBhZGRyZXNzRGlzY292ZXJ5IGNhbGxzIGZpbmRVdHhvc1xuXHRcdGlmICghbmV3QWRkcmVzc2VzLmxlbmd0aCB8fCAodGhpcy53YWxsZXQuc3luY0luUHJvZ2dyZXNzICYmICF0aGlzLndhbGxldC5vcHRpb25zLmRpc2FibGVBZGRyZXNzRGVyaXZhdGlvbikpXG5cdFx0XHRyZXR1cm5cblxuXHRcdGF3YWl0IHRoaXMud2FsbGV0LmZpbmRVdHhvcyhuZXdBZGRyZXNzZXMpO1xuXG5cdFx0aWYoIXRoaXMud2FsbGV0LnN5bmNPbmNlKVxuXHRcdFx0YXdhaXQgdGhpcy51dHhvU3Vic2NyaWJlKCk7XG5cdH1cblxuXHRhc3luYyB1dHhvU3Vic2NyaWJlKCk6IFByb21pc2UgPCBzdHJpbmdbXSA+IHtcblx0XHRsZXQgYWRkcmVzc2VzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdHRoaXMuYWRkcmVzc2VzVXR4b1N5bmNTdGF0dXNlcy5mb3JFYWNoKChzZW50LCBhZGRyZXNzKSA9PiB7XG5cdFx0XHQvL2lmKHNlbnQpXG5cdFx0XHQvLyAgcmV0dXJuXG5cblx0XHRcdC8vICAhISFGSVhNRSBwcmV2ZW50IG11bHRpcGxlIGFkZHJlc3Mgc3Vic2NyaXB0aW9uc1xuXHRcdFx0Ly9pZighdGhpcy5hZGRyZXNzZXNVdHhvU3luY1N0YXR1c2VzLmdldChhZGRyZXNzKSkge1xuXHRcdFx0Ly90aGlzLmFkZHJlc3Nlc1V0eG9TeW5jU3RhdHVzZXMuc2V0KGFkZHJlc3MsIHRydWUpO1xuXHRcdFx0YWRkcmVzc2VzLnB1c2goYWRkcmVzcyk7XG5cdFx0XHQvL31cblx0XHR9KTtcblxuXHRcdGlmICghYWRkcmVzc2VzLmxlbmd0aClcblx0XHRcdHJldHVybiBhZGRyZXNzZXM7XG5cdFx0Ly9jb25zb2xlLmxvZyhgWyR7dGhpcy53YWxsZXQubmV0d29ya31dICEhISArKysrKysrKysrKysrKysgU1VCU0NSSUJJTkcgVE8gQUREUkVTU0VTIDopXFxuYCxhZGRyZXNzZXMpO1xuXHRcdGxldCB1dHhvQ2hhbmdlZFJlcyA9IGF3YWl0IHRoaXMud2FsbGV0LmFwaS5zdWJzY3JpYmVVdHhvc0NoYW5nZWQoYWRkcmVzc2VzLCB0aGlzLm9uVXR4b3NDaGFuZ2VkLmJpbmQodGhpcykpXG5cdFx0XHQuY2F0Y2goKGVycm9yOiBSUEMuRXJyb3IpID0+IHtcblx0XHRcdFx0Y29uc29sZS5sb2coYFske3RoaXMud2FsbGV0Lm5ldHdvcmt9XSBSUEMgRVJST1IgaW4gdXh0b1N5bmMhIHdoaWxlIHJlZ2lzdGVyaW5nIGFkZHJlc3NlczpgLCBlcnJvciwgYWRkcmVzc2VzKTtcblx0XHRcdFx0YWRkcmVzc2VzLm1hcChhZGRyZXNzID0+IHtcblx0XHRcdFx0XHR0aGlzLmFkZHJlc3Nlc1V0eG9TeW5jU3RhdHVzZXMuc2V0KGFkZHJlc3MsIGZhbHNlKTtcblx0XHRcdFx0fSlcblx0XHRcdH0pXG5cblx0XHQvL2NvbnNvbGUubG9nKFwidXR4b1N5bmM6dXR4b0NoYW5nZWRSZXM6XCIsIHV0eG9DaGFuZ2VkUmVzLCBcIlxcbiB1dHhvU3luYyBhZGRyZXNzZXM6XCIsIGFkZHJlc3Nlcylcblx0XHRyZXR1cm4gYWRkcmVzc2VzO1xuXHR9XG5cblx0b25VdHhvc0NoYW5nZWQoYWRkZWQ6IE1hcCA8IHN0cmluZywgQXBpLlV0eG9bXSA+ICwgcmVtb3ZlZDogTWFwIDwgc3RyaW5nLCBSUEMuT3V0cG9pbnRbXSA+ICkge1xuXHRcdC8vIGNvbnNvbGUubG9nKFwib25VdHhvc0NoYW5nZWQ6cmVzXCIsIGFkZGVkLCByZW1vdmVkKVxuXHRcdGFkZGVkLmZvckVhY2goKHV0eG9zLCBhZGRyZXNzKSA9PiB7XG5cdFx0XHQvL3RoaXMubG9nZ2VyLmxvZygnaW5mbycsIGAke2FkZHJlc3N9OiAke3V0eG9zLmxlbmd0aH0gdXR4b3MgZm91bmQuKz0rPSs9Kz0rPSs9KysrKys9PT09PT09Kz09PSs9PT09Kz09PT0rPT09PStgKTtcblx0XHRcdGlmICghdXR4b3MubGVuZ3RoKVxuXHRcdFx0XHRyZXR1cm5cblxuXHRcdFx0aWYgKCF0aGlzLnV0eG9TdG9yYWdlW2FkZHJlc3NdKSB7XG5cdFx0XHRcdHRoaXMudXR4b1N0b3JhZ2VbYWRkcmVzc10gPSB1dHhvcztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGxldCB0eGlkMlV0eG86IFJlY29yZCA8IHN0cmluZywgQXBpLlV0eG8gPiA9IHt9O1xuXHRcdFx0XHR1dHhvcy5mb3JFYWNoKHV0eG8gPT4ge1xuXHRcdFx0XHRcdHR4aWQyVXR4b1t1dHhvLnRyYW5zYWN0aW9uSWQgKyB1dHhvLmluZGV4XSA9IHV0eG87XG5cdFx0XHRcdH0pXG5cdFx0XHRcdGxldCBvbGRVdHhvcyA9IHRoaXMudXR4b1N0b3JhZ2VbYWRkcmVzc10uZmlsdGVyKHV0eG8gPT4ge1xuXHRcdFx0XHRcdHJldHVybiAhdHhpZDJVdHhvW3V0eG8udHJhbnNhY3Rpb25JZCArIHV0eG8uaW5kZXhdXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLnV0eG9TdG9yYWdlW2FkZHJlc3NdID0gWy4uLm9sZFV0eG9zLCAuLi51dHhvc107XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmFkZCh1dHhvcywgYWRkcmVzcyk7XG5cdFx0fSlcblxuXHRcdHRoaXMud2FsbGV0LnR4U3RvcmUuYWRkRnJvbVVUWE9zKGFkZGVkKTtcblxuXHRcdGxldCB1dHhvSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdHJlbW92ZWQuZm9yRWFjaCgodXR4b3MsIGFkZHJlc3MpID0+IHtcblx0XHRcdGxldCB0eGlkMk91dHBvaW50OiBSZWNvcmQgPCBzdHJpbmcsIFJQQy5PdXRwb2ludCA+ID0ge307XG5cdFx0XHR1dHhvcy5mb3JFYWNoKHV0eG8gPT4ge1xuXHRcdFx0XHR0eGlkMk91dHBvaW50W3V0eG8udHJhbnNhY3Rpb25JZCArIHV0eG8uaW5kZXhdID0gdXR4bztcblx0XHRcdFx0dXR4b0lkcy5wdXNoKHV0eG8udHJhbnNhY3Rpb25JZCArIHV0eG8uaW5kZXgpO1xuXHRcdFx0fSlcblx0XHRcdGlmICghdGhpcy51dHhvU3RvcmFnZVthZGRyZXNzXSlcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHR0aGlzLnV0eG9TdG9yYWdlW2FkZHJlc3NdID0gdGhpcy51dHhvU3RvcmFnZVthZGRyZXNzXS5maWx0ZXIodXR4byA9PiB7XG5cdFx0XHRcdHJldHVybiAhdHhpZDJPdXRwb2ludFt1dHhvLnRyYW5zYWN0aW9uSWQgKyB1dHhvLmluZGV4XVxuXHRcdFx0fSk7XG5cdFx0fSlcblxuXHRcdGlmICh1dHhvSWRzLmxlbmd0aClcblx0XHRcdHRoaXMucmVtb3ZlKHV0eG9JZHMpO1xuXG5cdFx0Y29uc3QgaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIgPVxuXHRcdFx0dGhpcy51dHhvU3RvcmFnZVt0aGlzLndhbGxldC5yZWNlaXZlQWRkcmVzc10gIT09IHVuZGVmaW5lZDtcblx0XHRpZiAoaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIpXG5cdFx0XHR0aGlzLndhbGxldC5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5uZXh0KCk7XG5cblx0XHQvL3RoaXMudXBkYXRlVXR4b0JhbGFuY2UoKTtcblx0XHR0aGlzLndhbGxldC5lbWl0KFwidXR4by1jaGFuZ2VcIiwge2FkZGVkLCByZW1vdmVkfSk7XG5cdH1cblxuXHRpc091cih1dHhvOlVuc3BlbnRPdXRwdXQpOiBib29sZWFue1xuXHRcdHJldHVybiAoISF0aGlzLndhbGxldC50cmFuc2FjdGlvbnNbdXR4by50eElkXSkgfHwgdGhpcy5pc091ckNoYW5nZSh1dHhvKVxuXHR9XG5cblx0aXNPdXJDaGFuZ2UodXR4bzpVbnNwZW50T3V0cHV0KTpib29sZWFue1xuXHRcdHJldHVybiB0aGlzLndhbGxldC5hZGRyZXNzTWFuYWdlci5pc091ckNoYW5nZShTdHJpbmcodXR4by5hZGRyZXNzKSlcblx0fVxuXHRnZXQgY291bnQoKTpudW1iZXJ7XG5cdFx0cmV0dXJuIHRoaXMudXR4b3MuY29uZmlybWVkLnNpemUgKyB0aGlzLnV0eG9zLnBlbmRpbmcuc2l6ZTtcblx0fVxuXG5cdGdldCBjb25maXJtZWRDb3VudCgpOm51bWJlcntcblx0XHRyZXR1cm4gdGhpcy51dHhvcy5jb25maXJtZWQuc2l6ZVxuXHR9XG59XG4iXX0=
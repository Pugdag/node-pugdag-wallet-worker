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
exports.TXStore = exports.internalNames = void 0;
const indexed_db_1 = require("./indexed-db");
const API_BASE = "https://api.pugdagcoin.com/";
exports.internalNames = {
    mainnet: "default",
    pugdag: "default",
    testnet: "testnet",
    pugdagtest: "testnet",
    pugdagsim: "simnet",
    pugdagdev: "devnet",
    pugdagreg: "pugdagreg"
};
class TXStore {
    constructor(wallet) {
        this.store = new Map();
        this.txToEmitList = [];
        this.updatedTxToEmitList = [];
        this.pendingUpdate = [];
        this.updateTxTimeoutId = null;
        this.emitTxTimeoutId = null;
        this.emitUpdateTxTimeoutId = null;
        this.updatingTransactionsInprogress = false;
        this.transactionUpdating = false;
        this.wallet = wallet;
        let { uid, network } = wallet;
        let sNetwork = exports.internalNames[network] || network;
        //this.restore();
        if (typeof indexedDB != "undefined")
            this.idb = new indexed_db_1.iDB({ storeName: "tx", dbName: "pugdag_" + uid + "_" + sNetwork });
    }
    add(tx, skipSave = false) {
        //console.log("idb add:tx:", "ts:"+tx.ts, "skipSave:"+skipSave, tx)
        if (this.store.has(tx.id))
            return false;
        this.store.set(tx.id, tx);
        this.emitTx(tx);
        if (this.store.size > TXStore.MAX)
            this.store = new Map([...this.store.entries()].slice(-TXStore.MAX));
        if (!skipSave)
            this.save(tx);
        return true;
    }
    removePendingUTXO(utxo, address = '') {
        let id = utxo.transactionId + ":" + utxo.index;
        let dbItem = this.store.get(id);
        if (dbItem) {
            dbItem.isMoved = true;
            this.store.set(id, dbItem);
            this.save(dbItem);
        }
        else {
            dbItem = {
                in: true,
                ts: Date.now(),
                id,
                amount: utxo.amount,
                address,
                blueScore: utxo.blockDaaScore,
                tx: false, //TODO
                isMoved: true,
                isCoinbase: false
            };
        }
        this.emitTx(dbItem);
    }
    fetchTransactions(txIds) {
        return fetch(`${API_BASE}transactions/search?fields=transaction_id%2Cblock_time`, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'content-type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify({ "transactionIds": txIds })
        })
            .catch(err => {
            this.wallet.logger.debug("ExplorerAPI transactions/search : error", err);
        })
            .then((response) => {
            this.wallet.logger.debug("ExplorerAPI transactions/search, txIds:", txIds, "Response:", response);
            if (response) {
                return response.json();
            }
        })
            .then(data => {
            this.wallet.logger.debug("ExplorerAPI transactions/search, data:", data);
            if (Array.isArray(data))
                return data;
            return [];
        });
    }
    fetchTxTime(txIds) {
        return __awaiter(this, void 0, void 0, function* () {
            let txs = yield this.fetchTransactions(txIds);
            //this.wallet.logger.info("fetchTransactions: result", txs);
            let txid2time = {};
            if (Array.isArray(txs)) {
                txs.forEach(tx => {
                    txid2time[tx.transaction_id] = tx.block_time;
                });
            }
            return txid2time;
        });
    }
    addAddressUTXOs(address, utxos, ts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!utxos.length || this.wallet.addressManager.isOurChange(address))
                return;
            utxos.forEach(utxo => {
                let item = {
                    in: true,
                    ts: ts || Date.now(),
                    id: utxo.transactionId + ":" + utxo.index,
                    amount: utxo.amount,
                    address,
                    blueScore: utxo.blockDaaScore,
                    isCoinbase: utxo.isCoinbase,
                    tx: false //TODO
                };
                this.add(item);
            });
        });
    }
    addFromUTXOs(list) {
        let ts = Date.now();
        list.forEach((utxos, address) => {
            this.addAddressUTXOs(address, utxos, ts);
        });
    }
    save(tx) {
        var _a;
        if (this.wallet.options.updateTxTimes) {
            this.updateTransactionTime(tx.id);
        }
        if (typeof indexedDB != "undefined") {
            (_a = this.idb) === null || _a === void 0 ? void 0 : _a.set(tx.id, JSON.stringify(tx));
        }
    }
    updateTransactionTime(id) {
        this.wallet.logger.debug("updateTransactionTime", id);
        this.pendingUpdate.push(id);
        if (this.updateTxTimeoutId) {
            clearTimeout(this.updateTxTimeoutId);
        }
        if (this.pendingUpdate.length > 500) {
            this.updateTransactionTimeImpl();
        }
        else {
            this.updateTxTimeoutId = setTimeout(() => {
                this.updateTransactionTimeImpl();
            }, 10000);
        }
    }
    emitTx(tx) {
        if (this.wallet.syncSignal && !this.wallet.syncInProggress) {
            if (tx.isMoved) {
                this.wallet.emit("moved-transaction", tx);
            }
            else {
                this.wallet.emit("new-transaction", tx);
            }
            return;
        }
        if (this.emitTxTimeoutId) {
            clearTimeout(this.emitTxTimeoutId);
        }
        this.txToEmitList.push(tx);
        if (this.txToEmitList.length > 500) {
            this.emitTxs();
        }
        else {
            this.emitTxTimeoutId = setTimeout(() => {
                this.emitTxs();
            }, 3000);
        }
    }
    emitTxs() {
        let list = this.txToEmitList;
        this.txToEmitList = [];
        this.wallet.emit("transactions", list);
    }
    emitUpdateTx(tx) {
        this.updatedTxToEmitList.push(tx);
        if (this.emitUpdateTxTimeoutId) {
            clearTimeout(this.emitUpdateTxTimeoutId);
        }
        if (this.updatedTxToEmitList.length > 500) {
            this.emitUpdateTxImpl();
        }
        else {
            this.emitUpdateTxTimeoutId = setTimeout(() => {
                this.emitUpdateTxImpl();
            }, 3000);
        }
    }
    emitUpdateTxImpl() {
        let list = this.updatedTxToEmitList;
        this.updatedTxToEmitList = [];
        this.wallet.emit("update-transactions", list);
    }
    startUpdatingTransactions(version = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            this.wallet.logger.info("startUpdatingTransactions:", this.updatingTransactionsInprogress);
            if (this.updatingTransactionsInprogress) {
                this.wallet.emit("transactions-update-status", { status: "in-progress" });
                return false;
            }
            let { txWithMissingVersion: ids } = yield this.getDBEntries(version);
            if (ids.length) {
                this.updatingTransactionsInprogress = true;
                this.wallet.emit("transactions-update-status", { status: "started" });
                yield this.updateTransactionTimeImpl(ids, true, () => {
                    this.updatingTransactionsInprogress = false;
                    this.wallet.emit("transactions-update-status", { status: "finished" });
                });
            }
            else {
                this.wallet.emit("transactions-update-status", { status: "finished", total: 0, updated: 0 });
            }
            return true;
        });
    }
    updateTransactionTimeImpl(txIdList = null, notify = false, callback = null) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.transactionUpdating) {
                setTimeout(() => {
                    this.updateTransactionTimeImpl(txIdList, notify, callback);
                }, 2000);
                return;
            }
            this.transactionUpdating = true;
            let ids = txIdList || this.pendingUpdate;
            let total = 0;
            this.pendingUpdate = [];
            this.wallet.logger.debug("updateTransactionTimeImpl:", ids);
            const CHUNK_SIZE = 500;
            let chunks = [];
            let txIds = [];
            let txId2Id = {};
            ids.map(id => {
                let txId = id.split(":")[0];
                if (!txId2Id[txId]) {
                    txId2Id[txId] = [];
                    txIds.push(txId);
                    total++;
                    if (txIds.length == CHUNK_SIZE) {
                        chunks.push(txIds);
                        txIds = [];
                    }
                }
                txId2Id[txId].push(id);
            });
            if (notify) {
                this.wallet.emit("transactions-update-status", {
                    status: "progress",
                    total,
                    updated: 0
                });
            }
            if (txIds.length) {
                chunks.push(txIds);
            }
            const updateTx = (id, ts = 0) => __awaiter(this, void 0, void 0, function* () {
                let tx = null;
                if (this.idb) {
                    let txStr = yield this.idb.get(id);
                    try {
                        tx = JSON.parse(txStr);
                    }
                    catch (e) {
                        tx = {};
                    }
                }
                tx = tx || {};
                if (ts) {
                    tx.ts = ts;
                    tx.version = 2;
                }
                else {
                    tx.version = 1;
                }
                if (tx.id == id && this.idb) {
                    this.idb.set(id, JSON.stringify(tx));
                }
                tx.id = id;
                this.emitUpdateTx(tx);
                this.wallet.logger.debug("updateTransactionTimeImpl: tx updated", id, "ts:", ts, tx);
            });
            let updatedCount = 0;
            let fetch_txs = () => __awaiter(this, void 0, void 0, function* () {
                let txIds = chunks.shift();
                //this.wallet.logger.info("updateTransactionTimeImpl: fetch_txs", txIds);
                if (!txIds) {
                    this.transactionUpdating = false;
                    callback === null || callback === void 0 ? void 0 : callback();
                    return;
                }
                let count = txIds.length;
                let txId2time = yield this.fetchTxTime(txIds);
                //this.wallet.logger.info("updateTransactionTimeImpl: txId2time", txId2time);
                Object.keys(txId2time).forEach(txId => {
                    let ts = txId2time[txId];
                    let index = txIds.indexOf(txId);
                    if (index > -1) {
                        txIds.splice(index, 1);
                    }
                    txId2Id[txId].forEach((id) => __awaiter(this, void 0, void 0, function* () {
                        yield updateTx(id, ts);
                    }));
                });
                //txs which failed to fetch
                if (this.idb) {
                    txIds.map(txId => {
                        txId2Id[txId].forEach((id) => __awaiter(this, void 0, void 0, function* () {
                            yield updateTx(id);
                        }));
                    });
                }
                updatedCount += count;
                if (notify) {
                    this.wallet.emit("transactions-update-status", {
                        status: "progress",
                        total,
                        updated: updatedCount
                    });
                }
                setTimeout(fetch_txs, 2000);
            });
            setTimeout(fetch_txs, 1000);
        });
    }
    getDBEntries(version = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.idb) {
                return {
                    list: [],
                    txWithMissingVersion: []
                };
            }
            let entries = (yield this.idb.entries().catch((err) => {
                console.log("tx-store: entries():error", err);
            })) || [];
            let length = entries.length;
            console.log("tx-entries length:", length);
            let list = [];
            let ids = [];
            for (let i = 0; i < length; i++) {
                let [key, txStr] = entries[i];
                if (!txStr)
                    continue;
                try {
                    let tx = JSON.parse(txStr);
                    if (tx.version === undefined || (version && tx.version != version)) {
                        ids.push(tx.id);
                    }
                    list.push(tx);
                }
                catch (e) {
                    this.wallet.logger.error("LS-TX parse error - 104:", txStr, e);
                }
            }
            return {
                list,
                txWithMissingVersion: ids
            };
        });
    }
    restore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.idb) {
                let { list } = yield this.getDBEntries();
                list.sort((a, b) => {
                    return a.ts - b.ts;
                }).map(o => {
                    this.add(o, true);
                });
            }
        });
    }
}
exports.TXStore = TXStore;
TXStore.MAX = 20000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHgtc3RvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi93YWxsZXQvdHgtc3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQ0EsNkNBQWlDO0FBR2pDLE1BQU0sUUFBUSxHQUFHLDhCQUE4QixDQUFDO0FBc0JuQyxRQUFBLGFBQWEsR0FBRztJQUM1QixPQUFPLEVBQUcsU0FBUztJQUNuQixPQUFPLEVBQUUsU0FBUztJQUNsQixPQUFPLEVBQUcsU0FBUztJQUNuQixXQUFXLEVBQUUsU0FBUztJQUN0QixVQUFVLEVBQUUsUUFBUTtJQUNwQixVQUFVLEVBQUUsUUFBUTtJQUNuQixVQUFVLEVBQUUsWUFBWTtDQUN6QixDQUFBO0FBRUQsTUFBYSxPQUFPO0lBU25CLFlBQVksTUFBYTtRQUx6QixVQUFLLEdBQTRCLElBQUksR0FBRyxFQUFFLENBQUM7UUFDM0MsaUJBQVksR0FBaUIsRUFBRSxDQUFDO1FBQ2hDLHdCQUFtQixHQUFpQixFQUFFLENBQUM7UUFxSHZDLGtCQUFhLEdBQVksRUFBRSxDQUFDO1FBQzVCLHNCQUFpQixHQUF1QixJQUFJLENBQUM7UUErQzdDLG9CQUFlLEdBQXVCLElBQUksQ0FBQztRQUMzQywwQkFBcUIsR0FBdUIsSUFBSSxDQUFDO1FBc0JqRCxtQ0FBOEIsR0FBVyxLQUFLLENBQUM7UUFzQi9DLHdCQUFtQixHQUFXLEtBQUssQ0FBQztRQTlNbkMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxFQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUMsR0FBRyxNQUFNLENBQUM7UUFDNUIsSUFBSSxRQUFRLEdBQVUscUJBQWEsQ0FBQyxPQUFPLENBQUMsSUFBRSxPQUFPLENBQUM7UUFDdEQsaUJBQWlCO1FBQ2pCLElBQUcsT0FBTyxTQUFTLElBQUksV0FBVztZQUNqQyxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksZ0JBQUcsQ0FBQyxFQUFDLFNBQVMsRUFBQyxJQUFJLEVB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QUFDO2dCQUNmLENBQUM7Z0JBQUEsT0FBTSxDQUFDLEVBQUMsQ0FBQztvQkFDVCxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsMEJBQTBCLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFBO2dCQUMvRCxDQUFDO1lBQ0YsQ0FBQztZQUVELE9BQU87Z0JBQ04sSUFBSTtnQkFDSixvQkFBb0IsRUFBQyxHQUFHO2FBQ3hCLENBQUE7UUFDRixDQUFDO0tBQUE7SUFDSyxPQUFPOztZQUNaLElBQUcsSUFBSSxDQUFDLEdBQUcsRUFBQyxDQUFDO2dCQUNaLElBQUksRUFBQyxJQUFJLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFFdkMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRTtvQkFDakIsT0FBTyxDQUFDLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUEsRUFBRTtvQkFDVCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtnQkFDbEIsQ0FBQyxDQUFDLENBQUE7WUFDSCxDQUFDO1FBQ0YsQ0FBQztLQUFBOztBQTdYRiwwQkE4WEM7QUE1WE8sV0FBRyxHQUFHLEtBQUssQUFBUixDQUFTIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtXYWxsZXR9IGZyb20gJy4vd2FsbGV0JztcbmltcG9ydCB7aURCfSBmcm9tICcuL2luZGV4ZWQtZGInO1xuaW1wb3J0IHtBcGl9IGZyb20gJ2N1c3RvbS10eXBlcyc7XG5cbmNvbnN0IEFQSV9CQVNFID0gXCJodHRwczovL2FwaS5rYXJsc2VuY29pbi5jb20vXCI7XG5cbmludGVyZmFjZSBBUElUeHtcblx0YmxvY2tfdGltZTpudW1iZXIsXG5cdHRyYW5zYWN0aW9uX2lkOnN0cmluZ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRYU3RvcmVJdGVte1xuXHRpbjpib29sZWFuO1xuXHR0czpudW1iZXI7XG5cdGlkOnN0cmluZztcblx0YW1vdW50Om51bWJlcjtcblx0YWRkcmVzczpzdHJpbmc7XG5cdGJsdWVTY29yZTpudW1iZXI7XG5cdG5vdGU/OnN0cmluZztcblx0dHg/OmFueSxcblx0bXlBZGRyZXNzPzpib29sZWFuLFxuXHRpc0NvaW5iYXNlOmJvb2xlYW4sXG5cdGlzTW92ZWQ/OmJvb2xlYW4sXG5cdHZlcnNpb24/Om51bWJlclxufVxuXG5leHBvcnQgY29uc3QgaW50ZXJuYWxOYW1lcyA9IHtcblx0bWFpbm5ldCA6IFwiZGVmYXVsdFwiLFxuXHRrYXJsc2VuOiBcImRlZmF1bHRcIixcblx0dGVzdG5ldCA6IFwidGVzdG5ldFwiLFxuXHRrYXJsc2VudGVzdDogXCJ0ZXN0bmV0XCIsXG5cdGthcmxzZW5zaW06IFwic2ltbmV0XCIsXG5cdGthcmxzZW5kZXY6IFwiZGV2bmV0XCIsXG4gIGthcmxzZW5yZWc6IFwia2FybHNlbnJlZ1wiXG59XG5cbmV4cG9ydCBjbGFzcyBUWFN0b3Jle1xuXG5cdHN0YXRpYyBNQVggPSAyMDAwMDtcblx0d2FsbGV0OldhbGxldDtcblx0c3RvcmU6TWFwPHN0cmluZywgVFhTdG9yZUl0ZW0+ID0gbmV3IE1hcCgpO1xuXHR0eFRvRW1pdExpc3Q6VFhTdG9yZUl0ZW1bXSA9IFtdO1xuXHR1cGRhdGVkVHhUb0VtaXRMaXN0OlRYU3RvcmVJdGVtW10gPSBbXTtcblx0aWRiOmlEQnx1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3Iod2FsbGV0OldhbGxldCl7XG5cdFx0dGhpcy53YWxsZXQgPSB3YWxsZXQ7XG5cdFx0bGV0IHt1aWQsIG5ldHdvcmt9ID0gd2FsbGV0O1xuXHRcdGxldCBzTmV0d29yazpzdHJpbmcgPSBpbnRlcm5hbE5hbWVzW25ldHdvcmtdfHxuZXR3b3JrO1xuXHRcdC8vdGhpcy5yZXN0b3JlKCk7XG5cdFx0aWYodHlwZW9mIGluZGV4ZWREQiAhPSBcInVuZGVmaW5lZFwiKVxuXHRcdFx0dGhpcy5pZGIgPSBuZXcgaURCKHtzdG9yZU5hbWU6XCJ0eFwiLCBkYk5hbWU6XCJrYXJsc2VuX1wiK3VpZCtcIl9cIitzTmV0d29ya30pO1xuXHR9XG5cblx0YWRkKHR4OlRYU3RvcmVJdGVtLCBza2lwU2F2ZT1mYWxzZSl7XG5cdFx0Ly9jb25zb2xlLmxvZyhcImlkYiBhZGQ6dHg6XCIsIFwidHM6XCIrdHgudHMsIFwic2tpcFNhdmU6XCIrc2tpcFNhdmUsIHR4KVxuXHRcdGlmKHRoaXMuc3RvcmUuaGFzKHR4LmlkKSlcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR0aGlzLnN0b3JlLnNldCh0eC5pZCwgdHgpO1xuXHRcdHRoaXMuZW1pdFR4KHR4KTtcblx0XHRpZih0aGlzLnN0b3JlLnNpemUgPiBUWFN0b3JlLk1BWClcblx0XHRcdHRoaXMuc3RvcmUgPSBuZXcgTWFwKFsuLi50aGlzLnN0b3JlLmVudHJpZXMoKV0uc2xpY2UoLVRYU3RvcmUuTUFYKSk7XG5cdFx0aWYoIXNraXBTYXZlKVxuXHRcdFx0dGhpcy5zYXZlKHR4KTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRyZW1vdmVQZW5kaW5nVVRYTyh1dHhvOkFwaS5VdHhvLCBhZGRyZXNzOnN0cmluZz0nJyl7XG5cdFx0bGV0IGlkID0gdXR4by50cmFuc2FjdGlvbklkK1wiOlwiK3V0eG8uaW5kZXg7XG5cdFx0bGV0IGRiSXRlbSA9IHRoaXMuc3RvcmUuZ2V0KGlkKTtcblx0XHRpZihkYkl0ZW0pe1xuXHRcdFx0ZGJJdGVtLmlzTW92ZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5zdG9yZS5zZXQoaWQsIGRiSXRlbSk7XG5cdFx0XHR0aGlzLnNhdmUoZGJJdGVtKTtcblx0XHR9ZWxzZXtcblx0XHRcdGRiSXRlbSA9IHtcblx0XHRcdFx0aW46IHRydWUsXG5cdFx0XHRcdHRzOiBEYXRlLm5vdygpLFxuXHRcdFx0XHRpZCxcblx0XHRcdFx0YW1vdW50OiB1dHhvLmFtb3VudCxcblx0XHRcdFx0YWRkcmVzcyxcblx0XHRcdFx0Ymx1ZVNjb3JlOnV0eG8uYmxvY2tEYWFTY29yZSxcblx0XHRcdFx0dHg6ZmFsc2UsLy9UT0RPXG5cdFx0XHRcdGlzTW92ZWQ6dHJ1ZSxcblx0XHRcdFx0aXNDb2luYmFzZTpmYWxzZVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0dGhpcy5lbWl0VHgoZGJJdGVtKTtcblx0fVxuXHRmZXRjaFRyYW5zYWN0aW9ucyh0eElkczpzdHJpbmdbXSk6UHJvbWlzZTxBUElUeFtdPiB7XG5cdFx0cmV0dXJuIGZldGNoKGAke0FQSV9CQVNFfXRyYW5zYWN0aW9ucy9zZWFyY2g/ZmllbGRzPXRyYW5zYWN0aW9uX2lkJTJDYmxvY2tfdGltZWAsIHtcblx0XHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHRcdCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG5cdFx0XHRcdFx0J2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRtZXRob2Q6IFwiUE9TVFwiLFxuXHRcdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeSh7IFwidHJhbnNhY3Rpb25JZHNcIjogdHhJZHMgfSlcblx0XHRcdH0pXG5cdFx0XHQuY2F0Y2goZXJyPT57XG5cdFx0XHRcdHRoaXMud2FsbGV0LmxvZ2dlci5kZWJ1ZyhcIkV4cGxvcmVyQVBJIHRyYW5zYWN0aW9ucy9zZWFyY2ggOiBlcnJvclwiLCBlcnIpO1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKChyZXNwb25zZTp2b2lkfFJlc3BvbnNlKSA9PiB7XG5cdFx0XHRcdHRoaXMud2FsbGV0LmxvZ2dlci5kZWJ1ZyhcIkV4cGxvcmVyQVBJIHRyYW5zYWN0aW9ucy9zZWFyY2gsIHR4SWRzOlwiLCB0eElkcywgIFwiUmVzcG9uc2U6XCIsIHJlc3BvbnNlKTtcblx0XHRcdFx0aWYgKHJlc3BvbnNlKXtcblx0XHRcdFx0XHRyZXR1cm4gcmVzcG9uc2UuanNvbigpXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0XHQudGhlbihkYXRhID0+IHtcblx0XHRcdFx0dGhpcy53YWxsZXQubG9nZ2VyLmRlYnVnKFwiRXhwbG9yZXJBUEkgdHJhbnNhY3Rpb25zL3NlYXJjaCwgZGF0YTpcIiwgZGF0YSk7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KGRhdGEpKVxuXHRcdFx0XHRcdHJldHVybiBkYXRhXG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH0pO1xuXHR9XG5cdGFzeW5jIGZldGNoVHhUaW1lKHR4SWRzOnN0cmluZ1tdKTpQcm9taXNlPFJlY29yZDxzdHJpbmcsIG51bWJlcj4+e1xuXHRcdGxldCB0eHMgPSBhd2FpdCB0aGlzLmZldGNoVHJhbnNhY3Rpb25zKHR4SWRzKTtcblx0XHQvL3RoaXMud2FsbGV0LmxvZ2dlci5pbmZvKFwiZmV0Y2hUcmFuc2FjdGlvbnM6IHJlc3VsdFwiLCB0eHMpO1xuXHRcdGxldCB0eGlkMnRpbWU6UmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9O1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHR4cykpe1xuXHRcdFx0dHhzLmZvckVhY2godHg9Pntcblx0XHRcdFx0dHhpZDJ0aW1lW3R4LnRyYW5zYWN0aW9uX2lkXSA9IHR4LmJsb2NrX3RpbWU7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHhpZDJ0aW1lO1xuXHR9XG5cdGFzeW5jIGFkZEFkZHJlc3NVVFhPcyhhZGRyZXNzOnN0cmluZywgdXR4b3M6QXBpLlV0eG9bXSwgdHM/Om51bWJlcil7XG5cdFx0aWYoIXV0eG9zLmxlbmd0aCB8fCB0aGlzLndhbGxldC5hZGRyZXNzTWFuYWdlci5pc091ckNoYW5nZShhZGRyZXNzKSlcblx0XHRcdHJldHVyblxuXG5cdFx0dXR4b3MuZm9yRWFjaCh1dHhvPT57XG5cdFx0XHRsZXQgaXRlbSA9IHtcblx0XHRcdFx0aW46IHRydWUsXG5cdFx0XHRcdHRzOiB0c3x8RGF0ZS5ub3coKSxcblx0XHRcdFx0aWQ6IHV0eG8udHJhbnNhY3Rpb25JZCtcIjpcIit1dHhvLmluZGV4LFxuXHRcdFx0XHRhbW91bnQ6IHV0eG8uYW1vdW50LFxuXHRcdFx0XHRhZGRyZXNzLFxuXHRcdFx0XHRibHVlU2NvcmU6dXR4by5ibG9ja0RhYVNjb3JlLFxuXHRcdFx0XHRpc0NvaW5iYXNlOnV0eG8uaXNDb2luYmFzZSxcblx0XHRcdFx0dHg6ZmFsc2UvL1RPRE9cblx0XHRcdH07XG5cdFx0XHR0aGlzLmFkZChpdGVtKTtcblx0XHR9KVxuXHR9XG5cdGFkZEZyb21VVFhPcyhsaXN0Ok1hcDxzdHJpbmcsIEFwaS5VdHhvW10+KXtcblx0XHRsZXQgdHMgPSBEYXRlLm5vdygpO1xuXHRcdGxpc3QuZm9yRWFjaCgodXR4b3MsIGFkZHJlc3MpPT57XG5cdFx0XHR0aGlzLmFkZEFkZHJlc3NVVFhPcyhhZGRyZXNzLCB1dHhvcywgdHMpXG5cdFx0fSlcblx0fVxuXG5cdHNhdmUodHg6VFhTdG9yZUl0ZW0pe1xuXHRcdGlmICh0aGlzLndhbGxldC5vcHRpb25zLnVwZGF0ZVR4VGltZXMpe1xuXHRcdFx0dGhpcy51cGRhdGVUcmFuc2FjdGlvblRpbWUodHguaWQpO1xuXHRcdH1cblx0XHRpZih0eXBlb2YgaW5kZXhlZERCICE9IFwidW5kZWZpbmVkXCIpe1xuXHRcdFx0dGhpcy5pZGI/LnNldCh0eC5pZCwgSlNPTi5zdHJpbmdpZnkodHgpKVxuXHRcdH1cblx0fVxuXG5cdHBlbmRpbmdVcGRhdGU6c3RyaW5nW10gPSBbXTtcblx0dXBkYXRlVHhUaW1lb3V0SWQ6Tm9kZUpTLlRpbWVvdXR8bnVsbCA9IG51bGw7XG5cdHVwZGF0ZVRyYW5zYWN0aW9uVGltZShpZDpzdHJpbmcpe1xuXHRcdHRoaXMud2FsbGV0LmxvZ2dlci5kZWJ1ZyhcInVwZGF0ZVRyYW5zYWN0aW9uVGltZVwiLCBpZCk7XG5cblx0XHR0aGlzLnBlbmRpbmdVcGRhdGUucHVzaChpZCk7XG5cdFx0aWYgKHRoaXMudXBkYXRlVHhUaW1lb3V0SWQpe1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMudXBkYXRlVHhUaW1lb3V0SWQpO1xuXHRcdH1cblx0XG5cdFx0aWYodGhpcy5wZW5kaW5nVXBkYXRlLmxlbmd0aCA+IDUwMCl7XG5cdFx0XHR0aGlzLnVwZGF0ZVRyYW5zYWN0aW9uVGltZUltcGwoKTtcblx0XHR9ZWxzZXtcblx0XHRcdHRoaXMudXBkYXRlVHhUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpPT57XG5cdFx0XHRcdHRoaXMudXBkYXRlVHJhbnNhY3Rpb25UaW1lSW1wbCgpO1xuXHRcdFx0fSwgMTAwMDApO1xuXHRcdH1cblx0fVxuXG5cdGVtaXRUeCh0eDpUWFN0b3JlSXRlbSl7XG5cdFx0aWYodGhpcy53YWxsZXQuc3luY1NpZ25hbCAmJiAhdGhpcy53YWxsZXQuc3luY0luUHJvZ2dyZXNzKXtcblx0XHRcdGlmKHR4LmlzTW92ZWQpe1xuXHRcdFx0XHR0aGlzLndhbGxldC5lbWl0KFwibW92ZWQtdHJhbnNhY3Rpb25cIiwgdHgpO1xuXHRcdFx0fWVsc2V7XG5cdFx0XHRcdHRoaXMud2FsbGV0LmVtaXQoXCJuZXctdHJhbnNhY3Rpb25cIiwgdHgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmVtaXRUeFRpbWVvdXRJZCl7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5lbWl0VHhUaW1lb3V0SWQpO1xuXHRcdH1cblxuXHRcdHRoaXMudHhUb0VtaXRMaXN0LnB1c2godHgpO1xuXHRcdGlmKHRoaXMudHhUb0VtaXRMaXN0Lmxlbmd0aCA+IDUwMCl7XG5cdFx0XHR0aGlzLmVtaXRUeHMoKTtcblx0XHR9ZWxzZXtcblx0XHRcdHRoaXMuZW1pdFR4VGltZW91dElkID0gc2V0VGltZW91dCgoKT0+e1xuXHRcdFx0XHR0aGlzLmVtaXRUeHMoKTtcblx0XHRcdH0sIDMwMDApO1xuXHRcdH1cblx0fVxuXHRlbWl0VHhzKCl7XG5cdFx0bGV0IGxpc3QgPSB0aGlzLnR4VG9FbWl0TGlzdDtcblx0XHR0aGlzLnR4VG9FbWl0TGlzdCA9IFtdO1xuXHRcdHRoaXMud2FsbGV0LmVtaXQoXCJ0cmFuc2FjdGlvbnNcIiwgbGlzdCk7XG5cdH1cblxuXHRlbWl0VHhUaW1lb3V0SWQ6Tm9kZUpTLlRpbWVvdXR8bnVsbCA9IG51bGw7XG5cdGVtaXRVcGRhdGVUeFRpbWVvdXRJZDpOb2RlSlMuVGltZW91dHxudWxsID0gbnVsbDtcblx0ZW1pdFVwZGF0ZVR4KHR4OlRYU3RvcmVJdGVtKXtcblx0XHR0aGlzLnVwZGF0ZWRUeFRvRW1pdExpc3QucHVzaCh0eCk7XG5cdFx0aWYgKHRoaXMuZW1pdFVwZGF0ZVR4VGltZW91dElkKXtcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLmVtaXRVcGRhdGVUeFRpbWVvdXRJZCk7XG5cdFx0fVxuXHRcblx0XHRpZih0aGlzLnVwZGF0ZWRUeFRvRW1pdExpc3QubGVuZ3RoID4gNTAwKXtcblx0XHRcdHRoaXMuZW1pdFVwZGF0ZVR4SW1wbCgpO1xuXHRcdH1lbHNle1xuXHRcdFx0dGhpcy5lbWl0VXBkYXRlVHhUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpPT57XG5cdFx0XHRcdHRoaXMuZW1pdFVwZGF0ZVR4SW1wbCgpO1xuXHRcdFx0fSwgMzAwMCk7XG5cdFx0fVxuXHR9XG5cblx0ZW1pdFVwZGF0ZVR4SW1wbCgpe1xuXHRcdGxldCBsaXN0ID0gdGhpcy51cGRhdGVkVHhUb0VtaXRMaXN0O1xuXHRcdHRoaXMudXBkYXRlZFR4VG9FbWl0TGlzdCA9IFtdO1xuXHRcdHRoaXMud2FsbGV0LmVtaXQoXCJ1cGRhdGUtdHJhbnNhY3Rpb25zXCIsIGxpc3QpO1xuXHR9XG5cblx0dXBkYXRpbmdUcmFuc2FjdGlvbnNJbnByb2dyZXNzOmJvb2xlYW4gPSBmYWxzZTtcblx0YXN5bmMgc3RhcnRVcGRhdGluZ1RyYW5zYWN0aW9ucyh2ZXJzaW9uOnVuZGVmaW5lZHxudW1iZXI9dW5kZWZpbmVkKTpQcm9taXNlPGJvb2xlYW4+e1xuXHRcdHRoaXMud2FsbGV0LmxvZ2dlci5pbmZvKFwic3RhcnRVcGRhdGluZ1RyYW5zYWN0aW9uczpcIiwgdGhpcy51cGRhdGluZ1RyYW5zYWN0aW9uc0lucHJvZ3Jlc3MpO1xuXHRcdGlmICh0aGlzLnVwZGF0aW5nVHJhbnNhY3Rpb25zSW5wcm9ncmVzcyl7XG5cdFx0XHR0aGlzLndhbGxldC5lbWl0KFwidHJhbnNhY3Rpb25zLXVwZGF0ZS1zdGF0dXNcIiwge3N0YXR1czpcImluLXByb2dyZXNzXCJ9KTtcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdH1cblx0XHRcblx0XHRsZXQge3R4V2l0aE1pc3NpbmdWZXJzaW9uOmlkc30gPSBhd2FpdCB0aGlzLmdldERCRW50cmllcyh2ZXJzaW9uKTtcblx0XHRcblx0XHRpZiAoaWRzLmxlbmd0aCl7XG5cdFx0XHR0aGlzLnVwZGF0aW5nVHJhbnNhY3Rpb25zSW5wcm9ncmVzcyA9IHRydWU7XG5cdFx0XHR0aGlzLndhbGxldC5lbWl0KFwidHJhbnNhY3Rpb25zLXVwZGF0ZS1zdGF0dXNcIiwge3N0YXR1czpcInN0YXJ0ZWRcIn0pO1xuXHRcdFx0YXdhaXQgdGhpcy51cGRhdGVUcmFuc2FjdGlvblRpbWVJbXBsKGlkcywgdHJ1ZSwgKCk9Pntcblx0XHRcdFx0dGhpcy51cGRhdGluZ1RyYW5zYWN0aW9uc0lucHJvZ3Jlc3MgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy53YWxsZXQuZW1pdChcInRyYW5zYWN0aW9ucy11cGRhdGUtc3RhdHVzXCIsIHtzdGF0dXM6XCJmaW5pc2hlZFwifSk7XG5cdFx0XHR9KTtcblx0XHR9ZWxzZXtcblx0XHRcdHRoaXMud2FsbGV0LmVtaXQoXCJ0cmFuc2FjdGlvbnMtdXBkYXRlLXN0YXR1c1wiLCB7c3RhdHVzOlwiZmluaXNoZWRcIiwgdG90YWw6MCwgdXBkYXRlZDowfSk7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlXG5cdH1cblx0dHJhbnNhY3Rpb25VcGRhdGluZzpib29sZWFuID0gZmFsc2U7XG5cdGFzeW5jIHVwZGF0ZVRyYW5zYWN0aW9uVGltZUltcGwodHhJZExpc3Q6c3RyaW5nW118bnVsbD1udWxsLCBub3RpZnk6Ym9vbGVhbj1mYWxzZSwgY2FsbGJhY2s6RnVuY3Rpb258bnVsbD1udWxsKXtcblx0XHRpZiAodGhpcy50cmFuc2FjdGlvblVwZGF0aW5nKXtcblx0XHRcdHNldFRpbWVvdXQoKCk9Pntcblx0XHRcdFx0dGhpcy51cGRhdGVUcmFuc2FjdGlvblRpbWVJbXBsKHR4SWRMaXN0LCBub3RpZnksIGNhbGxiYWNrKTtcblx0XHRcdH0sIDIwMDApO1xuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXHRcdHRoaXMudHJhbnNhY3Rpb25VcGRhdGluZyA9IHRydWU7XG5cdFx0bGV0IGlkcyA9IHR4SWRMaXN0fHx0aGlzLnBlbmRpbmdVcGRhdGU7XG5cdFx0bGV0IHRvdGFsID0gMDtcblx0XHR0aGlzLnBlbmRpbmdVcGRhdGUgPSBbXTtcblx0XHR0aGlzLndhbGxldC5sb2dnZXIuZGVidWcoXCJ1cGRhdGVUcmFuc2FjdGlvblRpbWVJbXBsOlwiLCBpZHMpO1xuXHRcdGNvbnN0IENIVU5LX1NJWkUgPSA1MDA7XG5cdFx0bGV0IGNodW5rczpzdHJpbmdbXVtdID0gW107XG5cblx0XHRsZXQgdHhJZHM6c3RyaW5nW10gPSBbXTtcblx0XHRsZXQgdHhJZDJJZDpSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7fTtcblxuXHRcdGlkcy5tYXAoaWQ9Pntcblx0XHRcdGxldCB0eElkID0gaWQuc3BsaXQoXCI6XCIpWzBdO1xuXHRcdFx0aWYgKCF0eElkMklkW3R4SWRdKXtcblx0XHRcdFx0dHhJZDJJZFt0eElkXSA9IFtdO1xuXHRcdFx0XHR0eElkcy5wdXNoKHR4SWQpO1xuXHRcdFx0XHR0b3RhbCsrO1xuXHRcdFx0XHRpZiAodHhJZHMubGVuZ3RoID09IENIVU5LX1NJWkUpe1xuXHRcdFx0XHRcdGNodW5rcy5wdXNoKHR4SWRzKTtcblx0XHRcdFx0XHR0eElkcyA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0eElkMklkW3R4SWRdLnB1c2goaWQpO1xuXHRcdH0pXG5cblx0XHRpZiAobm90aWZ5KXtcblx0XHRcdHRoaXMud2FsbGV0LmVtaXQoXCJ0cmFuc2FjdGlvbnMtdXBkYXRlLXN0YXR1c1wiLCB7XG5cdFx0XHRcdHN0YXR1czpcInByb2dyZXNzXCIsXG5cdFx0XHRcdHRvdGFsLFxuXHRcdFx0XHR1cGRhdGVkOjBcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmICh0eElkcy5sZW5ndGgpe1xuXHRcdFx0Y2h1bmtzLnB1c2godHhJZHMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVwZGF0ZVR4ID0gYXN5bmMgKGlkOnN0cmluZywgdHM6bnVtYmVyPTApPT57XG5cdFx0XHRsZXQgdHggPSBudWxsO1xuXHRcdFx0aWYgKHRoaXMuaWRiKXtcblx0XHRcdFx0bGV0IHR4U3RyID0gYXdhaXQgdGhpcy5pZGIuZ2V0KGlkKTtcblx0XHRcdFx0dHJ5e1xuXHRcdFx0XHRcdHR4ID0gSlNPTi5wYXJzZSh0eFN0cik7XG5cdFx0XHRcdH1jYXRjaChlKXtcblx0XHRcdFx0XHR0eCA9IHt9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0eCA9IHR4fHx7fTtcblx0XHRcdFxuXHRcdFx0aWYgKHRzKXtcblx0XHRcdFx0dHgudHMgPSB0cztcblx0XHRcdFx0dHgudmVyc2lvbiA9IDI7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0dHgudmVyc2lvbiA9IDE7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmICh0eC5pZCA9PSBpZCAmJiB0aGlzLmlkYil7XG5cdFx0XHRcdHRoaXMuaWRiLnNldChpZCwgSlNPTi5zdHJpbmdpZnkodHgpKVxuXHRcdFx0fVxuXG5cdFx0XHR0eC5pZCA9IGlkO1xuXG5cdFx0XHR0aGlzLmVtaXRVcGRhdGVUeCh0eCk7XG5cdFx0XHR0aGlzLndhbGxldC5sb2dnZXIuZGVidWcoXCJ1cGRhdGVUcmFuc2FjdGlvblRpbWVJbXBsOiB0eCB1cGRhdGVkXCIsIGlkLCBcInRzOlwiLCB0cywgdHgpO1xuXHRcdH1cblx0XHRsZXQgdXBkYXRlZENvdW50ID0gMDtcblx0XHRsZXQgZmV0Y2hfdHhzID0gYXN5bmMoKT0+e1xuXHRcdFx0bGV0IHR4SWRzID0gY2h1bmtzLnNoaWZ0KCk7XG5cdFx0XHQvL3RoaXMud2FsbGV0LmxvZ2dlci5pbmZvKFwidXBkYXRlVHJhbnNhY3Rpb25UaW1lSW1wbDogZmV0Y2hfdHhzXCIsIHR4SWRzKTtcblx0XHRcdGlmICghdHhJZHMpe1xuXHRcdFx0XHR0aGlzLnRyYW5zYWN0aW9uVXBkYXRpbmcgPSBmYWxzZTtcblx0XHRcdFx0Y2FsbGJhY2s/LigpO1xuXHRcdFx0XHRyZXR1cm5cblx0XHRcdH1cblx0XHRcdGxldCBjb3VudCA9IHR4SWRzLmxlbmd0aDtcblx0XHRcdGxldCB0eElkMnRpbWUgPSBhd2FpdCB0aGlzLmZldGNoVHhUaW1lKHR4SWRzKTtcblx0XHRcdC8vdGhpcy53YWxsZXQubG9nZ2VyLmluZm8oXCJ1cGRhdGVUcmFuc2FjdGlvblRpbWVJbXBsOiB0eElkMnRpbWVcIiwgdHhJZDJ0aW1lKTtcblx0XHRcdE9iamVjdC5rZXlzKHR4SWQydGltZSkuZm9yRWFjaCh0eElkPT57XG5cdFx0XHRcdGxldCB0cyA9IHR4SWQydGltZVt0eElkXTtcblx0XHRcdFx0bGV0IGluZGV4ID0gKHR4SWRzIGFzIHN0cmluZ1tdKS5pbmRleE9mKHR4SWQpO1xuXHRcdFx0XHRpZiAoaW5kZXggPiAtMSl7XG5cdFx0XHRcdFx0KHR4SWRzIGFzIHN0cmluZ1tdKS5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dHhJZDJJZFt0eElkXS5mb3JFYWNoKGFzeW5jKGlkKT0+e1xuXHRcdFx0XHRcdGF3YWl0IHVwZGF0ZVR4KGlkLCB0cyk7XG5cdFx0XHRcdH0pXG5cdFx0XHR9KTtcblxuXHRcdFx0Ly90eHMgd2hpY2ggZmFpbGVkIHRvIGZldGNoXG5cdFx0XHRpZiAodGhpcy5pZGIpe1xuXHRcdFx0XHR0eElkcy5tYXAodHhJZD0+e1xuXHRcdFx0XHRcdHR4SWQySWRbdHhJZF0uZm9yRWFjaChhc3luYyhpZCk9Pntcblx0XHRcdFx0XHRcdGF3YWl0IHVwZGF0ZVR4KGlkKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHR9KVxuXHRcdFx0fVxuXHRcdFx0dXBkYXRlZENvdW50ICs9IGNvdW50O1xuXG5cdFx0XHRpZiAobm90aWZ5KXtcblx0XHRcdFx0dGhpcy53YWxsZXQuZW1pdChcInRyYW5zYWN0aW9ucy11cGRhdGUtc3RhdHVzXCIsIHtcblx0XHRcdFx0XHRzdGF0dXM6XCJwcm9ncmVzc1wiLFxuXHRcdFx0XHRcdHRvdGFsLFxuXHRcdFx0XHRcdHVwZGF0ZWQ6dXBkYXRlZENvdW50XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRzZXRUaW1lb3V0KGZldGNoX3R4cywgMjAwMClcblx0XHR9O1xuXHRcdHNldFRpbWVvdXQoZmV0Y2hfdHhzLCAxMDAwKVxuXHR9XG5cblx0YXN5bmMgZ2V0REJFbnRyaWVzKHZlcnNpb246dW5kZWZpbmVkfG51bWJlcj11bmRlZmluZWQpOlByb21pc2U8e2xpc3Q6VFhTdG9yZUl0ZW1bXSwgdHhXaXRoTWlzc2luZ1ZlcnNpb246c3RyaW5nW119Pntcblx0XHRpZiAoIXRoaXMuaWRiKXtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxpc3Q6W10sXG5cdFx0XHRcdHR4V2l0aE1pc3NpbmdWZXJzaW9uOltdXG5cdFx0XHR9XG5cdFx0fVxuXHRcblx0XHRsZXQgZW50cmllcyA9IGF3YWl0IHRoaXMuaWRiLmVudHJpZXMoKS5jYXRjaCgoZXJyKT0+e1xuXHRcdFx0Y29uc29sZS5sb2coXCJ0eC1zdG9yZTogZW50cmllcygpOmVycm9yXCIsIGVycilcblx0XHR9KXx8W107XG5cdFx0bGV0IGxlbmd0aCA9IGVudHJpZXMubGVuZ3RoO1xuXHRcdGNvbnNvbGUubG9nKFwidHgtZW50cmllcyBsZW5ndGg6XCIsIGxlbmd0aClcblx0XHRsZXQgbGlzdDpUWFN0b3JlSXRlbVtdID0gW107XG5cdFx0bGV0IGlkczpzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAobGV0IGk9MDsgaTxsZW5ndGg7aSsrKXtcblx0XHRcdGxldCBba2V5LCB0eFN0cl0gPSBlbnRyaWVzW2ldXG5cdFx0XHRpZighdHhTdHIpXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0dHJ5e1xuXHRcdFx0XHRsZXQgdHggPSBKU09OLnBhcnNlKHR4U3RyKTtcblx0XHRcdFx0aWYgKHR4LnZlcnNpb24gPT09IHVuZGVmaW5lZCB8fCAodmVyc2lvbiAmJiB0eC52ZXJzaW9uICE9IHZlcnNpb24pKXtcblx0XHRcdFx0XHRpZHMucHVzaCh0eC5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGlzdC5wdXNoKHR4KTtcblx0XHRcdH1jYXRjaChlKXtcblx0XHRcdFx0dGhpcy53YWxsZXQubG9nZ2VyLmVycm9yKFwiTFMtVFggcGFyc2UgZXJyb3IgLSAxMDQ6XCIsIHR4U3RyLCBlKVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRsaXN0LFxuXHRcdFx0dHhXaXRoTWlzc2luZ1ZlcnNpb246aWRzXG5cdFx0fVxuXHR9XG5cdGFzeW5jIHJlc3RvcmUoKXtcblx0XHRpZih0aGlzLmlkYil7XG5cdFx0XHRsZXQge2xpc3R9ID0gYXdhaXQgdGhpcy5nZXREQkVudHJpZXMoKTtcblxuXHRcdFx0bGlzdC5zb3J0KChhLCBiKT0+e1xuXHRcdFx0XHRyZXR1cm4gYS50cy1iLnRzO1xuXHRcdFx0fSkubWFwKG89Pntcblx0XHRcdFx0dGhpcy5hZGQobywgdHJ1ZSlcblx0XHRcdH0pXG5cdFx0fVxuXHR9XG59XG4iXX0=
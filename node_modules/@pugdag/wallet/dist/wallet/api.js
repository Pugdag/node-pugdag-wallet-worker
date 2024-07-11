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
exports.PugdagAPI = exports.ApiError = void 0;
const event_target_impl_1 = require("./event-target-impl");
class ApiError {
    constructor(message, debugInfo = null) {
        //super(...args);
        this.name = 'ApiError';
        this.message = message;
        this.debugInfo = debugInfo;
        if (!Error.captureStackTrace)
            this.stack = ((new Error(message)).stack + "").split("↵").join("\n");
        else
            Error.captureStackTrace(this, ApiError);
    }
    setDebugInfo(info) {
        this.debugInfo = info;
    }
    setExtraDebugInfo(info) {
        this.extraDebugInfo = info;
    }
}
exports.ApiError = ApiError;
const missingRPCProviderError = () => {
    throw new ApiError(`RPC privider is missing. Please set RPC using 
		Wallet.setRPC(rpc_provider).`);
};
class PugdagAPI extends event_target_impl_1.EventTargetImpl {
    constructor() {
        super(...arguments);
        this.isConnected = false;
    }
    // constructor(rpc:IRPC) {
    // 	this.rpc = rpc;
    // }
    setRPC(rpc) {
        this.rpc = rpc;
        rpc.onConnect(() => {
            this._setConnected(true);
        });
        rpc.onDisconnect(() => {
            this._setConnected(false);
        });
    }
    getRPC() {
        // @ts-ignore
        return this.rpc;
    }
    on(type, callback) {
        super.on(type, callback);
        if (type == 'connect' && this.isConnected) {
            //console.log("api.on->connect", this.isConnected, callback)
            callback({}, { type, detail: {}, defaultPrevented: false });
        }
    }
    _setConnected(isConnected) {
        //console.log("wallet.api._setConnected", isConnected)
        this.isConnected = isConnected;
        this.emit(isConnected ? "connect" : 'disconnect');
    }
    buildUtxoMap(entries) {
        let result = new Map();
        entries.map(entry => {
            //console.log("entry", entry)
            let { transactionId, index } = entry.outpoint;
            let { address, utxoEntry } = entry;
            let { amount, scriptPublicKey, blockDaaScore, isCoinbase } = utxoEntry;
            let item = {
                amount,
                scriptPublicKey,
                blockDaaScore,
                transactionId,
                index,
                isCoinbase
            };
            let items = result.get(address);
            if (!items) {
                items = [];
                result.set(address, items);
            }
            items.push(item);
        });
        return result;
    }
    buildOutpointMap(outpoints) {
        const map = new Map();
        outpoints.map(item => {
            let list = map.get(item.address);
            if (!list) {
                list = [];
                map.set(item.address, list);
            }
            list.push(item.outpoint);
        });
        return map;
    }
    getVirtualSelectedParentBlueScore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.getVirtualSelectedParentBlueScore()
                .catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return { blueScore: response.blueScore };
        });
    }
    getVirtualDaaScore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.getBlockDagInfo()
                .catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return { virtualDaaScore: response.virtualDaaScore };
        });
    }
    subscribeVirtualSelectedParentBlueScoreChanged(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.subscribeVirtualSelectedParentBlueScoreChanged(callback)
                .catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return response;
        });
    }
    subscribeVirtualDaaScoreChanged(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.subscribeVirtualDaaScoreChanged(callback)
                .catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return response;
        });
    }
    subscribeUtxosChanged(addresses, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const cb = (res) => {
                // console.log("UtxosChangedNotification:", res)
                const added = this.buildUtxoMap(res.added);
                const removed = this.buildOutpointMap(res.removed);
                callback(added, removed);
            };
            let p = this.rpc.subscribeUtxosChanged(addresses, cb);
            let { _utxosChangedSubUid } = this;
            let { uid } = p;
            this._utxosChangedSubUid = uid;
            const response = yield p.catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (_utxosChangedSubUid)
                this.rpc.unSubscribeUtxosChanged(_utxosChangedSubUid);
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return response;
        });
    }
    getUtxosByAddresses(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.getUtxosByAddresses(addresses).catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return this.buildUtxoMap(response.entries);
        });
    }
    submitTransaction(tx) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            // eslint-disable-next-line
            const response = yield this.rpc.submitTransaction(tx).catch((e) => {
                throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
            });
            //console.log("submitTransaction:result", response)
            if (response.transactionId)
                return response.transactionId;
            if (!response.error)
                response.error = { message: 'Api error. Please try again later. (ERROR: SUBMIT-TX:100)' };
            if (!response.error.errorCode)
                response.error.errorCode = 100;
            throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`, tx);
        });
    }
    getBlock(blockHash) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            // eslint-disable-next-line
            const response = yield this.rpc.getBlock(blockHash).catch((e) => {
                throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            return response.blockVerboseData;
        });
    }
    ;
    // TODO: handle pagination
    getTransactionsByAddresses(addresses, startingBlockHash = "") {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.rpc)
                return missingRPCProviderError();
            const response = yield this.rpc.getTransactionsByAddresses(startingBlockHash, addresses).catch((e) => {
                throw new ApiError(`API connection error. ${e}`);
            });
            if (response.error)
                throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
            let { transactions, lasBlockScanned } = response;
            return { transactions, lasBlockScanned };
        });
    }
}
exports.PugdagAPI = PugdagAPI;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L2FwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFDQSwyREFBbUU7QUFDbkUsTUFBYSxRQUFRO0lBT3BCLFlBQVksT0FBYyxFQUFFLFlBQWMsSUFBSTtRQUM3QyxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUM7UUFDdkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQkFBaUI7WUFDM0IsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzs7WUFFbkUsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsWUFBWSxDQUFDLElBQVE7UUFDcEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7SUFDdkIsQ0FBQztJQUVELGlCQUFpQixDQUFDLElBQVE7UUFDekIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7SUFDNUIsQ0FBQztDQUNEO0FBekJELDRCQXlCQztBQUVELE1BQU0sdUJBQXVCLEdBQUcsR0FBRSxFQUFFO0lBQ25DLE1BQU0sSUFBSSxRQUFRLENBQUM7K0JBQ1csQ0FBQyxDQUFDO0FBQ2pDLENBQUMsQ0FBQTtBQUVELE1BQU0sVUFBVyxTQUFRLG1DQUFlO0lBQXhDOztRQUdDLGdCQUFXLEdBQVcsS0FBSyxDQUFDO0lBK083QixDQUFDO0lBNU9BLDBCQUEwQjtJQUMxQixtQkFBbUI7SUFDbkIsSUFBSTtJQUVKLE1BQU0sQ0FBQyxHQUFRO1FBQ2QsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDZixHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUUsRUFBRTtZQUNqQixJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFCLENBQUMsQ0FBQyxDQUFBO1FBQ0YsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFFLEVBQUU7WUFDcEIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQixDQUFDLENBQUMsQ0FBQTtJQUNILENBQUM7SUFFRCxNQUFNO1FBQ0wsYUFBYTtRQUNiLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUNqQixDQUFDO0lBRUQsRUFBRSxDQUFDLElBQVcsRUFBRSxRQUFzQjtRQUNyQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN6QixJQUFHLElBQUksSUFBSSxTQUFTLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBQyxDQUFDO1lBQ3pDLDREQUE0RDtZQUM1RCxRQUFRLENBQUMsRUFBRSxFQUFFLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxFQUFFLEVBQUUsZ0JBQWdCLEVBQUMsS0FBSyxFQUFDLENBQUMsQ0FBQztRQUN6RCxDQUFDO0lBRUYsQ0FBQztJQUNELGFBQWEsQ0FBQyxXQUFtQjtRQUNoQyxzREFBc0Q7UUFDdEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUEsQ0FBQyxDQUFBLFNBQVMsQ0FBQSxDQUFDLENBQUEsWUFBWSxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELFlBQVksQ0FBQyxPQUFtQztRQUMvQyxJQUFJLE1BQU0sR0FBMkIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUMvQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQSxFQUFFO1lBQ2xCLDZCQUE2QjtZQUM3QixJQUFJLEVBQUMsYUFBYSxFQUFFLEtBQUssRUFBQyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7WUFDNUMsSUFBSSxFQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUMsR0FBRyxLQUFLLENBQUM7WUFDakMsSUFBSSxFQUFDLE1BQU0sRUFBRSxlQUFlLEVBQUUsYUFBYSxFQUFFLFVBQVUsRUFBQyxHQUFHLFNBQVMsQ0FBQztZQUVyRSxJQUFJLElBQUksR0FBYTtnQkFDcEIsTUFBTTtnQkFDTixlQUFlO2dCQUNmLGFBQWE7Z0JBQ2IsYUFBYTtnQkFDYixLQUFLO2dCQUNMLFVBQVU7YUFDVixDQUFBO1lBRUQsSUFBSSxLQUFLLEdBQXdCLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDckQsSUFBRyxDQUFDLEtBQUssRUFBQyxDQUFDO2dCQUNWLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQ1gsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDNUIsQ0FBQztZQUVELEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEIsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxTQUFvRDtRQUNwRSxNQUFNLEdBQUcsR0FBK0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNsRCxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQSxFQUFFO1lBQ25CLElBQUksSUFBSSxHQUE0QixHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMxRCxJQUFHLENBQUMsSUFBSSxFQUFDLENBQUM7Z0JBQ1QsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDVixHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDN0IsQ0FBQztZQUVELElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFCLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxHQUFHLENBQUM7SUFDWixDQUFDO0lBRUssaUNBQWlDOztZQUN0QyxJQUFHLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQ1gsT0FBTyx1QkFBdUIsRUFBRSxDQUFDO1lBRWxDLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQ0FBaUMsRUFBRTtpQkFDbEUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7Z0JBQ1osTUFBTSxJQUFJLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNsRCxDQUFDLENBQUMsQ0FBQTtZQUVGLElBQUksUUFBUSxDQUFDLEtBQUs7Z0JBQ2pCLE1BQU0sSUFBSSxRQUFRLENBQUMsY0FBYyxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsTUFBTSxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFFMUYsT0FBTyxFQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUyxFQUFDLENBQUE7UUFDdkMsQ0FBQztLQUFBO0lBRUssa0JBQWtCOztZQUN2QixJQUFHLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQ1gsT0FBTyx1QkFBdUIsRUFBRSxDQUFDO1lBRWxDLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUU7aUJBQ2hELEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUNaLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbEQsQ0FBQyxDQUFDLENBQUE7WUFFRixJQUFJLFFBQVEsQ0FBQyxLQUFLO2dCQUNqQixNQUFNLElBQUksUUFBUSxDQUFDLGNBQWMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBRTFGLE9BQU8sRUFBQyxlQUFlLEVBQUUsUUFBUSxDQUFDLGVBQWUsRUFBQyxDQUFBO1FBQ25ELENBQUM7S0FBQTtJQUdLLDhDQUE4QyxDQUFDLFFBQTRFOztZQUNoSSxJQUFHLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQ1gsT0FBTyx1QkFBdUIsRUFBRSxDQUFDO1lBRWxDLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyw4Q0FBOEMsQ0FBQyxRQUFRLENBQUM7aUJBQ3ZGLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUNaLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbEQsQ0FBQyxDQUFDLENBQUE7WUFFRixJQUFJLFFBQVEsQ0FBQyxLQUFLO2dCQUNqQixNQUFNLElBQUksUUFBUSxDQUFDLGNBQWMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBRTFGLE9BQU8sUUFBUSxDQUFDO1FBQ2pCLENBQUM7S0FBQTtJQUVLLCtCQUErQixDQUFDLFFBQTZEOztZQUNsRyxJQUFHLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQ1gsT0FBTyx1QkFBdUIsRUFBRSxDQUFDO1lBRWxDLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQywrQkFBK0IsQ0FBQyxRQUFRLENBQUM7aUJBQ3hFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUNaLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbEQsQ0FBQyxDQUFDLENBQUE7WUFFRixJQUFJLFFBQVEsQ0FBQyxLQUFLO2dCQUNqQixNQUFNLElBQUksUUFBUSxDQUFDLGNBQWMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBRTFGLE9BQU8sUUFBUSxDQUFDO1FBQ2pCLENBQUM7S0FBQTtJQUVLLHFCQUFxQixDQUFDLFNBQWtCLEVBQUUsUUFBbUY7O1lBQ2xJLElBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRztnQkFDWCxPQUFPLHVCQUF1QixFQUFFLENBQUM7WUFFbEMsTUFBTSxFQUFFLEdBQThDLENBQUMsR0FBRyxFQUFDLEVBQUU7Z0JBQzVELGdEQUFnRDtnQkFDaEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzNDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ25ELFFBQVEsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDMUIsQ0FBQyxDQUFBO1lBRUQsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUE7WUFFckQsSUFBSSxFQUFDLG1CQUFtQixFQUFDLEdBQUcsSUFBSSxDQUFDO1lBRWpDLElBQUksRUFBQyxHQUFHLEVBQUMsR0FBRyxDQUFDLENBQUM7WUFDZCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsR0FBRyxDQUFDO1lBRS9CLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUNwQyxNQUFNLElBQUksUUFBUSxDQUFDLHlCQUF5QixDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2xELENBQUMsQ0FBQyxDQUFBO1lBRUYsSUFBRyxtQkFBbUI7Z0JBQ3JCLElBQUksQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUd2RCxJQUFJLFFBQVEsQ0FBQyxLQUFLO2dCQUNqQixNQUFNLElBQUksUUFBUSxDQUFDLGNBQWMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBRTFGLE9BQU8sUUFBUSxDQUFDO1FBQ2pCLENBQUM7S0FBQTtJQUVLLG1CQUFtQixDQUFDLFNBQW1COztZQUM1QyxJQUFHLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQ1gsT0FBTyx1QkFBdUIsRUFBRSxDQUFDO1lBRWxDLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtnQkFDMUUsTUFBTSxJQUFJLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNsRCxDQUFDLENBQUMsQ0FBQTtZQUVGLElBQUksUUFBUSxDQUFDLEtBQUs7Z0JBQ2pCLE1BQU0sSUFBSSxRQUFRLENBQUMsY0FBYyxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsTUFBTSxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFHMUYsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO0tBQUE7SUFFSyxpQkFBaUIsQ0FBQyxFQUFnQzs7WUFDdkQsSUFBRyxDQUFDLElBQUksQ0FBQyxHQUFHO2dCQUNYLE9BQU8sdUJBQXVCLEVBQUUsQ0FBQztZQUNsQywyQkFBMkI7WUFDM0IsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUNqRSxNQUFNLElBQUksUUFBUSxDQUFDLHlCQUF5QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsc0JBQXNCO1lBQ3pFLENBQUMsQ0FBQyxDQUFBO1lBQ0YsbURBQW1EO1lBQ25ELElBQUcsUUFBUSxDQUFDLGFBQWE7Z0JBQ3hCLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQztZQUUvQixJQUFHLENBQUMsUUFBUSxDQUFDLEtBQUs7Z0JBQ2pCLFFBQVEsQ0FBQyxLQUFLLEdBQUcsRUFBQyxPQUFPLEVBQUUsMkRBQTJELEVBQUMsQ0FBQztZQUN6RixJQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTO2dCQUMzQixRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUM7WUFFaEMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxjQUFjLFFBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxNQUFNLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDOUYsQ0FBQztLQUFBO0lBR0ssUUFBUSxDQUFDLFNBQWlCOztZQUMvQixJQUFHLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQ1gsT0FBTyx1QkFBdUIsRUFBRSxDQUFDO1lBQ2xDLDJCQUEyQjtZQUMzQixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUMvRCxNQUFNLElBQUksUUFBUSxDQUFDLHlCQUF5QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsc0JBQXNCO1lBQ3pFLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxRQUFRLENBQUMsS0FBSztnQkFDakIsTUFBTSxJQUFJLFFBQVEsQ0FBQyxjQUFjLFFBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxNQUFNLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUUxRixPQUFPLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQztRQUNsQyxDQUFDO0tBQUE7SUFBQSxDQUFDO0lBRUYsMEJBQTBCO0lBQ3BCLDBCQUEwQixDQUMvQixTQUFtQixFQUNuQixvQkFBNEIsRUFBRTs7WUFFOUIsSUFBRyxDQUFDLElBQUksQ0FBQyxHQUFHO2dCQUNYLE9BQU8sdUJBQXVCLEVBQUUsQ0FBQztZQUNsQyxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsMEJBQTBCLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3BHLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbEQsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLFFBQVEsQ0FBQyxLQUFLO2dCQUNqQixNQUFNLElBQUksUUFBUSxDQUFDLGNBQWMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBRTFGLElBQUksRUFBQyxZQUFZLEVBQUUsZUFBZSxFQUFDLEdBQUcsUUFBUSxDQUFDO1lBQy9DLE9BQU8sRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLENBQUE7UUFDekMsQ0FBQztLQUFBO0NBQ0Q7QUFFUSxnQ0FBVSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwaSwgSVJQQywgUlBDIH0gZnJvbSAnY3VzdG9tLXR5cGVzJztcbmltcG9ydCB7RXZlbnRUYXJnZXRJbXBsLCBFdmVudExpc3RlbmVyfSBmcm9tICcuL2V2ZW50LXRhcmdldC1pbXBsJztcbmV4cG9ydCBjbGFzcyBBcGlFcnJvcntcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcblx0bmFtZTpzdHJpbmc7XG5cdG1lc3NhZ2U6c3RyaW5nO1xuXHRzdGFjazphbnk7XG5cdGRlYnVnSW5mbzphbnk7XG5cdGV4dHJhRGVidWdJbmZvOmFueTtcblx0Y29uc3RydWN0b3IobWVzc2FnZTpzdHJpbmcsIGRlYnVnSW5mbzphbnk9bnVsbCkge1xuXHRcdC8vc3VwZXIoLi4uYXJncyk7XG5cdFx0dGhpcy5uYW1lID0gJ0FwaUVycm9yJztcblx0XHR0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuXHRcdHRoaXMuZGVidWdJbmZvID0gZGVidWdJbmZvO1xuXHRcdGlmICghRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpXG5cdFx0XHR0aGlzLnN0YWNrID0gKChuZXcgRXJyb3IobWVzc2FnZSkpLnN0YWNrK1wiXCIpLnNwbGl0KFwi4oa1XCIpLmpvaW4oXCJcXG5cIik7XG5cdFx0ZWxzZVxuXHRcdFx0RXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgQXBpRXJyb3IpO1xuXHR9XG5cblx0c2V0RGVidWdJbmZvKGluZm86YW55KXtcblx0XHR0aGlzLmRlYnVnSW5mbyA9IGluZm87XG5cdH1cblxuXHRzZXRFeHRyYURlYnVnSW5mbyhpbmZvOmFueSl7XG5cdFx0dGhpcy5leHRyYURlYnVnSW5mbyA9IGluZm87XG5cdH1cbn1cblxuY29uc3QgbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IgPSAoKT0+e1xuXHR0aHJvdyBuZXcgQXBpRXJyb3IoYFJQQyBwcml2aWRlciBpcyBtaXNzaW5nLiBQbGVhc2Ugc2V0IFJQQyB1c2luZyBcblx0XHRXYWxsZXQuc2V0UlBDKHJwY19wcm92aWRlcikuYCk7XG59XG5cbmNsYXNzIEthcmxzZW5BUEkgZXh0ZW5kcyBFdmVudFRhcmdldEltcGx7XG5cblx0cnBjPzpJUlBDO1xuXHRpc0Nvbm5lY3RlZDpib29sZWFuID0gZmFsc2U7XG5cdF91dHhvc0NoYW5nZWRTdWJVaWQ6c3RyaW5nfHVuZGVmaW5lZDtcblxuXHQvLyBjb25zdHJ1Y3RvcihycGM6SVJQQykge1xuXHQvLyBcdHRoaXMucnBjID0gcnBjO1xuXHQvLyB9XG5cblx0c2V0UlBDKHJwYzpJUlBDKSB7XG5cdFx0dGhpcy5ycGMgPSBycGM7XG5cdFx0cnBjLm9uQ29ubmVjdCgoKT0+e1xuXHRcdFx0dGhpcy5fc2V0Q29ubmVjdGVkKHRydWUpO1xuXHRcdH0pXG5cdFx0cnBjLm9uRGlzY29ubmVjdCgoKT0+e1xuXHRcdFx0dGhpcy5fc2V0Q29ubmVjdGVkKGZhbHNlKTtcblx0XHR9KVxuXHR9XG5cblx0Z2V0UlBDKCk6SVJQQyB7XG5cdFx0Ly8gQHRzLWlnbm9yZVxuXHRcdHJldHVybiB0aGlzLnJwYztcblx0fVxuXG5cdG9uKHR5cGU6c3RyaW5nLCBjYWxsYmFjazpFdmVudExpc3RlbmVyKXtcblx0XHRzdXBlci5vbih0eXBlLCBjYWxsYmFjayk7XG5cdFx0aWYodHlwZSA9PSAnY29ubmVjdCcgJiYgdGhpcy5pc0Nvbm5lY3RlZCl7XG5cdFx0XHQvL2NvbnNvbGUubG9nKFwiYXBpLm9uLT5jb25uZWN0XCIsIHRoaXMuaXNDb25uZWN0ZWQsIGNhbGxiYWNrKVxuXHRcdFx0Y2FsbGJhY2soe30sIHt0eXBlLCBkZXRhaWw6e30sIGRlZmF1bHRQcmV2ZW50ZWQ6ZmFsc2V9KTtcblx0XHR9XG5cblx0fVxuXHRfc2V0Q29ubmVjdGVkKGlzQ29ubmVjdGVkOmJvb2xlYW4pe1xuXHRcdC8vY29uc29sZS5sb2coXCJ3YWxsZXQuYXBpLl9zZXRDb25uZWN0ZWRcIiwgaXNDb25uZWN0ZWQpXG5cdFx0dGhpcy5pc0Nvbm5lY3RlZCA9IGlzQ29ubmVjdGVkO1xuXHRcdHRoaXMuZW1pdChpc0Nvbm5lY3RlZD9cImNvbm5lY3RcIjonZGlzY29ubmVjdCcpO1xuXHR9XG5cblx0YnVpbGRVdHhvTWFwKGVudHJpZXM6UlBDLlVUWE9zQnlBZGRyZXNzZXNFbnRyeVtdKTpNYXA8c3RyaW5nLCBBcGkuVXR4b1tdPiB7XG5cdFx0bGV0IHJlc3VsdDpNYXA8c3RyaW5nLCBBcGkuVXR4b1tdPiA9IG5ldyBNYXAoKTtcblx0XHRlbnRyaWVzLm1hcChlbnRyeT0+e1xuXHRcdFx0Ly9jb25zb2xlLmxvZyhcImVudHJ5XCIsIGVudHJ5KVxuXHRcdFx0bGV0IHt0cmFuc2FjdGlvbklkLCBpbmRleH0gPSBlbnRyeS5vdXRwb2ludDtcblx0XHRcdGxldCB7YWRkcmVzcywgdXR4b0VudHJ5fSA9IGVudHJ5O1xuXHRcdFx0bGV0IHthbW91bnQsIHNjcmlwdFB1YmxpY0tleSwgYmxvY2tEYWFTY29yZSwgaXNDb2luYmFzZX0gPSB1dHhvRW50cnk7XG5cblx0XHRcdGxldCBpdGVtOiBBcGkuVXR4byA9IHtcblx0XHRcdFx0YW1vdW50LFxuXHRcdFx0XHRzY3JpcHRQdWJsaWNLZXksXG5cdFx0XHRcdGJsb2NrRGFhU2NvcmUsXG5cdFx0XHRcdHRyYW5zYWN0aW9uSWQsXG5cdFx0XHRcdGluZGV4LFxuXHRcdFx0XHRpc0NvaW5iYXNlXG5cdFx0XHR9XG5cblx0XHRcdGxldCBpdGVtczpBcGkuVXR4b1tdfHVuZGVmaW5lZCA9IHJlc3VsdC5nZXQoYWRkcmVzcyk7XG5cdFx0XHRpZighaXRlbXMpe1xuXHRcdFx0XHRpdGVtcyA9IFtdO1xuXHRcdFx0XHRyZXN1bHQuc2V0KGFkZHJlc3MsIGl0ZW1zKTtcblx0XHRcdH1cblxuXHRcdFx0aXRlbXMucHVzaChpdGVtKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRidWlsZE91dHBvaW50TWFwKG91dHBvaW50czoge2FkZHJlc3M6c3RyaW5nLCBvdXRwb2ludDpSUEMuT3V0cG9pbnR9W10pOk1hcDxzdHJpbmcsIFJQQy5PdXRwb2ludFtdPiB7XG5cdFx0Y29uc3QgbWFwOk1hcDxzdHJpbmcsIFJQQy5PdXRwb2ludFtdPiA9IG5ldyBNYXAoKTtcblx0XHRvdXRwb2ludHMubWFwKGl0ZW09Pntcblx0XHRcdGxldCBsaXN0OlJQQy5PdXRwb2ludFtdfHVuZGVmaW5lZCA9IG1hcC5nZXQoaXRlbS5hZGRyZXNzKTtcblx0XHRcdGlmKCFsaXN0KXtcblx0XHRcdFx0bGlzdCA9IFtdO1xuXHRcdFx0XHRtYXAuc2V0KGl0ZW0uYWRkcmVzcywgbGlzdCk7XG5cdFx0XHR9XG5cblx0XHRcdGxpc3QucHVzaChpdGVtLm91dHBvaW50KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBtYXA7XG5cdH1cblxuXHRhc3luYyBnZXRWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmUoKTogUHJvbWlzZTx7Ymx1ZVNjb3JlOm51bWJlcn0+IHtcblx0XHRpZighdGhpcy5ycGMpXG5cdFx0XHRyZXR1cm4gbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IoKTtcblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5ycGMuZ2V0VmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlKClcblx0XHQuY2F0Y2goKGUpID0+IHtcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTtcblx0XHR9KVxuXHRcdFxuXHRcdGlmIChyZXNwb25zZS5lcnJvcilcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGVycm9yICgke3Jlc3BvbnNlLmVycm9yLmVycm9yQ29kZX0pOiAke3Jlc3BvbnNlLmVycm9yLm1lc3NhZ2V9YCk7XG5cblx0XHRyZXR1cm4ge2JsdWVTY29yZTogcmVzcG9uc2UuYmx1ZVNjb3JlfVxuXHR9XG5cdFxuXHRhc3luYyBnZXRWaXJ0dWFsRGFhU2NvcmUoKTogUHJvbWlzZTx7dmlydHVhbERhYVNjb3JlOm51bWJlcn0+IHtcblx0XHRpZighdGhpcy5ycGMpXG5cdFx0XHRyZXR1cm4gbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IoKTtcblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5ycGMuZ2V0QmxvY2tEYWdJbmZvKClcblx0XHQuY2F0Y2goKGUpID0+IHtcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTtcblx0XHR9KVxuXHRcdFxuXHRcdGlmIChyZXNwb25zZS5lcnJvcilcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGVycm9yICgke3Jlc3BvbnNlLmVycm9yLmVycm9yQ29kZX0pOiAke3Jlc3BvbnNlLmVycm9yLm1lc3NhZ2V9YCk7XG5cblx0XHRyZXR1cm4ge3ZpcnR1YWxEYWFTY29yZTogcmVzcG9uc2UudmlydHVhbERhYVNjb3JlfVxuXHR9XG5cdFxuXG5cdGFzeW5jIHN1YnNjcmliZVZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZUNoYW5nZWQoY2FsbGJhY2s6UlBDLmNhbGxiYWNrPFJQQy5WaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVDaGFuZ2VkTm90aWZpY2F0aW9uPikge1xuXHRcdGlmKCF0aGlzLnJwYylcblx0XHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJwYy5zdWJzY3JpYmVWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVDaGFuZ2VkKGNhbGxiYWNrKVxuXHRcdC5jYXRjaCgoZSkgPT4ge1xuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApO1xuXHRcdH0pXG5cdFx0XG5cdFx0aWYgKHJlc3BvbnNlLmVycm9yKVxuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgKCR7cmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlfSk6ICR7cmVzcG9uc2UuZXJyb3IubWVzc2FnZX1gKTtcblxuXHRcdHJldHVybiByZXNwb25zZTtcblx0fVxuXG5cdGFzeW5jIHN1YnNjcmliZVZpcnR1YWxEYWFTY29yZUNoYW5nZWQoY2FsbGJhY2s6UlBDLmNhbGxiYWNrPFJQQy5WaXJ0dWFsRGFhU2NvcmVDaGFuZ2VkTm90aWZpY2F0aW9uPikge1xuXHRcdGlmKCF0aGlzLnJwYylcblx0XHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJwYy5zdWJzY3JpYmVWaXJ0dWFsRGFhU2NvcmVDaGFuZ2VkKGNhbGxiYWNrKVxuXHRcdC5jYXRjaCgoZSkgPT4ge1xuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApO1xuXHRcdH0pXG5cdFx0XG5cdFx0aWYgKHJlc3BvbnNlLmVycm9yKVxuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgKCR7cmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlfSk6ICR7cmVzcG9uc2UuZXJyb3IubWVzc2FnZX1gKTtcblxuXHRcdHJldHVybiByZXNwb25zZTtcblx0fVxuXG5cdGFzeW5jIHN1YnNjcmliZVV0eG9zQ2hhbmdlZChhZGRyZXNzZXM6c3RyaW5nW10sIGNhbGxiYWNrOihhZGRlZDpNYXA8c3RyaW5nLCBBcGkuVXR4b1tdPiwgcmVtb3ZlZDpNYXA8c3RyaW5nLCBSUEMuT3V0cG9pbnRbXT4pPT52b2lkKSB7XG5cdFx0aWYoIXRoaXMucnBjKVxuXHRcdFx0cmV0dXJuIG1pc3NpbmdSUENQcm92aWRlckVycm9yKCk7XG5cblx0XHRjb25zdCBjYjpSUEMuY2FsbGJhY2s8UlBDLlV0eG9zQ2hhbmdlZE5vdGlmaWNhdGlvbj4gPSAocmVzKT0+e1xuXHRcdFx0Ly8gY29uc29sZS5sb2coXCJVdHhvc0NoYW5nZWROb3RpZmljYXRpb246XCIsIHJlcylcblx0XHRcdGNvbnN0IGFkZGVkID0gdGhpcy5idWlsZFV0eG9NYXAocmVzLmFkZGVkKTtcblx0XHRcdGNvbnN0IHJlbW92ZWQgPSB0aGlzLmJ1aWxkT3V0cG9pbnRNYXAocmVzLnJlbW92ZWQpO1xuXHRcdFx0Y2FsbGJhY2soYWRkZWQsIHJlbW92ZWQpO1xuXHRcdH1cblx0XHRcblx0XHRsZXQgcCA9IHRoaXMucnBjLnN1YnNjcmliZVV0eG9zQ2hhbmdlZChhZGRyZXNzZXMsIGNiKVxuXHRcdFxuXHRcdGxldCB7X3V0eG9zQ2hhbmdlZFN1YlVpZH0gPSB0aGlzO1xuXG5cdFx0bGV0IHt1aWR9ID0gcDtcblx0XHR0aGlzLl91dHhvc0NoYW5nZWRTdWJVaWQgPSB1aWQ7XG5cblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHAuY2F0Y2goKGUpID0+IHtcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTtcblx0XHR9KVxuXG5cdFx0aWYoX3V0eG9zQ2hhbmdlZFN1YlVpZClcblx0XHRcdHRoaXMucnBjLnVuU3Vic2NyaWJlVXR4b3NDaGFuZ2VkKF91dHhvc0NoYW5nZWRTdWJVaWQpO1xuXHRcdFxuXHRcdFxuXHRcdGlmIChyZXNwb25zZS5lcnJvcilcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGVycm9yICgke3Jlc3BvbnNlLmVycm9yLmVycm9yQ29kZX0pOiAke3Jlc3BvbnNlLmVycm9yLm1lc3NhZ2V9YCk7XG5cblx0XHRyZXR1cm4gcmVzcG9uc2U7XG5cdH1cblxuXHRhc3luYyBnZXRVdHhvc0J5QWRkcmVzc2VzKGFkZHJlc3Nlczogc3RyaW5nW10pOiBQcm9taXNlPE1hcDxzdHJpbmcsIEFwaS5VdHhvW10+PiB7XG5cdFx0aWYoIXRoaXMucnBjKVxuXHRcdFx0cmV0dXJuIG1pc3NpbmdSUENQcm92aWRlckVycm9yKCk7XG5cdFx0XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJwYy5nZXRVdHhvc0J5QWRkcmVzc2VzKGFkZHJlc3NlcykuY2F0Y2goKGUpID0+IHtcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTtcblx0XHR9KVxuXHRcdFxuXHRcdGlmIChyZXNwb25zZS5lcnJvcilcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGVycm9yICgke3Jlc3BvbnNlLmVycm9yLmVycm9yQ29kZX0pOiAke3Jlc3BvbnNlLmVycm9yLm1lc3NhZ2V9YCk7XG5cblxuXHRcdHJldHVybiB0aGlzLmJ1aWxkVXR4b01hcChyZXNwb25zZS5lbnRyaWVzKTtcblx0fVxuXG5cdGFzeW5jIHN1Ym1pdFRyYW5zYWN0aW9uKHR4OiBSUEMuU3VibWl0VHJhbnNhY3Rpb25SZXF1ZXN0KTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRpZighdGhpcy5ycGMpXG5cdFx0XHRyZXR1cm4gbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IoKTtcblx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucnBjLnN1Ym1pdFRyYW5zYWN0aW9uKHR4KS5jYXRjaCgoZSkgPT4ge1xuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG5cdFx0fSlcblx0XHQvL2NvbnNvbGUubG9nKFwic3VibWl0VHJhbnNhY3Rpb246cmVzdWx0XCIsIHJlc3BvbnNlKVxuXHRcdGlmKHJlc3BvbnNlLnRyYW5zYWN0aW9uSWQpXG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UudHJhbnNhY3Rpb25JZDtcblxuXHRcdGlmKCFyZXNwb25zZS5lcnJvcilcblx0XHRcdHJlc3BvbnNlLmVycm9yID0ge21lc3NhZ2U6ICdBcGkgZXJyb3IuIFBsZWFzZSB0cnkgYWdhaW4gbGF0ZXIuIChFUlJPUjogU1VCTUlULVRYOjEwMCknfTtcblx0XHRpZighcmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlKVxuXHRcdFx0cmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlID0gMTAwO1xuXG5cdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgKCR7cmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlfSk6ICR7cmVzcG9uc2UuZXJyb3IubWVzc2FnZX1gLCB0eCk7XG5cdH1cblxuXG5cdGFzeW5jIGdldEJsb2NrKGJsb2NrSGFzaDogc3RyaW5nKTogUHJvbWlzZTxBcGkuQmxvY2tSZXNwb25zZT4ge1xuXHRcdGlmKCF0aGlzLnJwYylcblx0XHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5ycGMuZ2V0QmxvY2soYmxvY2tIYXNoKS5jYXRjaCgoZSkgPT4ge1xuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG5cdFx0fSk7XG5cblx0XHRpZiAocmVzcG9uc2UuZXJyb3IpXG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAoJHtyZXNwb25zZS5lcnJvci5lcnJvckNvZGV9KTogJHtyZXNwb25zZS5lcnJvci5tZXNzYWdlfWApO1xuXG5cdFx0cmV0dXJuIHJlc3BvbnNlLmJsb2NrVmVyYm9zZURhdGE7XG5cdH07XG5cblx0Ly8gVE9ETzogaGFuZGxlIHBhZ2luYXRpb25cblx0YXN5bmMgZ2V0VHJhbnNhY3Rpb25zQnlBZGRyZXNzZXMoXG5cdFx0YWRkcmVzc2VzOiBzdHJpbmdbXSxcblx0XHRzdGFydGluZ0Jsb2NrSGFzaDogc3RyaW5nID0gXCJcIlxuXHQpOiBQcm9taXNlPEFwaS5UcmFuc2FjdGlvbnNCeUFkZHJlc3Nlc1Jlc3BvbnNlPiB7XG5cdFx0aWYoIXRoaXMucnBjKVxuXHRcdFx0cmV0dXJuIG1pc3NpbmdSUENQcm92aWRlckVycm9yKCk7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJwYy5nZXRUcmFuc2FjdGlvbnNCeUFkZHJlc3NlcyhzdGFydGluZ0Jsb2NrSGFzaCwgYWRkcmVzc2VzKS5jYXRjaCgoZSkgPT4ge1xuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHJlc3BvbnNlLmVycm9yKVxuXHRcdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgKCR7cmVzcG9uc2UuZXJyb3IuZXJyb3JDb2RlfSk6ICR7cmVzcG9uc2UuZXJyb3IubWVzc2FnZX1gKTtcblxuXHRcdGxldCB7dHJhbnNhY3Rpb25zLCBsYXNCbG9ja1NjYW5uZWR9ID0gcmVzcG9uc2U7XG5cdFx0cmV0dXJuIHsgdHJhbnNhY3Rpb25zLCBsYXNCbG9ja1NjYW5uZWQgfVxuXHR9XG59XG5cbmV4cG9ydCB7IEthcmxzZW5BUEkgfVxuIl19
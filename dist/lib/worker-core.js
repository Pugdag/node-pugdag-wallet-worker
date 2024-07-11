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
exports.WorkerCore = exports.workerLog = void 0;
const logger_1 = require("./logger");
Object.defineProperty(exports, "workerLog", { enumerable: true, get: function () { return logger_1.workerLog; } });
const wallet_1 = require("@pugdag/wallet");
const rpc_1 = require("./rpc");
const event_emitter_1 = require("./event-emitter");
class Wallet extends wallet_1.Wallet {
    emit(name, data = {}) {
        super.emit(name, data);
        //@ts-ignore
        postMessage({ op: "wallet-events", data: { name, data } });
    }
}
class WorkerCore extends event_emitter_1.EventEmitter {
    constructor() {
        logger_1.workerLog.debug("WorkerCore:constructor1");
        super();
        this.rpc = new rpc_1.RPC({
            client: new rpc_1.Client(this)
        });
        logger_1.workerLog.debug("WorkerCore:constructor2");
    }
    init() {
        const _super = Object.create(null, {
            init: { get: () => super.init }
        });
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.workerLog.debug("WorkerCore:init");
            _super.init.call(this);
            logger_1.workerLog.debug("before initPugdagFramework");
            yield (0, wallet_1.initPugdagFramework)();
            logger_1.workerLog.debug("after initPugdagFramework");
            addEventListener("message", (event) => {
                let { data: msg } = event;
                let { op, data } = msg;
                if (op != "wallet-init") {
                    logger_1.workerLog.info(`worker op: ${op}, ${JSON.stringify(data)}`);
                }
                if (!op)
                    return;
                this.emit(op, data);
            });
            this.postMessage("ready");
            this.initWalletHanler();
        });
    }
    initWalletHanler() {
        this.on('worker-log-level', (msg) => {
            logger_1.workerLog.setLevel(msg.level);
        });
        this.on('wallet-init', (msg) => {
            //@ts-ignore
            this.rpc.cleanup();
            const { privKey, seedPhrase, networkOptions, options } = msg;
            networkOptions.rpc = this.rpc;
            this.wallet = new Wallet(privKey, seedPhrase, networkOptions, options);
            //workerLog.info("core.wallet", this.wallet)
        });
        this.on("wallet-request", (msg) => __awaiter(this, void 0, void 0, function* () {
            let { fn, rid, args } = msg;
            let { wallet } = this;
            if (!wallet)
                return this.sendWalletResponse(rid, `Wallet not initilized yet. (subject:${fn})`);
            if (!fn)
                return this.sendWalletResponse(rid, "Invalid wallet request.");
            let func;
            //@ts-ignore
            if (typeof this[fn] == 'function') {
                //@ts-ignore
                func = this[fn].bind(this);
                //@ts-ignore
            }
            else if (typeof wallet[fn] == 'function') {
                //@ts-ignore
                func = wallet[fn].bind(wallet);
                //@ts-ignore
            }
            else if (typeof wallet[fn] != undefined) {
                func = () => __awaiter(this, void 0, void 0, function* () {
                    //@ts-ignore
                    return wallet[fn];
                });
            }
            logger_1.workerLog.debug(`wallet-request: ${fn} => ${func}`);
            if (!func) {
                this.sendWalletResponse(rid, "Invalid wallet request. No such wallet method available.");
                return;
            }
            let error, result = func(...args);
            if (result instanceof Promise) {
                result = yield result
                    .catch((err) => {
                    error = err;
                });
            }
            //@ts-ignore
            let errorMsg = (error === null || error === void 0 ? void 0 : error.message) || error;
            if (fn != "mnemonic") {
                logger_1.workerLog.info(`Sending Wallet Response: \n` +
                    `  FN: ${fn} \n` +
                    `  error: ${errorMsg} \n` +
                    `  result: ${JSON.stringify(result)} \n`);
            }
            this.sendWalletResponse(rid, error, result, fn);
        }));
    }
    estimateTransaction(txParamsArg) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.wallet)
                return null;
            let data = yield this.wallet.estimateTransaction(txParamsArg);
            delete data.tx;
            delete data.rawTx;
            delete data.utxos;
            return data;
        });
    }
    sendWalletResponse(rid, error = undefined, result = undefined, fn = undefined) {
        this.postMessage("wallet-response", { rid, fn, error, result });
    }
}
exports.WorkerCore = WorkerCore;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWNvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvd29ya2VyLWNvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEscUNBQW1DO0FBSzNCLDBGQUxBLGtCQUFTLE9BS0E7QUFKakIsNENBQTJFO0FBRTNFLCtCQUF3QztBQUN4QyxtREFBNkM7QUFHN0MsTUFBTSxNQUFPLFNBQVEsZUFBVTtJQUM5QixJQUFJLENBQUMsSUFBVyxFQUFFLE9BQVMsRUFBRTtRQUM1QixLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN2QixZQUFZO1FBQ1osV0FBVyxDQUFDLEVBQUMsRUFBRSxFQUFDLGVBQWUsRUFBRSxJQUFJLEVBQUMsRUFBQyxJQUFJLEVBQUUsSUFBSSxFQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQ3RELENBQUM7Q0FDRDtBQUVELE1BQWEsVUFBVyxTQUFRLDRCQUFZO0lBSTNDO1FBQ0Msa0JBQVMsQ0FBQyxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQTtRQUMxQyxLQUFLLEVBQUUsQ0FBQztRQUNSLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxTQUFHLENBQUM7WUFDbEIsTUFBTSxFQUFFLElBQUksWUFBTSxDQUFDLElBQUksQ0FBQztTQUN4QixDQUFDLENBQUE7UUFDRixrQkFBUyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFBO0lBQzNDLENBQUM7SUFDSyxJQUFJOzs7OztZQUNULGtCQUFTLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUE7WUFDbEMsT0FBTSxJQUFJLFlBQUc7WUFDYixrQkFBUyxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUFBO1lBQzlDLE1BQU0sSUFBQSw2QkFBb0IsR0FBRSxDQUFDO1lBQzdCLGtCQUFTLENBQUMsS0FBSyxDQUFDLDRCQUE0QixDQUFDLENBQUE7WUFDN0MsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLENBQUMsS0FBSyxFQUFDLEVBQUU7Z0JBQ3BDLElBQUksRUFBQyxJQUFJLEVBQUMsR0FBRyxFQUFDLEdBQUcsS0FBSyxDQUFDO2dCQUN2QixJQUFJLEVBQUMsRUFBRSxFQUFFLElBQUksRUFBQyxHQUFHLEdBQUcsQ0FBQztnQkFDckIsSUFBSSxFQUFFLElBQUksYUFBYSxFQUFDLENBQUM7b0JBQ3hCLGtCQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxLQUFLLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFBO2dCQUM1RCxDQUFDO2dCQUNELElBQUcsQ0FBQyxFQUFFO29CQUNMLE9BQU07Z0JBQ1AsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDckIsQ0FBQyxDQUFDLENBQUE7WUFFRixJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzFCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3pCLENBQUM7S0FBQTtJQUNELGdCQUFnQjtRQUNmLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxHQUFrQixFQUFDLEVBQUU7WUFDakQsa0JBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQzlCLENBQUMsQ0FBQyxDQUFBO1FBQ0YsSUFBSSxDQUFDLEVBQUUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxHQUFHLEVBQUMsRUFBRTtZQUM3QixZQUFZO1lBQ1osSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQixNQUFNLEVBQ0wsT0FBTyxFQUNQLFVBQVUsRUFDVixjQUFjLEVBQ2QsT0FBTyxFQUNQLEdBQUcsR0FBRyxDQUFDO1lBQ1IsY0FBYyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO1lBRTlCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDdkUsNENBQTRDO1FBQzdDLENBQUMsQ0FBQyxDQUFBO1FBRUYsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFPLEdBQXVDLEVBQUMsRUFBRTtZQUMxRSxJQUFJLEVBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUMsR0FBRyxHQUFHLENBQUM7WUFDMUIsSUFBSSxFQUFDLE1BQU0sRUFBQyxHQUFHLElBQUksQ0FBQztZQUNwQixJQUFHLENBQUMsTUFBTTtnQkFDVCxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsdUNBQXVDLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDbkYsSUFBRyxDQUFDLEVBQUU7Z0JBQ0wsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLHlCQUF5QixDQUFDLENBQUM7WUFFaEUsSUFBSSxJQUFJLENBQUM7WUFDVCxZQUFZO1lBQ1osSUFBRyxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxVQUFVLEVBQUMsQ0FBQztnQkFDakMsWUFBWTtnQkFDWixJQUFJLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDNUIsWUFBWTtZQUNaLENBQUM7aUJBQUssSUFBRyxPQUFPLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxVQUFVLEVBQUMsQ0FBQztnQkFDekMsWUFBWTtnQkFDWixJQUFJLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDaEMsWUFBWTtZQUNaLENBQUM7aUJBQUssSUFBRyxPQUFPLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxTQUFTLEVBQUMsQ0FBQztnQkFDeEMsSUFBSSxHQUFHLEdBQVEsRUFBRTtvQkFDaEIsWUFBWTtvQkFDWixPQUFPLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDbkIsQ0FBQyxDQUFBLENBQUE7WUFDRixDQUFDO1lBRUQsa0JBQVMsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFBO1lBRW5ELElBQUcsQ0FBQyxJQUFJLEVBQUMsQ0FBQztnQkFDVCxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUMxQiwwREFBMEQsQ0FDMUQsQ0FBQztnQkFDRixPQUFNO1lBQ1AsQ0FBQztZQUVELElBQUksS0FBSyxFQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztZQUVsQyxJQUFHLE1BQU0sWUFBWSxPQUFPLEVBQUMsQ0FBQztnQkFDN0IsTUFBTSxHQUFHLE1BQU0sTUFBTTtxQkFDcEIsS0FBSyxDQUFDLENBQUMsR0FBTyxFQUFDLEVBQUU7b0JBQ2pCLEtBQUssR0FBRyxHQUFHLENBQUM7Z0JBQ2IsQ0FBQyxDQUFDLENBQUE7WUFDSCxDQUFDO1lBRUQsWUFBWTtZQUNaLElBQUksUUFBUSxHQUFHLENBQUEsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLE9BQU8sS0FBRSxLQUFLLENBQUM7WUFDckMsSUFBSSxFQUFFLElBQUksVUFBVSxFQUFDLENBQUM7Z0JBQ3JCLGtCQUFTLENBQUMsSUFBSSxDQUNiLDZCQUE2QjtvQkFDN0IsU0FBUyxFQUFFLEtBQUs7b0JBQ2hCLFlBQVksUUFBUSxLQUFLO29CQUN6QixhQUFhLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FDeEMsQ0FBQTtZQUNGLENBQUM7WUFDRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDakQsQ0FBQyxDQUFBLENBQUMsQ0FBQTtJQUNILENBQUM7SUFFSyxtQkFBbUIsQ0FBQyxXQUFtQjs7WUFDNUMsSUFBRyxDQUFDLElBQUksQ0FBQyxNQUFNO2dCQUNkLE9BQU8sSUFBSSxDQUFDO1lBQ2IsSUFBSSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFBO1lBQzdELE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNmLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztZQUNsQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDbEIsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO0tBQUE7SUFFRCxrQkFBa0IsQ0FBQyxHQUFVLEVBQUUsUUFBVSxTQUFTLEVBQUUsU0FBVyxTQUFTLEVBQUUsS0FBb0IsU0FBUztRQUN0RyxJQUFJLENBQUMsV0FBVyxDQUFDLGlCQUFpQixFQUFFLEVBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQztJQUMvRCxDQUFDO0NBQ0Q7QUF6SEQsZ0NBeUhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHt3b3JrZXJMb2d9IGZyb20gJy4vbG9nZ2VyJztcbmltcG9ydCB7V2FsbGV0IGFzIFdhbGxldEltcGwsIGluaXRLYXJsc2VuRnJhbWV3b3JrfSBmcm9tICdAa2FybHNlbi93YWxsZXQnO1xuaW1wb3J0IHtUeFNlbmQsIFR4SW5mb30gZnJvbSAnQGthcmxzZW4vd2FsbGV0L3R5cGVzL2N1c3RvbS10eXBlcyc7XG5pbXBvcnQge1JQQywgQ2xpZW50LCBJUlBDfSBmcm9tICcuL3JwYyc7XG5pbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnLi9ldmVudC1lbWl0dGVyJztcbmV4cG9ydCB7d29ya2VyTG9nfVxuXG5jbGFzcyBXYWxsZXQgZXh0ZW5kcyBXYWxsZXRJbXBse1xuXHRlbWl0KG5hbWU6c3RyaW5nLCBkYXRhOmFueT17fSl7XG5cdFx0c3VwZXIuZW1pdChuYW1lLCBkYXRhKTtcblx0XHQvL0B0cy1pZ25vcmVcblx0XHRwb3N0TWVzc2FnZSh7b3A6XCJ3YWxsZXQtZXZlbnRzXCIsIGRhdGE6e25hbWUsIGRhdGF9fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtlckNvcmUgZXh0ZW5kcyBFdmVudEVtaXR0ZXJ7XG5cdHJwYzpJUlBDO1xuXHR3YWxsZXQ6V2FsbGV0fHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcigpe1xuXHRcdHdvcmtlckxvZy5kZWJ1ZyhcIldvcmtlckNvcmU6Y29uc3RydWN0b3IxXCIpXG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJwYyA9IG5ldyBSUEMoe1xuXHRcdFx0Y2xpZW50OiBuZXcgQ2xpZW50KHRoaXMpXG5cdFx0fSlcblx0XHR3b3JrZXJMb2cuZGVidWcoXCJXb3JrZXJDb3JlOmNvbnN0cnVjdG9yMlwiKVxuXHR9XG5cdGFzeW5jIGluaXQoKXtcblx0XHR3b3JrZXJMb2cuZGVidWcoXCJXb3JrZXJDb3JlOmluaXRcIilcblx0XHRzdXBlci5pbml0KCk7XG5cdFx0d29ya2VyTG9nLmRlYnVnKFwiYmVmb3JlIGluaXRLYXJsc2VuRnJhbWV3b3JrXCIpXG5cdFx0YXdhaXQgaW5pdEthcmxzZW5GcmFtZXdvcmsoKTtcblx0XHR3b3JrZXJMb2cuZGVidWcoXCJhZnRlciBpbml0S2FybHNlbkZyYW1ld29ya1wiKVxuXHRcdGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChldmVudCk9Pntcblx0XHRcdGxldCB7ZGF0YTptc2d9ID0gZXZlbnQ7XG5cdFx0XHRsZXQge29wLCBkYXRhfSA9IG1zZztcblx0XHRcdGlmIChvcCAhPSBcIndhbGxldC1pbml0XCIpe1xuXHRcdFx0XHR3b3JrZXJMb2cuaW5mbyhgd29ya2VyIG9wOiAke29wfSwgJHtKU09OLnN0cmluZ2lmeShkYXRhKX1gKVxuXHRcdFx0fVxuXHRcdFx0aWYoIW9wKVxuXHRcdFx0XHRyZXR1cm5cblx0XHRcdHRoaXMuZW1pdChvcCwgZGF0YSk7XG5cdFx0fSlcblxuXHRcdHRoaXMucG9zdE1lc3NhZ2UoXCJyZWFkeVwiKTtcblx0XHR0aGlzLmluaXRXYWxsZXRIYW5sZXIoKTtcblx0fVxuXHRpbml0V2FsbGV0SGFubGVyKCl7XG5cdFx0dGhpcy5vbignd29ya2VyLWxvZy1sZXZlbCcsIChtc2c6e2xldmVsOnN0cmluZ30pPT57XG5cdFx0XHR3b3JrZXJMb2cuc2V0TGV2ZWwobXNnLmxldmVsKVxuXHRcdH0pXG5cdFx0dGhpcy5vbignd2FsbGV0LWluaXQnLCAobXNnKT0+e1xuXHRcdFx0Ly9AdHMtaWdub3JlXG5cdFx0XHR0aGlzLnJwYy5jbGVhbnVwKCk7XG5cdFx0XHRjb25zdCB7XG5cdFx0XHRcdHByaXZLZXksXG5cdFx0XHRcdHNlZWRQaHJhc2UsXG5cdFx0XHRcdG5ldHdvcmtPcHRpb25zLFxuXHRcdFx0XHRvcHRpb25zXG5cdFx0XHR9ID0gbXNnO1xuXHRcdFx0bmV0d29ya09wdGlvbnMucnBjID0gdGhpcy5ycGM7XG5cblx0XHRcdHRoaXMud2FsbGV0ID0gbmV3IFdhbGxldChwcml2S2V5LCBzZWVkUGhyYXNlLCBuZXR3b3JrT3B0aW9ucywgb3B0aW9ucyk7XG5cdFx0XHQvL3dvcmtlckxvZy5pbmZvKFwiY29yZS53YWxsZXRcIiwgdGhpcy53YWxsZXQpXG5cdFx0fSlcblxuXHRcdHRoaXMub24oXCJ3YWxsZXQtcmVxdWVzdFwiLCBhc3luYyAobXNnOntmbjpzdHJpbmcsIHJpZDpzdHJpbmcsIGFyZ3M6YW55W119KT0+e1xuXHRcdFx0bGV0IHtmbiwgcmlkLCBhcmdzfSA9IG1zZztcblx0XHRcdGxldCB7d2FsbGV0fSA9IHRoaXM7XG5cdFx0XHRpZighd2FsbGV0KVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZW5kV2FsbGV0UmVzcG9uc2UocmlkLCBgV2FsbGV0IG5vdCBpbml0aWxpemVkIHlldC4gKHN1YmplY3Q6JHtmbn0pYCk7XG5cdFx0XHRpZighZm4pXG5cdFx0XHRcdHJldHVybiB0aGlzLnNlbmRXYWxsZXRSZXNwb25zZShyaWQsIFwiSW52YWxpZCB3YWxsZXQgcmVxdWVzdC5cIik7XG5cblx0XHRcdGxldCBmdW5jO1xuXHRcdFx0Ly9AdHMtaWdub3JlXG5cdFx0XHRpZih0eXBlb2YgdGhpc1tmbl0gPT0gJ2Z1bmN0aW9uJyl7XG5cdFx0XHRcdC8vQHRzLWlnbm9yZVxuXHRcdFx0XHRmdW5jID0gdGhpc1tmbl0uYmluZCh0aGlzKTtcblx0XHRcdC8vQHRzLWlnbm9yZVxuXHRcdFx0fWVsc2UgaWYodHlwZW9mIHdhbGxldFtmbl0gPT0gJ2Z1bmN0aW9uJyl7XG5cdFx0XHRcdC8vQHRzLWlnbm9yZVxuXHRcdFx0XHRmdW5jID0gd2FsbGV0W2ZuXS5iaW5kKHdhbGxldCk7XG5cdFx0XHQvL0B0cy1pZ25vcmVcblx0XHRcdH1lbHNlIGlmKHR5cGVvZiB3YWxsZXRbZm5dICE9IHVuZGVmaW5lZCl7XG5cdFx0XHRcdGZ1bmMgPSBhc3luYyAoKT0+e1xuXHRcdFx0XHRcdC8vQHRzLWlnbm9yZVxuXHRcdFx0XHRcdHJldHVybiB3YWxsZXRbZm5dO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHdvcmtlckxvZy5kZWJ1Zyhgd2FsbGV0LXJlcXVlc3Q6ICR7Zm59ID0+ICR7ZnVuY31gKVxuXG5cdFx0XHRpZighZnVuYyl7XG5cdFx0XHRcdHRoaXMuc2VuZFdhbGxldFJlc3BvbnNlKHJpZCwgXG5cdFx0XHRcdFx0XCJJbnZhbGlkIHdhbGxldCByZXF1ZXN0LiBObyBzdWNoIHdhbGxldCBtZXRob2QgYXZhaWxhYmxlLlwiXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHJldHVyblxuXHRcdFx0fVxuXG5cdFx0XHRsZXQgZXJyb3IsIHJlc3VsdCA9IGZ1bmMoLi4uYXJncyk7XG5cblx0XHRcdGlmKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2Upe1xuXHRcdFx0XHRyZXN1bHQgPSBhd2FpdCByZXN1bHRcblx0XHRcdFx0LmNhdGNoKChlcnI6YW55KT0+e1xuXHRcdFx0XHRcdGVycm9yID0gZXJyO1xuXHRcdFx0XHR9KVxuXHRcdFx0fVxuXG5cdFx0XHQvL0B0cy1pZ25vcmVcblx0XHRcdGxldCBlcnJvck1zZyA9IGVycm9yPy5tZXNzYWdlfHxlcnJvcjtcblx0XHRcdGlmIChmbiAhPSBcIm1uZW1vbmljXCIpe1xuXHRcdFx0XHR3b3JrZXJMb2cuaW5mbyhcblx0XHRcdFx0XHRgU2VuZGluZyBXYWxsZXQgUmVzcG9uc2U6IFxcbmArXG5cdFx0XHRcdFx0YCAgRk46ICR7Zm59IFxcbmArXG5cdFx0XHRcdFx0YCAgZXJyb3I6ICR7ZXJyb3JNc2d9IFxcbmArXG5cdFx0XHRcdFx0YCAgcmVzdWx0OiAke0pTT04uc3RyaW5naWZ5KHJlc3VsdCl9IFxcbmBcblx0XHRcdFx0KVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5zZW5kV2FsbGV0UmVzcG9uc2UocmlkLCBlcnJvciwgcmVzdWx0LCBmbik7XG5cdFx0fSlcblx0fVxuXG5cdGFzeW5jIGVzdGltYXRlVHJhbnNhY3Rpb24odHhQYXJhbXNBcmc6IFR4U2VuZCk6IFByb21pc2UgPCBUeEluZm98bnVsbCA+IHtcblx0XHRpZighdGhpcy53YWxsZXQpXG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRsZXQgZGF0YSA9IGF3YWl0IHRoaXMud2FsbGV0LmVzdGltYXRlVHJhbnNhY3Rpb24odHhQYXJhbXNBcmcpXG5cdFx0ZGVsZXRlIGRhdGEudHg7XG5cdFx0ZGVsZXRlIGRhdGEucmF3VHg7XG5cdFx0ZGVsZXRlIGRhdGEudXR4b3M7XG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cblxuXHRzZW5kV2FsbGV0UmVzcG9uc2UocmlkOnN0cmluZywgZXJyb3I6YW55PXVuZGVmaW5lZCwgcmVzdWx0OmFueT11bmRlZmluZWQsIGZuOnN0cmluZ3x1bmRlZmluZWQ9dW5kZWZpbmVkKXtcblx0XHR0aGlzLnBvc3RNZXNzYWdlKFwid2FsbGV0LXJlc3BvbnNlXCIsIHtyaWQsIGZuLCBlcnJvciwgcmVzdWx0fSk7XG5cdH1cbn1cbiJdfQ==
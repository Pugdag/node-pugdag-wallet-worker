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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressManager = void 0;
// @ts-ignore
const pugdagcore = __importStar(require("../../../core-lib"));
// @ts-ignore
const secp256k1 = pugdagcore.secp256k1; //require('secp256k1-wasm');
const event_target_impl_1 = require("./event-target-impl");
const helper_1 = require("../utils/helper");
class AddressManager extends event_target_impl_1.EventTargetImpl {
    constructor(HDWallet, network) {
        super();
        /**
         * Derives a new receive address. Sets related instance properties.
         */
        this.receiveAddress = {
            counter: 0,
            // @ts-ignore
            current: {},
            keypairs: {},
            atIndex: {},
            next: () => {
                const { address, privateKey } = this.deriveAddress('receive', this.receiveAddress.counter);
                this.receiveAddress.current = {
                    address,
                    privateKey
                };
                this.receiveAddress.keypairs[address] = privateKey;
                this.receiveAddress.atIndex[this.receiveAddress.counter] = address;
                this.receiveAddress.counter += 1;
                return address;
            },
            advance(n) {
                if (n > -1)
                    this.counter = n;
                this.next();
            },
        };
        /**
         * Derives a new change address. Sets related instance properties.
         */
        this.changeAddress = {
            counter: 0,
            // @ts-ignore
            current: {},
            keypairs: {},
            atIndex: {},
            next: () => {
                const { address, privateKey } = this.deriveAddress('change', this.changeAddress.counter);
                this.changeAddress.keypairs[address] = privateKey;
                this.changeAddress.current = {
                    address,
                    privateKey
                };
                this.changeAddress.atIndex[this.changeAddress.counter] = address;
                this.changeAddress.counter += 1;
                return address;
            },
            advance(n) {
                if (n > -1)
                    this.counter = n;
                // no call to next() here; composeTx calls it on demand.
            },
            reverse() {
                if (this.counter > 0)
                    this.counter -= 1;
            },
        };
        this.HDWallet = HDWallet;
        this.network = network;
    }
    get all() {
        return Object.assign(Object.assign({}, this.receiveAddress.keypairs), this.changeAddress.keypairs);
    }
    get shouldFetch() {
        const receive = Object.entries(this.receiveAddress.atIndex)
            .filter((record) => parseInt(record[0], 10) <= this.receiveAddress.counter - 1)
            .map((record) => record[1]);
        const change = Object.entries(this.changeAddress.atIndex)
            .filter((record) => parseInt(record[0], 10) <= this.changeAddress.counter)
            .map((record) => record[1]);
        return [...receive, ...change];
    }
    deriveAddress(deriveType, index) {
        //let ts0 = Date.now();
        const dType = deriveType === 'receive' ? 0 : 1;
        const { privateKey } = this.HDWallet.deriveChild(`m/44'/972/0'/${dType}'/${index}'`);
        //let ts1 = Date.now();
        //let publicKeys = secp256k1.export_public_keys(privateKey.toString());
        const xonlyPubKey = secp256k1.export_public_key_xonly(privateKey.toString());
        //let ts2 = Date.now();
        //console.log('durations:',(ts2-ts1)/1000,(ts1-ts0)/1000);
        //let address1 = new pugdagcore.PublicKey(publicKeys.pubkey, {network:this.network}).toAddress().toString();
        //let address = privateKey.toAddress(this.network).toString();
        //let pubkey = Buffer.from(publicKeys.pubkey, "hex");
        //let {address:address3} = bitcoin.payments.p2pkh({pubkey});
        let xonly = Buffer.from(xonlyPubKey, "hex");
        //@ts-ignore
        let address = pugdagcore.Address.fromPublicKeyBuffer(xonly, this.network).toString();
        /*
        console.log("privateKey:xxxx:", {
          privateKey: privateKey.toString(),
          address,
          address1,
          address2,
          "address1==address":address1==address,
          publicKeys
         });//, publicKeys)
         */
        //console.log("xonly:address2", "privateKey:"+privateKey.toString(), "address:"+address2)
        //console.log("xonly", publicKeys.xonly)
        (0, helper_1.dpc)(() => {
            this.emit("new-address", {
                type: deriveType,
                address,
                index
            });
        });
        return {
            address,
            privateKey
        };
    }
    /**
     * Derives n addresses and adds their keypairs to their deriveType-respective address object
     * @param n How many addresses to derive
     * @param deriveType receive or change address
     * @param offset Index to start at in derive path
     */
    getAddresses(n, deriveType, offset = 0) {
        return [...Array(n).keys()].map((i) => {
            const index = i + offset;
            const { address, privateKey } = this.deriveAddress(deriveType, index);
            if (deriveType === 'receive') {
                this.receiveAddress.atIndex[index] = address;
                this.receiveAddress.keypairs[address] = privateKey;
            }
            else {
                this.changeAddress.atIndex[index] = address;
                this.changeAddress.keypairs[address] = privateKey;
            }
            return {
                index,
                address,
                privateKey,
            };
        });
    }
    isOur(address) {
        return !!(this.changeAddress.keypairs[address] || this.receiveAddress.keypairs[address]);
    }
    isOurChange(address) {
        return !!this.changeAddress.keypairs[address];
    }
}
exports.AddressManager = AddressManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkcmVzcy1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L2FkZHJlc3MtbWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGFBQWE7QUFDYiwrREFBaUQ7QUFHakQsYUFBYTtBQUNiLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQSw0QkFBNEI7QUFDcEUsMkRBQW9EO0FBQ3BELDRDQUFvQztBQUVwQyxNQUFhLGNBQWUsU0FBUSxtQ0FBZTtJQUNsRCxZQUFZLFFBQWtDLEVBQUUsT0FBZ0I7UUFDL0QsS0FBSyxFQUFFLENBQUM7UUE0QlQ7O1dBRUc7UUFDSCxtQkFBYyxHQVVWO1lBQ0gsT0FBTyxFQUFFLENBQUM7WUFDVixhQUFhO1lBQ2IsT0FBTyxFQUFFLEVBQUU7WUFDWCxRQUFRLEVBQUUsRUFBRTtZQUNaLE9BQU8sRUFBRSxFQUFFO1lBQ1gsSUFBSSxFQUFFLEdBQVcsRUFBRTtnQkFDbEIsTUFBTSxFQUNMLE9BQU8sRUFDUCxVQUFVLEVBQ1YsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUUvRCxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sR0FBRztvQkFDN0IsT0FBTztvQkFDUCxVQUFVO2lCQUNWLENBQUM7Z0JBQ0YsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsVUFBVSxDQUFDO2dCQUNuRCxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQztnQkFDbkUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxPQUFPLE9BQU8sQ0FBQztZQUNoQixDQUFDO1lBQ0QsT0FBTyxDQUFDLENB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QUM7WUFDekIsTUFBTSxFQUNMLE9BQU8sRUFDUCxVQUFVLEVBQ1YsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUUxQyxJQUFJLFVBQVUsS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDOUIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDO2dCQUM3QyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxVQUFVLENBQUM7WUFDcEQsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQztnQkFDNUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsVUFBVSxDQUFDO1lBQ25ELENBQUM7WUFDRCxPQUFPO2dCQUNOLEtBQUs7Z0JBQ0wsT0FBTztnQkFDUCxVQUFVO2FBQ1YsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFjO1FBQ25CLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMxRixDQUFDO0lBRUQsV0FBVyxDQUFDLE9BQWM7UUFDekIsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0MsQ0FBQztDQUVEO0FBN01ELHdDQTZNQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEB0cy1pZ25vcmVcbmltcG9ydCAqIGFzIGthcmxzZW5jb3JlIGZyb20gJ0BrYXJsc2VuL2NvcmUtbGliJztcbmltcG9ydCB7TmV0d29ya30gZnJvbSAnY3VzdG9tLXR5cGVzJztcblxuLy8gQHRzLWlnbm9yZVxuY29uc3Qgc2VjcDI1NmsxID0ga2FybHNlbmNvcmUuc2VjcDI1NmsxOy8vcmVxdWlyZSgnc2VjcDI1NmsxLXdhc20nKTtcbmltcG9ydCB7RXZlbnRUYXJnZXRJbXBsfSBmcm9tICcuL2V2ZW50LXRhcmdldC1pbXBsJztcbmltcG9ydCB7ZHBjfSBmcm9tICcuLi91dGlscy9oZWxwZXInO1xuXG5leHBvcnQgY2xhc3MgQWRkcmVzc01hbmFnZXIgZXh0ZW5kcyBFdmVudFRhcmdldEltcGwge1xuXHRjb25zdHJ1Y3RvcihIRFdhbGxldDoga2FybHNlbmNvcmUuSERQcml2YXRlS2V5LCBuZXR3b3JrOiBOZXR3b3JrKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLkhEV2FsbGV0ID0gSERXYWxsZXQ7XG5cdFx0dGhpcy5uZXR3b3JrID0gbmV0d29yaztcblx0fVxuXG5cdHByaXZhdGUgSERXYWxsZXQ6IGthcmxzZW5jb3JlLkhEUHJpdmF0ZUtleTtcblxuXHRuZXR3b3JrOiBOZXR3b3JrO1xuXG5cdGdldCBhbGwoKTogUmVjb3JkIDwgc3RyaW5nLCBrYXJsc2VuY29yZS5Qcml2YXRlS2V5ID4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi50aGlzLnJlY2VpdmVBZGRyZXNzLmtleXBhaXJzLFxuXHRcdFx0Li4udGhpcy5jaGFuZ2VBZGRyZXNzLmtleXBhaXJzXG5cdFx0fTtcblx0fVxuXG5cdGdldCBzaG91bGRGZXRjaCgpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgcmVjZWl2ZSA9IE9iamVjdC5lbnRyaWVzKHRoaXMucmVjZWl2ZUFkZHJlc3MuYXRJbmRleClcblx0XHRcdC5maWx0ZXIoXG5cdFx0XHRcdChyZWNvcmQ6IFtzdHJpbmcsIHN0cmluZ10pID0+IHBhcnNlSW50KHJlY29yZFswXSwgMTApIDw9IHRoaXMucmVjZWl2ZUFkZHJlc3MuY291bnRlciAtIDFcblx0XHRcdClcblx0XHRcdC5tYXAoKHJlY29yZDogW3N0cmluZywgc3RyaW5nXSkgPT4gcmVjb3JkWzFdKTtcblx0XHRjb25zdCBjaGFuZ2UgPSBPYmplY3QuZW50cmllcyh0aGlzLmNoYW5nZUFkZHJlc3MuYXRJbmRleClcblx0XHRcdC5maWx0ZXIoKHJlY29yZDogW3N0cmluZywgc3RyaW5nXSkgPT4gcGFyc2VJbnQocmVjb3JkWzBdLCAxMCkgPD0gdGhpcy5jaGFuZ2VBZGRyZXNzLmNvdW50ZXIpXG5cdFx0XHQubWFwKChyZWNvcmQ6IFtzdHJpbmcsIHN0cmluZ10pID0+IHJlY29yZFsxXSk7XG5cdFx0cmV0dXJuIFsuLi5yZWNlaXZlLCAuLi5jaGFuZ2VdO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlcml2ZXMgYSBuZXcgcmVjZWl2ZSBhZGRyZXNzLiBTZXRzIHJlbGF0ZWQgaW5zdGFuY2UgcHJvcGVydGllcy5cblx0ICovXG5cdHJlY2VpdmVBZGRyZXNzOiB7XG5cdFx0Y291bnRlcjogbnVtYmVyO1xuXHRcdGN1cnJlbnQ6IHtcblx0XHRcdGFkZHJlc3M6IHN0cmluZztcblx0XHRcdHByaXZhdGVLZXk6IGthcmxzZW5jb3JlLlByaXZhdGVLZXlcblx0XHR9O1xuXHRcdGtleXBhaXJzOiBSZWNvcmQgPCBzdHJpbmcsIGthcmxzZW5jb3JlLlByaXZhdGVLZXkgPiA7XG5cdFx0YXRJbmRleDogUmVjb3JkIDwgc3RyaW5nLCBzdHJpbmcgPiA7XG5cdFx0bmV4dDogKCkgPT4gc3RyaW5nO1xuXHRcdGFkdmFuY2U6IChuOiBudW1iZXIpID0+IHZvaWQ7XG5cdH0gPSB7XG5cdFx0Y291bnRlcjogMCxcblx0XHQvLyBAdHMtaWdub3JlXG5cdFx0Y3VycmVudDoge30sXG5cdFx0a2V5cGFpcnM6IHt9LFxuXHRcdGF0SW5kZXg6IHt9LFxuXHRcdG5leHQ6ICgpOiBzdHJpbmcgPT4ge1xuXHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRhZGRyZXNzLFxuXHRcdFx0XHRwcml2YXRlS2V5XG5cdFx0XHR9ID0gdGhpcy5kZXJpdmVBZGRyZXNzKCdyZWNlaXZlJywgdGhpcy5yZWNlaXZlQWRkcmVzcy5jb3VudGVyKTtcblxuXHRcdFx0dGhpcy5yZWNlaXZlQWRkcmVzcy5jdXJyZW50ID0ge1xuXHRcdFx0XHRhZGRyZXNzLFxuXHRcdFx0XHRwcml2YXRlS2V5XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5yZWNlaXZlQWRkcmVzcy5rZXlwYWlyc1thZGRyZXNzXSA9IHByaXZhdGVLZXk7XG5cdFx0XHR0aGlzLnJlY2VpdmVBZGRyZXNzLmF0SW5kZXhbdGhpcy5yZWNlaXZlQWRkcmVzcy5jb3VudGVyXSA9IGFkZHJlc3M7XG5cdFx0XHR0aGlzLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXIgKz0gMTtcblx0XHRcdHJldHVybiBhZGRyZXNzO1xuXHRcdH0sXG5cdFx0YWR2YW5jZShuOiBudW1iZXIpOiB2b2lkIHtcblx0XHRcdGlmIChuID4gLTEpXG5cdFx0XHRcdHRoaXMuY291bnRlciA9IG47XG5cdFx0XHR0aGlzLm5leHQoKTtcblx0XHR9LFxuXHR9O1xuXG5cdC8qKlxuXHQgKiBEZXJpdmVzIGEgbmV3IGNoYW5nZSBhZGRyZXNzLiBTZXRzIHJlbGF0ZWQgaW5zdGFuY2UgcHJvcGVydGllcy5cblx0ICovXG5cdGNoYW5nZUFkZHJlc3M6IHtcblx0XHRjb3VudGVyOiBudW1iZXI7XG5cdFx0Y3VycmVudDoge1xuXHRcdFx0YWRkcmVzczogc3RyaW5nO1xuXHRcdFx0cHJpdmF0ZUtleToga2FybHNlbmNvcmUuUHJpdmF0ZUtleVxuXHRcdH07XG5cdFx0a2V5cGFpcnM6IFJlY29yZCA8IHN0cmluZywga2FybHNlbmNvcmUuUHJpdmF0ZUtleSA+IDtcblx0XHRhdEluZGV4OiBSZWNvcmQgPCBzdHJpbmcsIHN0cmluZyA+IDtcblx0XHRuZXh0OiAoKSA9PiBzdHJpbmc7XG5cdFx0YWR2YW5jZTogKG46IG51bWJlcikgPT4gdm9pZDtcblx0XHRyZXZlcnNlOiAoKSA9PiB2b2lkO1xuXHR9ID0ge1xuXHRcdGNvdW50ZXI6IDAsXG5cdFx0Ly8gQHRzLWlnbm9yZVxuXHRcdGN1cnJlbnQ6IHt9LFxuXHRcdGtleXBhaXJzOiB7fSxcblx0XHRhdEluZGV4OiB7fSxcblx0XHRuZXh0OiAoKTogc3RyaW5nID0+IHtcblx0XHRcdGNvbnN0IHtcblx0XHRcdFx0YWRkcmVzcyxcblx0XHRcdFx0cHJpdmF0ZUtleVxuXHRcdFx0fSA9IHRoaXMuZGVyaXZlQWRkcmVzcygnY2hhbmdlJywgdGhpcy5jaGFuZ2VBZGRyZXNzLmNvdW50ZXIpO1xuXG5cdFx0XHR0aGlzLmNoYW5nZUFkZHJlc3Mua2V5cGFpcnNbYWRkcmVzc10gPSBwcml2YXRlS2V5O1xuXHRcdFx0dGhpcy5jaGFuZ2VBZGRyZXNzLmN1cnJlbnQgPSB7XG5cdFx0XHRcdGFkZHJlc3MsXG5cdFx0XHRcdHByaXZhdGVLZXlcblx0XHRcdH07XG5cdFx0XHR0aGlzLmNoYW5nZUFkZHJlc3MuYXRJbmRleFt0aGlzLmNoYW5nZUFkZHJlc3MuY291bnRlcl0gPSBhZGRyZXNzO1xuXHRcdFx0dGhpcy5jaGFuZ2VBZGRyZXNzLmNvdW50ZXIgKz0gMTtcblx0XHRcdHJldHVybiBhZGRyZXNzO1xuXHRcdH0sXG5cdFx0YWR2YW5jZShuOiBudW1iZXIpOiB2b2lkIHtcblx0XHRcdGlmIChuID4gLTEpXG5cdFx0XHRcdHRoaXMuY291bnRlciA9IG47XG5cdFx0XHQvLyBubyBjYWxsIHRvIG5leHQoKSBoZXJlOyBjb21wb3NlVHggY2FsbHMgaXQgb24gZGVtYW5kLlxuXHRcdH0sXG5cdFx0cmV2ZXJzZSgpOiB2b2lkIHtcblx0XHRcdGlmICh0aGlzLmNvdW50ZXIgPiAwKVxuXHRcdFx0XHR0aGlzLmNvdW50ZXIgLT0gMTtcblx0XHR9LFxuXHR9O1xuXG5cdHByaXZhdGUgZGVyaXZlQWRkcmVzcyhcblx0XHRkZXJpdmVUeXBlOiAncmVjZWl2ZScgfCAnY2hhbmdlJyxcblx0XHRpbmRleDogbnVtYmVyXG5cdCk6IHtcblx0XHRhZGRyZXNzOiBzdHJpbmc7XG5cdFx0cHJpdmF0ZUtleToga2FybHNlbmNvcmUuUHJpdmF0ZUtleVxuXHR9IHtcblx0XHQvL2xldCB0czAgPSBEYXRlLm5vdygpO1xuXHRcdGNvbnN0IGRUeXBlID0gZGVyaXZlVHlwZSA9PT0gJ3JlY2VpdmUnID8gMCA6IDE7XG5cdFx0Y29uc3Qge3ByaXZhdGVLZXl9ID0gdGhpcy5IRFdhbGxldC5kZXJpdmVDaGlsZChgbS80NCcvOTcyLzAnLyR7ZFR5cGV9Jy8ke2luZGV4fSdgKTtcblx0XHQvL2xldCB0czEgPSBEYXRlLm5vdygpO1xuXHRcdC8vbGV0IHB1YmxpY0tleXMgPSBzZWNwMjU2azEuZXhwb3J0X3B1YmxpY19rZXlzKHByaXZhdGVLZXkudG9TdHJpbmcoKSk7XG5cdFx0Y29uc3QgeG9ubHlQdWJLZXkgPSBzZWNwMjU2azEuZXhwb3J0X3B1YmxpY19rZXlfeG9ubHkocHJpdmF0ZUtleS50b1N0cmluZygpKTtcblx0XHQvL2xldCB0czIgPSBEYXRlLm5vdygpO1xuXG5cdFx0Ly9jb25zb2xlLmxvZygnZHVyYXRpb25zOicsKHRzMi10czEpLzEwMDAsKHRzMS10czApLzEwMDApO1xuXHRcdC8vbGV0IGFkZHJlc3MxID0gbmV3IGthcmxzZW5jb3JlLlB1YmxpY0tleShwdWJsaWNLZXlzLnB1YmtleSwge25ldHdvcms6dGhpcy5uZXR3b3JrfSkudG9BZGRyZXNzKCkudG9TdHJpbmcoKTtcblx0XHQvL2xldCBhZGRyZXNzID0gcHJpdmF0ZUtleS50b0FkZHJlc3ModGhpcy5uZXR3b3JrKS50b1N0cmluZygpO1xuXHRcdC8vbGV0IHB1YmtleSA9IEJ1ZmZlci5mcm9tKHB1YmxpY0tleXMucHVia2V5LCBcImhleFwiKTtcblx0XHQvL2xldCB7YWRkcmVzczphZGRyZXNzM30gPSBiaXRjb2luLnBheW1lbnRzLnAycGtoKHtwdWJrZXl9KTtcblx0XHRsZXQgeG9ubHkgPSBCdWZmZXIuZnJvbSh4b25seVB1YktleSwgXCJoZXhcIik7XG5cdFx0Ly9AdHMtaWdub3JlXG5cdFx0XG5cdFx0bGV0IGFkZHJlc3MgPSBrYXJsc2VuY29yZS5BZGRyZXNzLmZyb21QdWJsaWNLZXlCdWZmZXIoeG9ubHksIHRoaXMubmV0d29yaykudG9TdHJpbmcoKTtcblxuXHRcdC8qXG5cdFx0Y29uc29sZS5sb2coXCJwcml2YXRlS2V5Onh4eHg6XCIsIHtcblx0XHQgIHByaXZhdGVLZXk6IHByaXZhdGVLZXkudG9TdHJpbmcoKSxcblx0XHQgIGFkZHJlc3MsXG5cdFx0ICBhZGRyZXNzMSxcblx0XHQgIGFkZHJlc3MyLFxuXHRcdCAgXCJhZGRyZXNzMT09YWRkcmVzc1wiOmFkZHJlc3MxPT1hZGRyZXNzLFxuXHRcdCAgcHVibGljS2V5c1xuXHRcdCB9KTsvLywgcHVibGljS2V5cylcblx0XHQgKi9cblx0XHQvL2NvbnNvbGUubG9nKFwieG9ubHk6YWRkcmVzczJcIiwgXCJwcml2YXRlS2V5OlwiK3ByaXZhdGVLZXkudG9TdHJpbmcoKSwgXCJhZGRyZXNzOlwiK2FkZHJlc3MyKVxuXHRcdC8vY29uc29sZS5sb2coXCJ4b25seVwiLCBwdWJsaWNLZXlzLnhvbmx5KVxuXHRcdGRwYygoKSA9PiB7XG5cdFx0XHR0aGlzLmVtaXQoXCJuZXctYWRkcmVzc1wiLCB7XG5cdFx0XHRcdHR5cGU6IGRlcml2ZVR5cGUsXG5cdFx0XHRcdGFkZHJlc3MsXG5cdFx0XHRcdGluZGV4XG5cdFx0XHR9KTtcblx0XHR9KVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGFkZHJlc3MsXG5cdFx0XHRwcml2YXRlS2V5XG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXJpdmVzIG4gYWRkcmVzc2VzIGFuZCBhZGRzIHRoZWlyIGtleXBhaXJzIHRvIHRoZWlyIGRlcml2ZVR5cGUtcmVzcGVjdGl2ZSBhZGRyZXNzIG9iamVjdFxuXHQgKiBAcGFyYW0gbiBIb3cgbWFueSBhZGRyZXNzZXMgdG8gZGVyaXZlXG5cdCAqIEBwYXJhbSBkZXJpdmVUeXBlIHJlY2VpdmUgb3IgY2hhbmdlIGFkZHJlc3Ncblx0ICogQHBhcmFtIG9mZnNldCBJbmRleCB0byBzdGFydCBhdCBpbiBkZXJpdmUgcGF0aFxuXHQgKi9cblx0Z2V0QWRkcmVzc2VzKG46IG51bWJlciwgZGVyaXZlVHlwZTogJ3JlY2VpdmUnIHwgJ2NoYW5nZScsIG9mZnNldCA9IDApIHtcblx0XHRyZXR1cm4gWy4uLkFycmF5KG4pLmtleXMoKV0ubWFwKChpKSA9PiB7XG5cdFx0XHRjb25zdCBpbmRleCA9IGkgKyBvZmZzZXQ7XG5cdFx0XHRjb25zdCB7XG5cdFx0XHRcdGFkZHJlc3MsXG5cdFx0XHRcdHByaXZhdGVLZXlcblx0XHRcdH0gPSB0aGlzLmRlcml2ZUFkZHJlc3MoZGVyaXZlVHlwZSwgaW5kZXgpO1xuXG5cdFx0XHRpZiAoZGVyaXZlVHlwZSA9PT0gJ3JlY2VpdmUnKSB7XG5cdFx0XHRcdHRoaXMucmVjZWl2ZUFkZHJlc3MuYXRJbmRleFtpbmRleF0gPSBhZGRyZXNzO1xuXHRcdFx0XHR0aGlzLnJlY2VpdmVBZGRyZXNzLmtleXBhaXJzW2FkZHJlc3NdID0gcHJpdmF0ZUtleTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuY2hhbmdlQWRkcmVzcy5hdEluZGV4W2luZGV4XSA9IGFkZHJlc3M7XG5cdFx0XHRcdHRoaXMuY2hhbmdlQWRkcmVzcy5rZXlwYWlyc1thZGRyZXNzXSA9IHByaXZhdGVLZXk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpbmRleCxcblx0XHRcdFx0YWRkcmVzcyxcblx0XHRcdFx0cHJpdmF0ZUtleSxcblx0XHRcdH07XG5cdFx0fSk7XG5cdH1cblxuXHRpc091cihhZGRyZXNzOnN0cmluZyk6Ym9vbGVhbntcblx0XHRyZXR1cm4gISEodGhpcy5jaGFuZ2VBZGRyZXNzLmtleXBhaXJzW2FkZHJlc3NdIHx8IHRoaXMucmVjZWl2ZUFkZHJlc3Mua2V5cGFpcnNbYWRkcmVzc10pO1xuXHR9XG5cblx0aXNPdXJDaGFuZ2UoYWRkcmVzczpzdHJpbmcpOmJvb2xlYW57XG5cdFx0cmV0dXJuICEhdGhpcy5jaGFuZ2VBZGRyZXNzLmtleXBhaXJzW2FkZHJlc3NdO1xuXHR9XG5cbn1cbiJdfQ==
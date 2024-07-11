import { workerLog } from './logger';
import { Wallet as WalletImpl } from '@pugdag/wallet';
import { TxSend, TxInfo } from '@pugdag/wallet/types/custom-types';
import { IRPC } from './rpc';
import { EventEmitter } from './event-emitter';
export { workerLog };
declare class Wallet extends WalletImpl {
    emit(name: string, data?: any): void;
}
export declare class WorkerCore extends EventEmitter {
    rpc: IRPC;
    wallet: Wallet | undefined;
    constructor();
    init(): Promise<void>;
    initWalletHanler(): void;
    estimateTransaction(txParamsArg: TxSend): Promise<TxInfo | null>;
    sendWalletResponse(rid: string, error?: any, result?: any, fn?: string | undefined): void;
}
//# sourceMappingURL=worker-core.d.ts.map
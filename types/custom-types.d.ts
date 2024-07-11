export * from '@pugdag/wallet/types/rpc';

import {RPC} from '@pugdag/wallet/types/rpc';

export interface SubscriberItem{
  uid:string;
  callback:function;
}

export declare type SubscriberItemMap = Map<string, SubscriberItem[]>;

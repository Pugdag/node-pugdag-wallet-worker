import { Wallet } from './wallet';

export const initPugdagFramework = async () => {
  // console.log("Pugdag - framework: init");
  await Wallet.initRuntime();
  // console.log("Pugdag - framework: ready");
};


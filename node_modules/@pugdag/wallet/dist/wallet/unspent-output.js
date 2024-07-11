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
exports.UnspentOutput = void 0;
const pugdagcore = __importStar(require("../../../core-lib"));
class UnspentOutput extends pugdagcore.Transaction.UnspentOutput {
    constructor(o) {
        super(o);
        this.blockDaaScore = o.blockDaaScore;
        this.scriptPublicKeyVersion = o.scriptPublicKeyVersion;
        this.id = this.txId + this.outputIndex;
        this.signatureOPCount = this.script.getSignatureOperationsCount();
        this.mass = this.signatureOPCount * pugdagcore.Transaction.MassPerSigOp;
        this.mass += 151 * pugdagcore.Transaction.MassPerTxByte; //standalone mass 
        this.isCoinbase = o.isCoinbase,
            this.scriptPubKey = o.scriptPubKey;
    }
}
exports.UnspentOutput = UnspentOutput;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5zcGVudC1vdXRwdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi93YWxsZXQvdW5zcGVudC1vdXRwdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrREFBaUQ7QUFFakQsTUFBYSxhQUFjLFNBQVEsV0FBVyxDQUFDLFdBQVcsQ0FBQyxhQUFhO0lBUXZFLFlBQVksQ0FBb0I7UUFDL0IsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1QsSUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUMsYUFBYSxDQUFDO1FBQ3JDLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxDQUFDLENBQUMsc0JBQXNCLENBQUM7UUFDdkQsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7UUFDdkMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUNsRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQztRQUN6RSxJQUFJLENBQUMsSUFBSSxJQUFHLEdBQUcsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDLGtCQUFrQjtRQUMzRSxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVO1lBQzlCLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQTtJQUNuQyxDQUFDO0NBQ0Q7QUFuQkQsc0NBbUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMga2FybHNlbmNvcmUgZnJvbSAnQGthcmxzZW4vY29yZS1saWInO1xuaW1wb3J0IHtVbnNwZW50T3V0cHV0SW5mb30gZnJvbSAnLi4vdHlwZXMvY3VzdG9tLXR5cGVzJztcbmV4cG9ydCBjbGFzcyBVbnNwZW50T3V0cHV0IGV4dGVuZHMga2FybHNlbmNvcmUuVHJhbnNhY3Rpb24uVW5zcGVudE91dHB1dCB7XG5cdGJsb2NrRGFhU2NvcmU6IG51bWJlcjtcblx0c2NyaXB0UHVibGljS2V5VmVyc2lvbjogbnVtYmVyO1xuXHRpZDpzdHJpbmc7XG5cdHNpZ25hdHVyZU9QQ291bnQ6bnVtYmVyO1xuXHRtYXNzOm51bWJlcjtcblx0aXNDb2luYmFzZTpib29sZWFuO1xuXHRzY3JpcHRQdWJLZXk6c3RyaW5nO1xuXHRjb25zdHJ1Y3RvcihvOiBVbnNwZW50T3V0cHV0SW5mbykge1xuXHRcdHN1cGVyKG8pO1xuXHRcdHRoaXMuYmxvY2tEYWFTY29yZSA9IG8uYmxvY2tEYWFTY29yZTtcblx0XHR0aGlzLnNjcmlwdFB1YmxpY0tleVZlcnNpb24gPSBvLnNjcmlwdFB1YmxpY0tleVZlcnNpb247XG5cdFx0dGhpcy5pZCA9IHRoaXMudHhJZCArIHRoaXMub3V0cHV0SW5kZXg7XG5cdFx0dGhpcy5zaWduYXR1cmVPUENvdW50ID0gdGhpcy5zY3JpcHQuZ2V0U2lnbmF0dXJlT3BlcmF0aW9uc0NvdW50KCk7XG5cdFx0dGhpcy5tYXNzID0gdGhpcy5zaWduYXR1cmVPUENvdW50ICoga2FybHNlbmNvcmUuVHJhbnNhY3Rpb24uTWFzc1BlclNpZ09wO1xuXHRcdHRoaXMubWFzcys9IDE1MSAqIGthcmxzZW5jb3JlLlRyYW5zYWN0aW9uLk1hc3NQZXJUeEJ5dGU7IC8vc3RhbmRhbG9uZSBtYXNzIFxuXHRcdHRoaXMuaXNDb2luYmFzZSA9IG8uaXNDb2luYmFzZSxcblx0XHR0aGlzLnNjcmlwdFB1YktleSA9IG8uc2NyaXB0UHViS2V5XG5cdH1cbn1cbiJdfQ==
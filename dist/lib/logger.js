"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerLog = void 0;
const flow_logger_1 = require("@aspectron/flow-logger");
exports.workerLog = new flow_logger_1.FlowLogger('WalletWorker', {
    display: ['name', 'level', 'time'],
    color: ['name', 'level', 'time']
});
exports.workerLog.enable('all');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2xvZ2dlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx3REFBa0Q7QUFDckMsUUFBQSxTQUFTLEdBQUcsSUFBSSx3QkFBVSxDQUFDLGNBQWMsRUFBRTtJQUN2RCxPQUFPLEVBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQztJQUNuQyxLQUFLLEVBQUUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQztDQUNoQyxDQUFDLENBQUM7QUFFSCxpQkFBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7Rmxvd0xvZ2dlcn0gZnJvbSAnQGFzcGVjdHJvbi9mbG93LWxvZ2dlcic7XG5leHBvcnQgY29uc3Qgd29ya2VyTG9nID0gbmV3IEZsb3dMb2dnZXIoJ1dhbGxldFdvcmtlcicsIHtcblx0ZGlzcGxheSA6IFsnbmFtZScsICdsZXZlbCcsICd0aW1lJ10sXG5cdGNvbG9yOiBbJ25hbWUnLCAnbGV2ZWwnLCAndGltZSddXG59KTtcblxud29ya2VyTG9nLmVuYWJsZSgnYWxsJyk7XG4iXX0=
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateLogger = exports.FlowLogger = exports.log = void 0;
const flow_logger_1 = require("@aspectron/flow-logger");
Object.defineProperty(exports, "FlowLogger", { enumerable: true, get: function () { return flow_logger_1.FlowLogger; } });
let custom = ['utxo:cyan', 'utxodebug:cyan', 'tx:green', 'txdebug:green'];
const logger = new flow_logger_1.FlowLogger('Pugdag Wallet', {
    display: ['name', 'level', 'time'],
    custom,
    color: ['level']
});
logger.enable('all');
exports.log = logger;
const CreateLogger = (name = "PugdagWallet") => {
    let logger = new flow_logger_1.FlowLogger(name, {
        display: ['name', 'level', 'time'],
        custom,
        color: ['level']
    });
    return logger;
};
exports.CreateLogger = CreateLogger;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vdXRpbHMvbG9nZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHdEQUFrRDtBQWExQywyRkFiQSx3QkFBVSxPQWFBO0FBWGxCLElBQUksTUFBTSxHQUFHLENBQUMsV0FBVyxFQUFFLGdCQUFnQixFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUMsQ0FBQTtBQUN6RSxNQUFNLE1BQU0sR0FBRyxJQUFJLHdCQUFVLENBQUMsZ0JBQWdCLEVBQUU7SUFDL0MsT0FBTyxFQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUM7SUFDbkMsTUFBTTtJQUNOLEtBQUssRUFBRSxDQUFDLE9BQU8sQ0FBQztDQUNoQixDQUFDLENBQUM7QUFFSCxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBR1IsUUFBQSxHQUFHLEdBQUcsTUFBTSxDQUFDO0FBRW5CLE1BQU0sWUFBWSxHQUFHLENBQUMsT0FBWSxlQUFlLEVBQVUsRUFBRTtJQUNuRSxJQUFJLE1BQU0sR0FBRyxJQUFJLHdCQUFVLENBQUMsSUFBSSxFQUFFO1FBQ2pDLE9BQU8sRUFBRyxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDO1FBQ25DLE1BQU07UUFDTixLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUM7S0FDaEIsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDLENBQUE7QUFQWSxRQUFBLFlBQVksZ0JBT3hCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtGbG93TG9nZ2VyfSBmcm9tICdAYXNwZWN0cm9uL2Zsb3ctbG9nZ2VyJztcblxubGV0IGN1c3RvbSA9IFsndXR4bzpjeWFuJywgJ3V0eG9kZWJ1ZzpjeWFuJywgJ3R4OmdyZWVuJywgJ3R4ZGVidWc6Z3JlZW4nXVxuY29uc3QgbG9nZ2VyID0gbmV3IEZsb3dMb2dnZXIoJ0thcmxzZW4gV2FsbGV0JywgeyBcblx0ZGlzcGxheSA6IFsnbmFtZScsICdsZXZlbCcsICd0aW1lJ10sIFxuXHRjdXN0b20sIFxuXHRjb2xvcjogWydsZXZlbCddXG59KTtcblxubG9nZ2VyLmVuYWJsZSgnYWxsJyk7XG5cbmV4cG9ydCB0eXBlIExvZ2dlciA9IHR5cGVvZiBsb2dnZXI7IC8vVE9ETyBmaW5kIGhvdyB0byBleHBvcnQgdHlwZSBmcm9tIG1vZHVsZVxuZXhwb3J0IGNvbnN0IGxvZyA9IGxvZ2dlcjtcbmV4cG9ydCB7Rmxvd0xvZ2dlcn07XG5leHBvcnQgY29uc3QgQ3JlYXRlTG9nZ2VyID0gKG5hbWU6c3RyaW5nPVwiS2FybHNlbldhbGxldFwiKSA6IExvZ2dlcj0+e1xuXHRsZXQgbG9nZ2VyID0gbmV3IEZsb3dMb2dnZXIobmFtZSwgeyBcblx0XHRkaXNwbGF5IDogWyduYW1lJywgJ2xldmVsJywgJ3RpbWUnXSwgXG5cdFx0Y3VzdG9tLCBcblx0XHRjb2xvcjogWydsZXZlbCddXG5cdH0pO1xuXHRyZXR1cm4gbG9nZ2VyO1xufVxuIl19
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventEmitter = exports.CB = void 0;
const CB = (msg) => { };
exports.CB = CB;
class EventEmitter {
    constructor() {
        this.eventListeners = new Map();
        this.init();
    }
    init() {
        /*
        addEventListener("message", (event)=>{
            let {data:msg} = event;
            if(!msg || !msg.op)
                return
            console.log("event", event)

            let {op, data} = msg;
            this.emit(op, data);
        })
        */
    }
    on(eventName, fn) {
        let list = this.eventListeners.get(eventName);
        if (!list) {
            list = [];
            this.eventListeners.set(eventName, list);
        }
        list.push(fn);
    }
    emit(eventName, data) {
        let list = this.eventListeners.get(eventName);
        if (!list)
            return;
        list.map(fn => {
            fn(data);
        });
    }
    postMessage(op, data = {}) {
        //@ts-ignore
        postMessage({ op, data });
    }
}
exports.EventEmitter = EventEmitter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9ldmVudC1lbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFPLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBTyxFQUFDLEVBQUUsR0FBQyxDQUFDLENBQUM7QUFBbkIsUUFBQSxFQUFFLE1BQWlCO0FBR2hDLE1BQWEsWUFBWTtJQUV4QjtRQURBLG1CQUFjLEdBQTBCLElBQUksR0FBRyxFQUFFLENBQUM7UUFFakQsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQztJQUNELElBQUk7UUFDSDs7Ozs7Ozs7OztVQVVFO0lBQ0gsQ0FBQztJQUNELEVBQUUsQ0FBQyxTQUFnQixFQUFFLEVBQVU7UUFDOUIsSUFBSSxJQUFJLEdBQXVCLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2xFLElBQUcsQ0FBQyxJQUFJLEVBQUMsQ0FBQztZQUNULElBQUksR0FBRyxFQUFFLENBQUM7WUFDVixJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDMUMsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUE7SUFDZCxDQUFDO0lBQ0QsSUFBSSxDQUFDLFNBQWdCLEVBQUUsSUFBUTtRQUM5QixJQUFJLElBQUksR0FBdUIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbEUsSUFBRyxDQUFDLElBQUk7WUFDUCxPQUFNO1FBQ1AsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUEsRUFBRTtZQUNaLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNWLENBQUMsQ0FBQyxDQUFBO0lBQ0gsQ0FBQztJQUNELFdBQVcsQ0FBQyxFQUFTLEVBQUUsT0FBUyxFQUFFO1FBQ2pDLFlBQVk7UUFDWixXQUFXLENBQUMsRUFBQyxFQUFFLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztJQUN6QixDQUFDO0NBQ0Q7QUF0Q0Qsb0NBc0NDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IENCID0gKG1zZzphbnkpPT57fTtcbmV4cG9ydCB0eXBlIENCX0ZVTkMgPSB0eXBlb2YgQ0I7XG5cbmV4cG9ydCBjbGFzcyBFdmVudEVtaXR0ZXJ7XG5cdGV2ZW50TGlzdGVuZXJzOk1hcDxzdHJpbmcsIENCX0ZVTkNbXT4gPSBuZXcgTWFwKCk7XG5cdGNvbnN0cnVjdG9yKCl7XG5cdFx0dGhpcy5pbml0KCk7XG5cdH1cblx0aW5pdCgpe1xuXHRcdC8qXG5cdFx0YWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgKGV2ZW50KT0+e1xuXHRcdFx0bGV0IHtkYXRhOm1zZ30gPSBldmVudDtcblx0XHRcdGlmKCFtc2cgfHwgIW1zZy5vcClcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHRjb25zb2xlLmxvZyhcImV2ZW50XCIsIGV2ZW50KVxuXG5cdFx0XHRsZXQge29wLCBkYXRhfSA9IG1zZztcblx0XHRcdHRoaXMuZW1pdChvcCwgZGF0YSk7XG5cdFx0fSlcblx0XHQqL1xuXHR9XG5cdG9uKGV2ZW50TmFtZTpzdHJpbmcsIGZuOkNCX0ZVTkMpe1xuXHRcdGxldCBsaXN0OkNCX0ZVTkNbXXx1bmRlZmluZWQgPSB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldmVudE5hbWUpO1xuXHRcdGlmKCFsaXN0KXtcblx0XHRcdGxpc3QgPSBbXTtcblx0XHRcdHRoaXMuZXZlbnRMaXN0ZW5lcnMuc2V0KGV2ZW50TmFtZSwgbGlzdCk7XG5cdFx0fVxuXHRcdGxpc3QucHVzaChmbilcblx0fVxuXHRlbWl0KGV2ZW50TmFtZTpzdHJpbmcsIGRhdGE6YW55KXtcblx0XHRsZXQgbGlzdDpDQl9GVU5DW118dW5kZWZpbmVkID0gdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnROYW1lKTtcblx0XHRpZighbGlzdClcblx0XHRcdHJldHVyblxuXHRcdGxpc3QubWFwKGZuPT57XG5cdFx0XHRmbihkYXRhKTtcblx0XHR9KVxuXHR9XG5cdHBvc3RNZXNzYWdlKG9wOnN0cmluZywgZGF0YTphbnk9e30pe1xuXHRcdC8vQHRzLWlnbm9yZVxuXHRcdHBvc3RNZXNzYWdlKHtvcCwgZGF0YX0pO1xuXHR9XG59XG4iXX0=
/*

Usage example:

const log = new FlowLogger('TestLogger', { display : ['name','level'], custom : ['levelA:cyan','levelB'], color: 'name level' });
log.levels.enable('levelA levelB');
log.info('info log');
log.info.trace('info trace');  // prints stack trace
log.levels.disable('all').enable('debug trace');
log.trace('trace test);
log.debug('debug test);

*/


let Colors:any;

// @ts-ignore
let isNODE = typeof window == 'undefined' 
    // @ts-ignore
    && typeof process === "object" 
    // @ts-ignore
    && `${process}` === "[object process]" 
    // @ts-ignore
    && typeof require == 'function';

// @ts-ignore
if(isNODE && typeof nw !== 'undefined')
    isNODE = false;

if(isNODE){
    // @ts-ignore
    Colors = require('@aspectron/colors.ts');
}

function ansi_color(text:string, color:string) {
    return Colors.colors(color,text);
}

function theme(theme: { [key: string]: string; }) {
    if(isNODE && Colors) {
        Colors.theme(theme);
    }
}

export type Colorable = 'time'|'name'|'level'|'content'|'prefix'|'all';
export type Displayable = 'time'|'name'|'level'|'all';
export interface LogLevelToId { [key: string] : number; }
export interface LogLevelToColor { [key: string] : string; }
export interface ProfileMap { [key: string] : number; }
export declare type SinkFn = (obj: any) => boolean;

interface PrefixId {
    [key: string] : number;
}

let prefix_ids = 0;
const prefixes:PrefixId = {
  'time' : 1 << prefix_ids++,
  'name' : 1 << prefix_ids++,
  'level': 1 << prefix_ids++
}

const {
    time : time_prefix,
    name : name_prefix,
    level : level_prefix
} = prefixes;

const levels = {
    error: 'red',
    warn: 'magenta',
    info: 'white',
    verbose: 'yellow',
    network : 'blue',
    profile : 'cyan',
    trace: 'grey',
    debug: 'green',
}

export interface FlowLoggerOptions{
    sink? : SinkFn,     // callback to receive messages
    levels? : string[],   // levels to enable by default
    display? : Displayable[],   // part of the prefix to display: time|name|level
    custom? : Record<string, string>|string[], // custom log levels as { abc : 'cyan', def : 'blue } or ['abc:cyan','def:blue']
    color? : Colorable[] // component to color time|name|level|content
}

export interface FlowLoggerOpt{
    sink? : SinkFn,
    levels: string[],
    display : Displayable[],
    custom : Record<string, string>|string[],
    color : Colorable[]
}

export class FlowLogger {

    [key:string]:any;
    prefix_ui32:number;
    prefix_color_ui32:number;
    color_content:boolean;
    level_bits:number;
    to_id: LogLevelToId;
    to_color: LogLevelToColor;
    levels_ui32_:number;
    sink:SinkFn|undefined;
    profiles:ProfileMap;

    //[fn:string] : logfn;

    static getTS():string {
        let d:Date = (new Date());
        let year:string|number = d.getFullYear();
        let month:string|number = d.getMonth()+1; month = month < 10 ? '0' + month : month;
        let date:string|number = d.getDate(); date = date < 10 ? '0' + date : date;
        let hour:string|number = d.getHours(); hour = hour < 10 ? '0' + hour : hour;
        let min:string|number = d.getMinutes(); min = min < 10 ? '0' + min : min;
        let sec:string|number = d.getSeconds(); sec = sec < 10 ? '0' + sec : sec;
        //var time = year + '-' + month + '-' + date + ' ' + hour + ':' + min + ':' + sec;
        return `${year}-${month}-${date} ${hour}:${min}:${sec}`;
    }


    constructor(name:string, options:FlowLoggerOptions={}) {
        if(typeof name != 'string')
            throw new Error('FlowLogger::constructor() - first argument must be a string');

        let opt:FlowLoggerOpt = Object.assign({
            sink : null,                        // callback to receive messages
            levels : ['error','warn','info'],   // levels to enable by default
            display: ['level'],                 // part of the prefix to display: time|name|level
            custom : { },                       // custom log levels as { abc : 'cyan', def : 'blue } or ['abc:cyan','def:blue']
            color : ['name','level']            // component to color time|name|level|content
        }, options);

        this.name = name;
        this.name_prefix_ = `[${name}]`;

        this.level_bits = 0;
        this.to_id = { }
        this.to_color = { }
        this.levels_ui32_ = 0;
        this.prefix_color_ui32 = 0;
        this.profiles = {};

        let custom:any = { }
        if(Array.isArray(opt.custom))
            opt.custom.forEach(l=>{
                let [level,color] = l.split(':');
                custom[level]=color||'white';
            });
        else
            custom = opt.custom;

        this.sink = opt.sink;

        this.create({
            ...levels,
            ...custom
        }).enable(opt.levels).enable(Object.keys(custom));

        if(opt.color)
            theme(this.to_color);

        this.prefix_ui32 = opt.display.reduce((v,l)=>v|prefixes[l],0);

        this.prefix_color_ui32 = 0;
        Object.entries(prefixes).forEach(([prefix, bit]) => {
            if(opt.color.includes(prefix as Colorable) || opt.color.includes('prefix') || opt.color.includes('all'))
                this.prefix_color_ui32 |= bit;
        })
        this.color_content = opt.color.includes('content') || opt.color.includes('all');
    }


    create(descriptor:[string,string]) {
        Object.entries(descriptor).forEach(([level, color]:[string,string]) => {
            if(this.level_bits > 32)
                throw new Error(`FlowLogger allows maximum of 32 log levels`);
            this.to_id[level] = 1 << this.level_bits++;
            this.to_color[level] = color;
            if(level == 'trace')    // see FlowLogger::trace()
                return;
            this[level] = (...args:any[]): FlowLogger => { return this.log_(level, ...args); }
            this[level].trace = (...args:any[]): FlowLogger => {
                this.log_(level, ...args);
                (new Error()).stack?.split('\n').slice(2).forEach(l=>this.log_(level,l));
                return this;
            }
        })
        return this;
    }

    levels_to_ui32(levels:string[]) {
        return levels.reduce((v:number,l:string)=>v|this.to_id[l],0);
    }

    setLevel(levels:string|string[]){
        if(levels == 'none')
            return this.disable('all')

        return this.disable('all').enable(levels);
    }

    enable(levels:string|string[]):FlowLogger {
        if(levels == 'all') {
            this.levels_ui32_ = 0xffffffff;
            return this;
        }

        Object.entries(this.to_id).forEach(([l,bit]) => {
            if(levels.includes(l))
                this.levels_ui32_ |= bit;
            else
            if(this.to_id[l] === undefined)
                throw new Error(`FlowLogger::enable() - unknown log level "${l}"`);
        })

        return this;
    }

    disable(levels:string|string[]):FlowLogger {
        if(levels == 'all') {
            this.levels_ui32_ = 0x00000000;
            return this;
        }

        Object.entries(this.to_id).forEach(([l,bit]) => {
            if(levels.includes(l))
                this.levels_ui32_ &= ~bit;
        })

        return this;
    }

    relayTo(sink:SinkFn) {
        this.sink = sink;
    }

    log_(level:string, ...args:any[]): FlowLogger {

        let id = this.to_id[level];
        if(!(this.levels_ui32_ & id))
            return this;

        const ts = FlowLogger.getTS();

        if(this.sink && !this.sink({ts,level,args}))
            return this;
        const {prefix_color_ui32:prefix_color, prefix_ui32} = this;

        if(isNODE) {
            const prefix:string[] = [];

            if(prefix_ui32 & time_prefix) {
                prefix.push(prefix_color & time_prefix ? ansi_color(ts,level) : ts);
            }
            if(prefix_ui32 & name_prefix) {
                const p:string = (this.name_prefix_+((prefix_ui32 & level_prefix)?'':':'));
                prefix.push(prefix_color&name_prefix?ansi_color(p,level):p);
            }
            if(prefix_ui32 & level_prefix) {
                const l:string = (level+':');
                prefix.push(prefix_color&level_prefix?ansi_color(l,level):l);
            }

            if(this.color_content) {
                args = args.map((v:any[string])=>{
                    return typeof v === 'string' ? ansi_color(v,level) : v;
                })
            }

            console.log(...prefix, ...args);
        }
        else {
            const prefix = [];
            const colors = [];
            const color_ = 'color:'+this.to_color[level];
            const color_default = 'color:white';

            if(prefix_ui32 & time_prefix) {
                prefix.push('%c'+ts);
                if(prefix_color & time_prefix){
                    colors.push(color_)
                }else{
                    colors.push(color_default)
                }
            }
            if(prefix_ui32 & name_prefix) {
                const p = (this.name_prefix_+((prefix_ui32 & level_prefix)?'':':'));
                prefix.push('%c'+p);
                if(prefix_color & name_prefix){
                    colors.push(color_)
                }else{
                    colors.push(color_default)
                }
            }
            if(prefix_ui32 & level_prefix) {
                prefix.push(`%c${level}:`);
                if(prefix_color & level_prefix){
                    colors.push(color_)
                }else{
                    colors.push(color_default)
                }
            }

            /*
            args = args.map((arg) => {
                if(typeof arg == 'string') {
                    colors.push(color_);
                    return '%c'+arg;
                }
                else
                    return arg;
            });
            */
            console.log(prefix.join(" "), ...colors, ...args);

            return this;
        }

        return this;
    }

    trace(...args:any[]) {
        this.log_('trace', ...args);
        (new Error()).stack?.split('\n').slice(2).forEach(l=>this.log_('trace',l));
        //.forEach(l=>this.log_(level,l));
        return this;
    }

    tag(subject: string) {
        this.profiles[subject] = Date.now();
    }

    profile(subject: string, ...args:any[]) {
        const ts1 = Date.now();
        const ts0 = this.profiles[subject];
        delete this.profiles[subject];
        const delta = ts1-ts0;
        this.log_('profile', delta, ...args);
        return delta;
    }

}

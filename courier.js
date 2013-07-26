(function(name, definition) {
    if(typeof define == 'function') {
        define(definition);
    } else if(typeof module != 'undefined' && module.exports) {
        module.exports = definition;
    } else {
        window[name] = definition;
    }
})('Courier', function() {

    var protoTrim = String.prototype.trim,
        protoToString = Object.prototype.toString,
        EventsTree = {},

        rprefix = /^(before|after):(.*)/,
        rtrim = /^\s*|\s*$/,
        rseperator = /[.\/]/g;

    var Util = {
        isFunction: function(fn) {
            return fn ? (protoToString.call(fn) == '[object Function]') : false;
        },

        shrink: function(arr) {
            var len = arr.length;
            while(len--) {
                if(!this.trim(arr[len])) {
                    arr.splice(len, 1);
                }
            }
            return arr;
        },

        trim: protoTrim ? function(str) {
            return str == null ? '' : protoTrim.call(str);
        } : function(str) {
            return str.replace(rtrim, '');
        }
    };

    var EventHelper = {
        addEvent: function(name, fn, isOnce) {
            var e,
                match,
                prefix;
            if(!Util.trim(name)) return;
            if(!Util.isFunction(fn)) return;

            if((match = name.match(rprefix))) {
                prefix = match[1];
                name = match[2];
            }
            e = this.parseEventName(name);
            e[prefix || 'handlers'].push({
                fn: fn,
                isOnce: !!isOnce
            })
        },
        /*
            每个事件节点有如下属性：
                events: 子事件集合
                names: 子事件名数组，用于触发所有子事件时循环
                handlers: 事件函数数组
                after: 在该事件之后触发的事件
                before: 在该事件之前触发的事件
         */
        createEventNode: function(name, parent) {
            var node,
                names,
                events,
                i = 0,
                len;
            parent = parent || EventsTree;
            parent.events = events = parent.events || {};
            parent.handlers = parent.handlers || [];
            parent.names = names = parent.names || [];
            if((node = events[name])) return node;
            if(name == '*') {
                if(names.length) {
                    node = [];
                    for(len = names.length; i < len; i++) {
                        node.push(events[names[i]]);
                    }
                } else {
                    return null;
                }
            } else {
                names.push(name);
                node = events[name] = {
                    after: [],
                    before: [],
                    handlers: [],
                    names: [],
                    events: {}
                };
            }

            return node;
        },

        fireEvent: function(name, e) {

        },

        /*
            事件名可以是以斜杠(/)、点号(.) 分隔，表示事件的层级关系。
            触发深层的事件，可以导致它的所有上级事件触发。
            支持通配符(*)
         */
        parseEventName: function(name) {
            var i = 0,
                len,
                nlen,
                node;
            name = Util.trim(name);
            if(!name) return '';
            name = Util.shrink(name.split(rseperator));
            len = name.length;
            for(; i < len; i++) {
                if(node && (nlen = node.length)) {
                    while(nlen--) {
                        node = this.createEventNode(name[i], node[nlen]);
                    }
                } else {
                    node = this.createEventNode(name[i], node);
                }

                if(!node) {
                    throw "事件名不合法。如果输入了 * ，请确保上层事件存在！";
                    return;
                }
            }
            return node;
        }
    };

    EventHelper.addEvent('a/c', function(e) {
        alert('c')
    });
    EventHelper.addEvent('a/d', function(e) {
        alert('d')
    });
    EventHelper.addEvent('a/e', function(e) {
        alert('e')
    });

    EventHelper.addEvent('a/*/c.d', function(e) {
        alert('wa')
    });

    console.log(EventsTree)

    function fireEvent(handlers, name, around, e) {
        var hs = handlers[name],
            hasAround = typeof around == 'string',
            fn,
            arr = [];

        if(!hs) return;
        if(hasAround) {
            hs = handlers[name][around];
            if(!hs) return;
        } else {
            e = around;
        }


        while((fn = hs.shift())) {
            if(!e.isStoped) {
                fn.fn.call(null, e);
                !fn.isOnce && arr.push(fn);
            } else {
                arr.push(fn);
            }
        }
        arr.before = hs.before;
        arr.after = hs.after;
        hasAround ? (handlers[name][around] = arr) : (handlers[name] = arr);
    }

    function uniqueArray(arr, fn) {
        var len = arr.length,
            newArr = [],
            item;
        while(len--) {
            item = arr.shift();
            if(item !== fn) newArr.push(item);
        }
        newArr.before = arr.before;
        newArr.after = arr.after;
        arr = null;
        return newArr;
    }

    var C = {
        handlers: {},

        before: function(name, fn) {
            this.on('before:' + name, fn);
            return this;
        },

        after: function(name, fn) {
            this.on('after:' + name, fn);
            return this;
        },

        on: function(name, fn, isOnce) {
            EventHelper.addEvent(name, fn, isOnce);
            var isBefore = false,
                isAfter = false,
                isOnce = false,
                that = this,
                c;
            if(config && typeof config == 'string') {
                config = config.split(' ');
                for(var i = 0, len = config.length; i < len; i++) {
                    c = config[i];
                    if(c.indexOf('before') >= 0) {
                        isBefore = true;
                    } else if(c.indexOf('after') >= 0) {
                        isAfter = true;
                    } else if(c.indexOf('once') >= 0) {
                        isOnce = true;
                    }
                }
                isBefore && addEvent(this.handlers, name, 'before', fn);
                isAfter && addEvent(this.handlers, name, 'after', fn);
                isOnce && addEvent(this.handlers, name, fn, isOnce);
            } else {
                addEvent(this.handlers, name, fn);
            }
            return this;
        },

        off: function(name, fn, around) {
            var hs = this.handlers[name],
                i = 0,
                len,
                item,
                arr;
            if(hs) {
                if(!fn && !around) {
                    delete this.handlers[name];
                } else if(fn && !around) {
                    if(typeof fn == 'string') {
                        delete hs[around];
                    } else {
                        this.handlers[name] = uniqueArray(hs, fn);
                    }
                } else {
                    this.handlers[name][around] = uniqueArray(hs[around], fn);
                }
            }
            return this;
        },

        once: function(name, fn) {
            this.on(name, fn, true);
            return this;
        },

        fire: function(name, data) {
            var e = {
                    data: data,
                    //停止后续事件触发
                    stop: function() {
                        this.isStoped = true;
                    }
                };

            EventHelper.fire(name, e);
            return this;
        }
    };
    return C;
}())
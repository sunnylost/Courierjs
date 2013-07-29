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

    /*
        每个事件节点有如下属性：
            events: 子事件集合
            handlers: 事件函数数组
            after: 在该事件之后触发的事件
            before: 在该事件之前触发的事件
            nodeNames: 子事件名字数组
            name: 事件名
            parent: 父事件节点
     */
    function EventNode(name, parent, isRoot) {
        this.after = [];
        this.before = [];
        this.handlers = [];
        this.events = {};
        this.nodeNames = [];
        this.name = name;
        this.parent = parent;
        this.isRoot = !!isRoot;
    };

    EventNode.prototype = {
        constructor: EventNode,

        fire: function(e) {
            if(this.isRoot) return;
            var j, innerLen,
                handlers = this.handlers,
                before = this.before,
                after = this.after,
                handler;

            this.handlers = [];
            this.before = [];
            this.after = [];

            for(j = 0, innerLen = before.length; j < innerLen; j++) {
                handler = before[j];
                !handler.isOnce && this.before.push(handler);
                handler.fn.call(null, e);
            }
            for(j = 0, innerLen = handlers.length; j < innerLen; j++) {
                handler = handlers[j];
                !handler.isOnce && this.handlers.push(handler);
                handler.fn.call(null, e);
            }
            for(j = 0, innerLen = after.length; j < innerLen; j++) {
                handler = after[j];
                !handler.isOnce && this.after.push(handler);
                handler.fn.call(null, e);
            }
        }
    };

    var root = new EventNode('root', null, true);
    EventsTree.root = root;

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
            e[prefix || 'handlers'].unshift({
                fn: fn,
                isOnce: !!isOnce
            })
        },

        createEventNode: function(name, parent) {
            var node,
                names,
                events,
                i = 0,
                len;
            parent = parent || EventsTree.root;
            parent.events = events = parent.events;
            parent.handlers = parent.handlers;
            parent.nodeNames = nodeNames = parent.nodeNames;
            if((node = events[name])) return node;
            if(name == '*') {
                if(nodeNames.length) {
                    node = [];
                    for(len = nodeNames.length; i < len; i++) {
                        node.push(events[nodeNames[i]]);
                    }
                } else {
                    return null;
                }
            } else {
                nodeNames.push(name);
                node = events[name] = new EventNode(name, parent);
            }

            return node;
        },

        getEventNodes: function(name) {
            var nodes = [],
                node,
                j,
                pnodes = [EventsTree.root],
                pnode,
                innerLen,
                outerLen,
                pnames, events,
                names = name.split(rseperator);
            for(var i = 0, len = names.length; i < len; i++) {
                name = names[i];
                if(name == '*') {
                    for(j = 0, outerLen = pnodes.length; j < outerLen; j++) {
                        pnode = pnodes[j];
                        pnames = pnode.nodeNames;
                        innerLen = pnames.length;
                        events = pnode.events;
                        while(innerLen--) {
                            nodes.unshift(events[pnames[innerLen]]);
                        }
                    }
                    pnodes = nodes;
                    nodes = [];
                    continue;
                }
                for(j = 0, outerLen = pnodes.length; j < outerLen; j++) {
                    pnode = pnodes[j];
                    node = pnode.events[name];
                    if(!node) {
                        return null;
                    } else {
                        nodes.unshift(node);
                    }
                }
                pnodes = nodes;
                nodes = [];
            }
            return pnodes;
        },

        fireEvent: function(name, e) {
            if(!name) return;
            var names = name.split(rseperator),
                pnode = EventsTree.root,
                node, len, i;
            for(i = 0, len = names.length; i < len; i++) {
                name = names[i];
                node = pnode.events[name];
                if(!node) return;
                node.fire();
                pnode = node;
            }
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
        },

        removeEventNode: function(name, fn) {
            console.log(name)
            var events = this.getEventNodes(name);
            console.log(events);
        }
    };

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

        before: function(name, fn, isOnce) {
            EventHelper.addEvent('before:' + name, fn, isOnce);
            return this;
        },

        after: function(name, fn, isOnce) {
            EventHelper.addEvent('after:' + name, fn, isOnce);
            return this;
        },

        on: function(name, fn, isOnce) {
            EventHelper.addEvent(name, fn, isOnce);
            return this;
        },

        off: function(name, fn) {
            EventHelper.removeEventNode(name, fn);
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

            EventHelper.fireEvent(name, e);
            return this;
        }
    };
    return C;
}())

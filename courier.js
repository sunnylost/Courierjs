(function(name, definition) {
    if(typeof define == 'function') {
        define(definition);
    } else if(typeof module != 'undefined' && module.exports) {
        module.exports = definition;
    } else {
        window[name] = definition;
    }
})('Courier', function() {
    var protoTrim     = String.prototype.trim;
    var protoToString = Object.prototype.toString;
    var EventsTree    = {};

    var attrNames = [ 'before', 'handlers', 'after' ];
    var guid = 1;
    var expando = '$$courier_fn_id';

    var rsplit     = /\s+/; 
    var rprefix    = /^(before|after):(.*)/;
    var rltrim     = /^\s\s*/;
    var rrtrim     = /\s\s*$/;
    var rseperator = /[.\/]/g;

    var INVALID_EVENT_NAME = 'The event name is not valid. If it contains a "*", please make sure the upper event is exist.';

    var Util = {
        forEach: function(arr, callback) {
            if(!arr || !callback) return true;

            var i = 0;
            var len = arr.length;

            for(; i < len; i++) {
                if(callback.call(arr, arr[i], i, arr) === false) return false;
            }

            return true;
        },

        isFunction: function(fn) {
            return fn ? (protoToString.call(fn) == '[object Function]') : false;
        },

        /**
         * remove empty item.
         */
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
            return str == null ? '' : str.replace(rltrim, '').replace(rrtrim, '');
        }
    };

    function Map() {
        this._maps  = {};
        this._index = [];
    }

    Map.prototype = {
        constructor: Map,

        get: function(key) {
            key == null && (key = '');
            return this._maps[key];
        },

        set: function(key, value) {
            if(!this.has(key)) {
                this._index.push(key);
            }
            this._maps[key] = value;
        },

        has: function(key) {
            return this._maps.hasOwnProperty(key);
        },

        'delete': function(key) {
            if(this.has(key)) {
                delete this._maps[key];
                Util.forEach(this._index, function(k, i) {
                    k == key && this.splice(i, 1);
                })
            }
        },

        size: function() {
            return this._index.length;
        },

        each: function(fn) {
            var that = this;
            var maps = that._maps;

            Util.forEach(that._index, function(v, i) {
                fn.call(that, maps[v], i, that);
            })
        }
    };

    /*
        每个事件节点有如下属性：
            children:   子事件集合
            handlers: 事件函数数组
            after:  在该事件之后触发的事件
            before: 在该事件之前触发的事件
            name:   事件名
            parent: 父事件节点
     */
    function EventNode(name, parent, isRoot) {
        var that = this;

        Util.forEach(attrNames, function(v) {
            that[v] = [];
            /**
             * this index obj is used for identify duplicate function
             */
            that[v].index = {};
        })

        this.children = new Map();
        this.name   = name;
        this.parent = parent;
        this.isRoot = !!isRoot;
    };

    EventNode.prototype = {
        constructor: EventNode,

        fire: function(e) {
            if(this.isRoot) return;

            var that = this;
            /**
             * make while won't break at the first loop
             */
            var result   = 1;
            var tmp      = {};
            var exeNames = attrNames.slice(0);
            var name;

            /**
             * Use slice() to deal with 'once' method.
             * Because 'once' will remove fn during loop.
             */
            Util.forEach(exeNames, function(v) {
                tmp[v] = that[v].slice();
            })

            while((name = exeNames.shift())) {
                if(!result) break;
                result = Util.forEach(tmp[name], function(v, i) {
                    v.fn.call(v.context, e);
                    if(e.isStoped) {
                        return false;
                    }
                })
            }

            tmp = null;
            return result;
        },

        remove: function(fn, prefix) {
            if(fn) {
                var position = -1;
                var handlers = this[prefix || 'handlers'];
                var indexes  = handlers.index;

                Util.forEach(handlers, function(v, i) {
                    if(v.fn === fn) {
                        delete indexes[fn[expando]];
                        delete fn[expando];
                        position = i;
                        return false;
                    }
                })

                if(position == -1) {
                    return;
                } else if(handlers.length == 1) {
                    handlers.length = 0;
                } else {
                    handlers.splice(position, 1);
                }

                return;
            } else {
                /**
                 * remove all handlers fns, also means remove all *before* and *after* fns.
                 */
                var name     = this.name;
                var pnode    = this.parent;
                var children = pnode.children;
                children.each(function(v, i) {
                    v.name == name && (prefix ? (v[prefix].length = 0) : this.delete(name));
                })
                prefix || children.delete(name);
            }
        }
    };

    EventsTree.root = new EventNode('root', null, true);

    var EventHelper = {
        addEvent: function(name, fn, context) {
            var node;
            var match;
            var prefix;
            var that = this;
            var n;

            if(!(name = Util.trim(name)) || !Util.isFunction(fn)) return;

            if(match = name.match(rprefix)) {
                prefix = match[1];
                name   = match[2];
            }

            if(!name) return;

            name = name.split(rsplit);  //use space to support multiple events binding.

            Util.forEach(name, function(v) {
                node = that.parseEventName(v);
                Util.forEach(node, function(v) {
                    var events = v[prefix || 'handlers'];
                    var exp = fn[expando];

                    if(!exp) {
                        events.index[fn[expando] = guid++] = 1;
                    } else {
                        /*
                            don't insert duplicate fn
                         */
                        if(events.index[exp]) return true;
                        events.index[exp] = 1;
                    }

                    events.push({
                        fn: fn,
                        context: context
                    });
                })
            })
        },

        createEventNode: function(name, parent) {
            var node;
            var names;
            var children;
            var i;
            var len;

            parent    = parent || EventsTree.root;
            children  = parent.children;

            if(node = children.get(name)) return node;

            if(name == '*') {
                if(children.size()) {
                    node = [];
                    children.each(function(v) {
                        node.push(v);
                    })
                } else {
                    return null;
                }
            } else {
                children.set(name, node = new EventNode(name, parent));
            }

            return node;
        },

        getEventNodes: function(name) {
            var nodes = [];
            var node;
            var j;
            var pnodes = [EventsTree.root];
            var outerLen;
            var children;
            var names = name.split(rseperator);

            for(var i = 0, len = names.length; i < len; i++) {
                name = names[i];
                if(name == '*') {
                    for(j = 0, outerLen = pnodes.length; j < outerLen; j++) {
                        children = pnodes[j].children;
                        children.each(function(v) {
                            nodes.unshift(v);
                        })
                    }
                    pnodes = nodes;
                    nodes = [];
                    continue;
                }

                for(j = 0, outerLen = pnodes.length; j < outerLen; j++) {
                    node  = pnodes[j].children.get(name);

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
                node = pnode.children.get(name);
                if(!node) return;
                if(!node.fire(e)) return; //stop fire decendent events
                pnode = node;
            }
        },

        /*
            事件名可以是以斜杠(/)、点号(.) 分隔，表示事件的层级关系。
            触发深层的事件，可以导致它的所有上级事件触发。
            支持通配符(*)
         */
        parseEventName: function(name) {
            var i = 0;
            var len;
            var nlen;
            var nodes;
            var node;
            var n;

            if(!(name = Util.trim(name))) return '';

            name = Util.shrink(name.split(rseperator));
            len = name.length;

            for(; i < len; i++) {
                if(node && (nlen = node.length)) {
                    nodes = node;
                    node = [];
                    while(nlen--) {
                        n = this.createEventNode(name[i], nodes[nlen]);
                        if(!n) {
                            throw INVALID_EVENT_NAME;
                        }
                        node.push(n);
                    }
                } else {
                    node = this.createEventNode(name[i], node);
                }

                if(!node) {
                    throw INVALID_EVENT_NAME;
                }
            }

            return [].concat(node);
        },

        removeEventNode: function(name, fn) {
            var matches;
            var prefix;

            if(!name) return;

            if(matches = name.match(rprefix)) {
                prefix = matches[1];
                name   = matches[2];
            }

            Util.forEach(this.getEventNodes(name), function(v) {
                v.remove(fn, prefix);
            })
        }
    };

    var C = {
        before: function(name, fn, context) {
            EventHelper.addEvent('before:' + name, fn, context);
            return this;
        },

        after: function(name, fn, context) {
            EventHelper.addEvent('after:' + name, fn, context);
            return this;
        },

        on: function(name, fn, context) {
            EventHelper.addEvent(name, fn, context);
            return this;
        },

        off: function(name, fn) {
            EventHelper.removeEventNode(name, fn);
            return this;
        },

        once: function(name, fn, context) {
            var that = this;
            var newFn;

            that.on(name, newFn = function(e) {
                that.off(name, newFn);
                fn && fn.call(null, e);
            }, context);
            return that;
        },

        fire: function(name, data) {
            EventHelper.fireEvent(name, {
                data: data,
                //停止后续事件触发
                stop: function() {
                    this.isStoped = true;
                }
            });
            return this;
        }
    };
    return C;
}())

/*
    Node.js:
        https://github.com/joyent/node/blob/master/lib/events.js

        在 addListener 的时候，node 会考虑只有一个事件监听函数的情况：
            https://github.com/joyent/node/blob/master/lib/events.js#L156
        这时候不会创建数组，而只是把函数赋予它所属的类型。

        我的代码则是在创建事件节点的时候就将这一切预先设置好。
            坏处：占用内存多。分配了一些可能用不上的数组(例如 after 和 before 相对而言使用不多)
            好处：简化代码和逻辑。在使用这些数组的时候不必做非空判断，因为数组始终会存在

        node 在移除事件中也判断了数组中只包含一个事件函数的情况，清空该数组的方式是将数组 length 设置为 0


    
    call 与 apply：
        http://blog.csdn.net/zhengyinhui100/article/details/7837127
        http://jsperf.com/test-call-vs-apply/59

    查资料过程中发现的文章：
        http://blog.mozilla.org/dmandelin/2011/06/16/know-your-engines-at-oreilly-velocity-2011/
        http://www.slideshare.net/newmovie/know-yourengines-velocity2011

*/
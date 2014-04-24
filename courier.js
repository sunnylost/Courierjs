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

    var rprefix = /^(before|after):(.*)/;
    var rltrim = /^\s\s*/;
    var rrtrim = /\s\s*$/;
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
            var result = 1;
            var tmp = {};
            var exeNames = attrNames.slice(0);
            var name;
            var isStoped = false;

            Util.forEach(exeNames, function(v) {
                tmp[v]  = that[v];
                that[v] = [];
                that[v].index = {};
            })

            while((name = exeNames.shift())) {
                if(!result) break;

                result = Util.forEach(tmp[name], function(v, i) {
                    var fn = v.fn;
                    if(!v.isOnce) {
                        that[name].push({
                            fn: fn,
                            isOnce: false
                        });

                        that[name].index[fn[expando]] = 1;
                    }

                    isStoped || fn.call(null, e);
                    if(e.isStoped) isStoped = true;
                })
            }
            return result;
        },

        remove: function(fn, prefix) {
            var pnode;
            var name = this.name;
            var handlers = this[prefix || 'handlers'];
            var handler;
            var children;
            var len;

            if(fn) {
                len = handlers.length;
                //因为会动态修改数组长度，所以不能用 Util.forEach.
                while(len--) {
                    handler = handlers[len];
                    if(handler.fn === fn) {
                        delete handlers.index[fn[expando]];
                        delete fn[expando];
                        handlers.splice(len, 1);
                    }
                }
            } else {
                pnode = this.parent;
                children = pnode.children;
                children.each(function(v, i) {
                    v.name == name && (prefix ? (v[prefix] = []) : this.delete(name));
                })
                prefix || children.delete(name);
            }
        }
    };

    EventsTree.root = new EventNode('root', null, true);

    var EventHelper = {
        addEvent: function(name, fn, isOnce) {
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

            name = name.split(' ');  //use space to support multiple events binding.

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
                        isOnce: !!isOnce
                    })
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
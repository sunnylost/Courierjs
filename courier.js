
(function(name, definition) {
    if (typeof define == 'function') {
        define(definition);
    } else if (typeof module != 'undefined' && module.exports) {
        module.exports = definition;
    } else {
        window[name] = definition;
    }
})('Courier', function() {

    function addEvent(handlers, name, around, fn, isOnce) {
        if (!handlers[name]) {
            handlers[name] = [];
        }
        if (typeof around == 'string') {
            if (!handlers[name][around]) {
                handlers[name][around] = [];
            }
            handlers[name][around].push({
                fn: fn,
                isOnce: isOnce
            });
        } else {
            handlers[name].push({
                fn: around,
                isOnce: fn
            });
        }
    }

    function fireEvent(handlers, name, around, e) {
        var hs = handlers[name],
            hasAround = typeof around == 'string',
            fn,
            arr = [];

        if (hasAround) {
            hs = handlers[name][around];
        } else {
            e = around;
        }

        if (!hs) return;

        while ((fn = hs.shift())) {
            if (!e.isStoped) {
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
        while (len--) {
            item = arr.shift();
            if (item !== fn) newArr.push(item);
        }
        newArr.before = arr.before;
        newArr.after = arr.after;
        arr = null;
        return newArr;
    }

    var C = {
        handlers: {},

        before: function(name, fn) {
            this.on(name, fn, 'before');
            return this;
        },

        after: function(name, fn) {
            this.on(name, fn, 'after');
            return this;
        },

        on: function(name, fn, config) {
            var isBefore = false,
                isAfter = false,
                isOnce = false,
                that = this,
                c;
            if (config && typeof config == 'string') {
                config = config.split(' ');
                for (var i = 0, len = config.length; i < len; i++) {
                    c = config[i];
                    if (c.indexOf('before') >= 0) {
                        isBefore = true;
                    } else if (c.indexOf('after') >= 0) {
                        isAfter = true;
                    } else if (c.indexOf('once') >= 0) {
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
            if (hs) {
                if (!fn && !around) {
                    delete this.handlers[name];
                } else if (fn && !around) {
                    if (typeof fn == 'string') {
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
            this.on(name, fn, 'once');
            return this;
        },

        fire: function(name, data) {
            var e = {
                data: data,
                /*
                        停止后续事件触发
                    */
                stop: function() {
                    this.isStoped = true;
                }
            };

            fireEvent(this.handlers, name, 'before', e);
            fireEvent(this.handlers, name, e);
            fireEvent(this.handlers, name, 'after', e);
            return this;
        }
    };
    return C;
}()) 

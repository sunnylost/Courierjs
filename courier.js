(function(name, definition) {
    if(typeof define == 'function') {
        define(definition);
    } else if(typeof module != 'undefined' && module.exports) {
        module.exports = definition;
    } else {
        window[name] = definition;
    }
})('Courier', function() {
    var C = {
        handlers : {},

        on : function(name, handler) {
            var h = this.handlers;
            if(!h[name]) {
                h[name] = [];
            }
            h[name].push(handler);
        },

        off : function(name) {
            var hs = this.handlers[name];
            if(hs) {
                delete this.handlers[name];
            }
        },

        once : function(name, handler) {
            var h = this.handlers,
                that = this;
            if(!h[name]) {
                h[name] = [];
                h[name].push(function() {
                    that.off(name);
                });
            }
            h[name].push(handler);
        },

        fire : function(name, data) {
            var hs = this.handlers[name],
                i = 0,
                len;

            if(!hs || (len = hs.length) == 0) return;
            while(i < len) {
                hs[i++].call(null, {
                    data: data
                });
            }
        }
    };
    return C;
}())
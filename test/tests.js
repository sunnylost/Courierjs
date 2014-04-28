(function() {
    var C = Courier;

    test('bind one handler for an event and fire it', function() {
        var o = {};

        C.on('t1', function() {
            o.count = 0;
        })

        C.fire('t1');
        equal(o.count, 0, 't1 should be executed.');
    });

    test('bind multiple handlers for an event and fire it', function() {
        var o = {
            count: 0
        };

        function incre() {
            o.count++;
        }

        C.on('t2', function() {
            incre();
        })
         .on('t2', function() {
            incre();
        })
         .on('t2', function() {
            incre();
        })
         .fire('t2');

        equal(o.count, 3, 't2 contains 3 handlers, so count must be 3.')
    });

    test('filter duplicate event handler', function() {
        var o = {
            count: 0
        };

        function incre() {
            o.count++;
        }

        C.on('t2', incre)
         .on('t2', incre)
         .on('t2', incre)
         .fire('t2');

        equal(o.count, 1, 'duplicate handlers only bind once')
    });

    test('fire one event multiple times', function() {
        var o = {
            count: 0
        };

        function incre() {
            o.count++;
        }

        C.on('t3', incre)
         .fire('t3')
         .fire('t3')
         .fire('t3');

        equal(o.count, 3, 't3 should be fired 3 times.')
    });

    test('bind once handler', function() {
        var o = {
            count: 0
        };

        function incre() {
            o.count++;
        }

        C.once('t4', incre)
         .fire('t4')
         .fire('t4');

        equal(o.count, 1, 'incre() should only execute once.'); 
    });

    test('remove event handlers', function() {
        var o = {
            count: 0
        };

        function incre() {
            o.count++;
        }

        var f1, f2;

        C.on('t5', f1 = function() {
            incre();
        })
         .on('t5', f2 = function() {
            incre();
         })
         .fire('t5')
         .off('t5', f1)
         .fire('t5');

        equal(o.count, 3, 'remove one event handler success');

        C.off('t5')
         .fire('t5');

        equal(o.count, 3, 'remove multiple event handlers success');
    });

    test('test before handlers', function() {
        var o = {
            count: 0
        };

        function incre() {
            o.count++;
        }

        C.on('before:t6', incre)
         .fire('t6');

        equal(o.count, 1, 'before t6 execute.');

        C.before('t6', function() {
            incre();
        }).fire('t6');

        equal(o.count, 3, 'use different styles to bind before event.');

        C.off('before:t6', incre)
         .fire('t6');

        equal(o.count, 4, 'remove before event.');

        C.off('t6')
         .fire('t6');

        equal(o.count, 4, 'remove t6 event will remove all before handlers. ')
    });

    test('test after handlers', function() {
        var o = {
            count: 0
        };

        function incre() {
            o.count++;
        }

        C.on('after:t7', incre)
         .fire('t7');

        equal(o.count, 1, 'after t7 execute.');

        C.after('t7', function() {
            incre();
        }).fire('t7');

        equal(o.count, 3, 'use different styles to bind after event.');

        C.off('after:t7', incre)
         .fire('t7');

        equal(o.count, 4, 'remove after event.');

        C.off('t7')
         .fire('t7');

        equal(o.count, 4, 'remove t7 event will remove all after handlers. ')
    });

    test('bind multiple events', function() {
        var o = {
            count: 0
        };

        function incre() {
            o.count++;
        }

        C.on('t8  t9', function() {
            incre();
        })
         .fire('t8')
         .fire('t9');

        equal(o.count, 2, 't8 and t9 both fired.')
    });

}())
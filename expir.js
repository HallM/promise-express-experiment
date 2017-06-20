const Promise = require('bluebird');

function a(next) {
  console.log('pre-a');
  return next().then(function() {
    console.log('post-a');
  }).catch(function(err) {
    console.log('inside post-a', err);
  });
}

function b(next) {
  console.log('pre-b');
  // return Promise.reject('an error');
  setTimeout(function() {
    return next().then(function() {
      console.log('post-b');
    // }).catch(function(err) {
    //   console.log('inside post-b', err);
    });
  }, 100);
}

function c(next) {
  console.log('pre-c');
  next('err');
}

function end() {
  console.log('finally');
}

const list = [a, b, c].concat(end);
const length = list.length;

runList().then(() => {
  console.log('finished running list');
}).catch((err) => {
  console.error('caught by the system?');
  console.error(err);
});

function runList() {
  return new Promise((finalResolve, finalReject) => {
    var index = 0;
    var prevResolve = finalResolve;
    var prevReject = finalReject;

    /*
    1 -> 2 -> 3 -> 4
    1 is "resolved" when 1() and 2() are
    2 is "resolved" when 2() and 3() are
    ...
    4 is "resolved" when 4() is

    so, could do Promise.all([1(), new P])
    then for the next one, it resolves new P when 2() finishes
    */

    next();

    function next(err) {
      if (err != null) {
        prevReject(err);
        return;
      }

      if (index >= length) {
        prevResolve && prevResolve();
        return;
      }

      const pres = prevResolve;
      const prej = prevReject;

      const thisIndex = index++;
      const middleware = list[thisIndex];

      // the next function is *only* available to non-final
      const nxtFn = index === length ? undefined : next;

      // generate a Promise to be resolved when the next item finishes
      let p1 = null;
      if (index === length) {
        // if this is the last item, then it resolves immediately since there is no next
        prevResolve = null;
        // dont unset prevReject
        // prevReject = null;
        p1 = Promise.resolve();
      } else {
        p1 = new Promise(function(resolve, reject) {
          prevResolve = resolve;
          prevReject = reject;
        });
      }

      let p2;
      try {
        p2 = Promise.resolve(middleware(nxtFn));
      } catch (err) {
        p2 = Promise.reject(err);
      }

      const pret = Promise.all([p1, p2]).then(function() {
        // console.log('call back up stack', thisIndex);
        pres();
      }).catch(function(err) {
        // console.log(pret);
        if (!hasCatch(pret)) {
          // then remove any then statements?
          pret._promise0 = undefined;
          pret._fulfillmentHandler0 = undefined;

          // and bubble up if the user wouldnt have handled it
          prej(err);
        } else {
          // we have to reject it, otherwise the .then would be called
          return Promise.reject(err);
        }
        // return Promise.reject(err);
      });

      // setImmediate(function() {
      //   // if the user wouldnt have caught it, then bubble it up
      //   // console.log(pret);
      //   if (!hasCatch(pret)) {
      //     pret.catch(function(err) {
      //       console.log('bubbling up', thisIndex);
      //       prej(err);
      //     });
      //   }
      // });

      return pret;
    }
  });
}

function hasCatch(promise) {
  if (!promise) {
    return false;
  }

  if (promise._rejectionHandler0) {
    return true;
  }

  if (promise._promise0) {
    return hasCatch(promise._promise0);
  }

  return false;
}

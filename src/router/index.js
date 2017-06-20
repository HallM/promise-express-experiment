'use strict';

const TrieRouter = require('./router');
const methods = require('methods');
const Promise = require('bluebird');

function Router() {
  this.router = new TrieRouter();
}

Router.prototype.handle = function handle(req, res) {
  // TODO: need to expose a path?
  const path = req.url;
  const method = req.method.toLowerCase();

  const node = this.router.handle(method, path);

  req.params = node.params;

  const chain = _getMiddlewareChain(node.route, method);
  const chainPromises = chain.map(c => null);
  const chainLength = chain.length;

  return new Promise((finalResolve, finalReject) => {
    let index = -1;
    let prevResolve = finalResolve;
    let prevReject = finalReject;

    dispatch(0);

    function dispatch(i) {
      if (i <= index) {
        return Promise.reject(new Error('cannot call next() multiple times in the same middleware'));
      }

      if (i >= chainLength) {
        // this shouldn't happen, but planned for it anyway
        prevResolve && prevResolve();
        return;
      }

      index = i;

      // copy the previous resolve/reject, because we need to replace these for the next one
      const lastResolve = prevResolve;
      const lastReject = prevReject;

      // generate a Promise to be resolved when the next item finishes
      let nextPromise = null;
      if (index === chainLength) {
        // if this is the last item, then it resolves immediately since there is no next
        // we don't unset prevReject, even though next is not available. just to be safe
        prevResolve = null;
        nextPromise = Promise.resolve();
      } else {
        nextPromise = new Promise(function(resolve, reject) {
          prevResolve = resolve;
          prevReject = reject;
        });
      }

      const middleware = chain[i];

      // nextFn is only available for non-ending middleware
      const nextFn = (i + 1) === chainLength ? undefined : function next(err) {
        if (err != null) {
          return Promise.reject(err);
        }

        return dispatch(i + 1);
      }

      let middlewarePromise;
      try {
        middlewarePromise = Promise.resolve(middleware(req, res, nextFn));
      } catch (err) {
        middlewarePromise = Promise.reject(err);
      }

      const thisPromise = Promise.all([nextPromise, middlewarePromise]).then(function() {
        // console.log('call back up stack', thisIndex);
        lastResolve();
      }).catch(function(err) {
        // console.log(pret);
        if (!hasCatch(thisPromise)) {
          // bubble up if the user wouldnt have handled it
          lastReject(err);
        }

        // we have to reject it, otherwise the .then would be called
        return Promise.reject(err);
      });

      return thisPromise;
    }
  });
};

Router.prototype.use = function use(...args) {
  const path = typeof args[0] === 'string' ? args.shift() : '/';
  const middleware = args;

  this.router.add({
    path: path,
    middleware: middleware,
    methods: ['use']
  });

  return this;
};

methods.forEach(function(method) {
  Router.prototype[method] = function addMethod(path, ...middleware) {
    this.router.add({
      path: path,
      middleware: middleware,
      methods: [method]
    });
    return this;
  };
});

function _getMiddlewareChain(route, method) {
  let chain = route.middleware[method];

  let node = route;
  let isNextDirectory = true;

  while (node != null) {
    if (isNextDirectory || node.str[node.str.length - 1] === '/') {
      const usedMiddleware = node.middleware.use;
      if (usedMiddleware && usedMiddleware.length) {
        // since we are traversing backwards, add the middleware to the front
        chain = usedMiddleware.concat(chain);
      }
    }

    isNextDirectory = node.str && node.str[0] === '/';
    node = node.parent;
  }

  return chain;
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

module.exports = Router;

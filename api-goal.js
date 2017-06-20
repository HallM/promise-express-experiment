// this file is the goal for how the api may look
// not final, just an idea
// function names are the least final of everything

// mounting middleware to run on every request
app.use(someMiddlewareForAll);

// a single path
app
  .route('/path1')
  .use(someMiddlewareForPath1)
  .get(handler1g)
  .post(handler1p);

// nesting routes using a callback
app
  .route('/path2', function(route) {
    // same as path1, but in the callback
    route
      .use(someMiddlewareForPath2)
      .get(handler2g)
      .put(handler2p);

    route
      .path('/subdir2')
      .get(subHandler2);
  });

// another way to do nesting
const path3 = app.route('/path3');
path3
  .use(someMiddlewareForPath3)
  .get(handler3g)
  .put(handler3p);

path3 // we could have made this one call to path3, but it is more confusing then
  .route('/subdir3')
  .get(subHandler3);

// dir paths still allowed, just the above exists for simplicity
app
  .route('/path4/subdir4')
  .get(subHandler4);

// Some may desire the .get, .post, etc shorthands
app.use('/path5', someMiddlewareForPath5);
app.get('/path5', handler5g);
app.post('/path5', handler5p);

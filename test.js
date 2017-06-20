const util = require('util');
const mattpress = require('./src/mattpress');

const app = mattpress();

app.use('/', function(req, res, next) {
  console.log('pre-use in slash!');
  return next().then(function() {
    console.log('post-use in slash!');
  });
});

app.use('/test', function(req, res, next) {
  console.log('pre-use in test');
  setTimeout(function() {
    next().then(function() {
      console.log('post-use in test');
    });
  }, 200);
});

app.get('/', function(req, res) {
  res.send('in slash');
});

app.get('/test/one', function(req, res) {
  res.send('in test-one');
});

app.get('/test/{testing}', function(req, res) {
  res.send('in test-:' + req.params.testing);
});

app.get('/test/two', function(req, res) {
  res.send('in test-two');
});

app.use('/test/t', function(req, res, next) {
  console.log('pre-use in test-t');
  return next().then(function() {
    console.log('post-use in test-t');
  });
});

app.use('/test/three/four', function(req, res, next) {
  console.log('pre-use in test-3-4');
  next().then(function() {
    console.log('post-use in test-3-4');
  });
});

app.get('/test/three/four', function(req, res) {
  res.send('in test-three-four');
});

app.listen(3000, function() {
  console.log('ready');
});

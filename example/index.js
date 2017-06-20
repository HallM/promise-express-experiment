// var express = require('express');
var express = require('../src/mattpress');
var app = express();

var winston = require('winston');
winston.level = 'silly';

var cons = require('consolidate');
var csrf = require('csurf');

var session = require('express-session');

var cookieParser = require('cookie-parser');
var compression = require('compression');
var bodyParser = require('body-parser');

var expressWinston = require('express-winston');

app.engine('dust', cons.dust);
app.set('view engine', 'dust');
app.set('views', 'views');

app.use(function(req, res, next) {
  return next().then(() => {
    console.log('after');
  }).catch((err) => {
    res.send('An error occured');
    console.log(err);
  });
});

app.use(compression());
winston.silly('Configuring util functions');
app.use(function(req, res, next) {
  req.wantsJSON = req.xhr || (req.accepts('html', 'json') === 'json');
  next();
});

winston.silly('Configuring middlewares');
app.use(cookieParser());

app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 3600 * 1000
  }
}));

app.use(expressWinston.logger({
  winstonInstance: winston,
  statusLevels: true,
  expressFormat: true,
  meta: false,
  msg: '{{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms '
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// enable CSRF protection
app.use(csrf({
  cookie: true
}));

app.use(function(req, res, next) {
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('X-FRAME-OPTIONS', 'SAMEORIGIN');
  res.locals._csrf = req.csrfToken();
  next();
});

app.get('/', function(req, res) {
  return res.render('wrong');
});

app.listen(3000, function() {
  console.log('ready, listening on port 3000');
});

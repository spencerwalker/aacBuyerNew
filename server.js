'use strict';
var config = require('./gulp.config');

var express = require('express'),
    env = process.env.NODE_ENV = process.env.NODE_ENV || 'dev',
    app = express(),
    port = process.env.PORT || 451;

const crypto = require('crypto');

//Used to check auto-login param security
app.use('/checklogin/:t/:ts', function (req, res, next) {
  var hashResult = validateTimeHash(req.params.t, req.params.ts);
  res.send(hashResult);
});

app.get("/communityUrl", function(request, response) {
  response.json(process.env.COMMUNITY_URL);
});

switch(env) {
    case 'production':
        console.log('*** PROD ***');
        app.use(express.static(config.root + config.compile.replace('.', '')));
        app.get('/*', function(req, res) {
            res.sendFile(config.root + config.compile.replace('.', '') + 'index.html');
        });
        break;
    default:
        console.log('*** DEV ***');
        // Host bower_files
        app.use('/bower_files', express.static(config.root + config.bowerFiles.replace('.', '')));
        // Host unminfied javascript files
        app.use(express.static(config.root + config.build.replace('.', '')));
        // Host unchanged html files
        app.use(express.static(config.root + config.src.replace('.', '') + 'app/'));
        //app.use(express.static(config.root));
    	//app.use(express.static(config.root + config.components.dir));
        app.get('/*', function(req, res) {
            res.sendFile(config.root + config.build.replace('.', '') + 'index.html');
        });
        break;
}

app.listen(port);
console.log('Listening on port ' + port + '...');

function validateTimeHash(t, ts) {
  if (!t || !ts) {
    return false;
  }

  var secret = process.env.HASH_SECRET;
  console.log('*** secret ***' + secret);
  var hash = crypto.createHmac('sha256', secret)
                 .update(t)
                 .digest('hex');
  console.log('*** ts ***' + ts);
  console.log('*** hash ***' + hash);
  return ts == hash;
}
/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express  = require('express'),
  app        = express(),
  bluemix    = require('./config/bluemix'),
  watson     = require('watson-developer-cloud'),
  extend     = require('util')._extend,
  i18n       = require('i18next'),
  twitter    = require('twitter'),
  http       = require('http');

var port = process.env.VCAP_APP_PORT || 3000;

//i18n settings
require('./config/i18n')(app);

// Bootstrap application settings
require('./config/express')(app);

// if bluemix credentials exists, then override local
var credentials = extend({
  version: 'v2',
  username: '<username>',
  password: '<password>'
}, bluemix.getServiceCreds('personality_insights')); // VCAP_SERVICES

// Create the service wrapper
var personalityInsights = watson.personality_insights(credentials);

app.post('/', function(req, res, next) {
  var parameters = extend(req.body, { acceptLanguage : i18n.lng() });

  personalityInsights.profile(parameters, function(err, profile) {
    if (err)
      return next(err);
    else
      return res.json(profile);
  });
});


// delegates to and gets response from /tweets/:screen_name
app.get('/personality/:screen_name', function(req, res) {
  var requestOptions = {
        port: port,
        path: '/tweets/' + req.params.screen_name
      },
      req;

  req = http.request(requestOptions, function(upstreamRes) {
    var str = '';
    upstreamRes.on('data', function(chunk) {
      str += chunk;
    });

    upstreamRes.on('end', function() {
      res.json(str);
      // TODO: POST string to /
      console.log('received this response from upstream: ' + str);
    });
  });
  req.end();
});

// TWITTER COMM
var twitterClient = new twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

function getTweets(req, res) {
  var params = {screen_name: req.params.screen_name},
      textOfTweets;

  twitterClient.get('statuses/user_timeline', params, function (error, tweets, response) {
    if (!error) {
      // TODO: Concat text together
      textOfTweets = tweets.map(function (tweet) {
        return tweet.text;
      }).join('. ');  // naive joining of all tweets
      console.log(textOfTweets);
      res.json(textOfTweets);
    } else {
      console.error(error);
      res.status(500).json({error: 'Something went wrong!'});
    }
  });
}

// app routes:
app.get('/tweets/:screen_name', getTweets);

// END TWITTER COMM


// error-handler settings
require('./config/error-handler')(app);

app.listen(port);
console.log('listening at:', port);

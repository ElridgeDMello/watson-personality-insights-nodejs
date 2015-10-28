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
  amazon = require('amazon-product-api'),
  app        = express(),
  bluemix    = require('./config/bluemix'),
  watson     = require('watson-developer-cloud'),
  extend     = require('util')._extend,
  i18n       = require('i18next'),
  twitter    = require('twitter'),
  http       = require('http'),
  _          = require('underscore');

var port = process.env.VCAP_APP_PORT || 3000;

//i18n settings
require('./config/i18n')(app);

// Bootstrap application settings
require('./config/express')(app);

// if bluemix credentials exists, then override local
var credentials = extend({
  version: 'v2',
  username: process.env.PERSONALITY_INSIGHTS_USERNAME,
  password: process.env.PERSONALITY_INSIGHTS_PASSWORD
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


function getStrongestNeedAndValue(profile) {
    function getMaxCategory(categoryChildren) {
        return _.max(categoryChildren, function(categoryChild) {
            return categoryChild.percentage;
        });
    }
    var relevantCategories = profile.tree.children.filter(function(category) {
        return category.id === 'values'  || category.id === 'needs';
    });

    return relevantCategories.map(function(category) {
        return {
            category: category.name,
            max: getMaxCategory(category.children[0].children).name
        }
    });
}

function performProductRecommendationSearch(profile, response) {
  /* TODO:
  e.g. structure:
  {
    recommendations: [
      {id: '', title: 'Item1', reason: 'Your friend has a high need in ...' },
    ...],
    reason: 'Based on your friend\'s strong personality traits:
  }
   */
  var profileKeywords = _.pluck(getStrongestNeedAndValue(profile), 'max').join(', '),
      bookRecommendationParams = {
          port: port,
          path: '/books/' + encodeURIComponent(profileKeywords),
          method: 'GET'
      }, req;

  req = http.request(bookRecommendationParams, function(productsResponse) {
      var recommendedProductsStr = '', recommendedProducts;

      productsResponse.on('data', function(chunk) {
          recommendedProductsStr += chunk;
      });
      productsResponse.on('end', function() {
          recommendedProducts = {
              recommendations: JSON.parse(recommendedProductsStr),
              reason: 'Your friend\'s strongest personality needs/attributes are: ' +
                        profileKeywords
          };
          //console.log('got products: ' + recommendedProductsStr);
          response.json(recommendedProducts);
      });
  });
  req.end();
}

function performPersonalityAnalysis(userInputText, callback, res) {
  var personalityInsightRequest = {
        port: port,
        path: '/',
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'}
      },
      req;

  req = http.request(personalityInsightRequest, function(profileRes) {
    var profileStr = '', profile;

    profileRes.on('data', function(chunk) {
      profileStr += chunk;
    });
    profileRes.on('end', function() {
      profile = JSON.parse(profileStr);
      callback(profile, res);
    });

  });
  req.write(userInputText);
  req.end();
}


// delegates to and gets response from /tweets/:screen_name
app.get('/personality/:screen_name', function(req, res) {
  var requestOptions = {
        port: port,
        path: '/tweets/' + req.params.screen_name
      },
      req;

  req = http.request(requestOptions, function(upstreamRes) {
    var endUserInputText = '';
    upstreamRes.on('data', function(chunk) {
      endUserInputText += chunk;
    });

    upstreamRes.on('end', function() {
      //res.json(endUserInputText);
      //console.log('Going to POST to /personalityInsights: ' + endUserInputText);
      performPersonalityAnalysis('text=' + endUserInputText, performProductRecommendationSearch, res);
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
      textOfTweets = tweets.map(function (tweet) {
        return tweet.text;
      }).join('. ');  // naive joining of all tweets
      //console.log(textOfTweets);
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


// AMAZON COMM
var amazonClient = amazon.createClient({
    awsId: process.env.AMAZON_ASSOC_AWS_ID,
    awsSecret: process.env.AMAZON_ASSOC_AWS_SECRET,
    awsTag: process.env.AMAZON_ASSOC_AWS_TAG
});

function getBooks(req, res) {
    "use strict";
    var params = {
        keywords: req.params.keywords,  // a comma separated list of strings
        searchIndex: 'Books',
        responseGroup: 'Images,ItemAttributes',
        sort: 'relevancerank'
    };

    amazonClient.itemSearch(params).then(function(results) {
        var mappedResult = results.map(function (item) {
            return {
                url: item.DetailPageURL[0],
                image: {
                    url: item.LargeImage[0].URL[0],
                    height: item.LargeImage[0].Height[0]._,
                    width: item.LargeImage[0].Width[0]._
                },
                title: item.ItemAttributes[0].Title[0]
            };
        });
        res.json(mappedResult);
    }).catch(function(err) {
        console.error(err);
        res.status(500).json({error: 'Something went wrong talking to Amazon!'});
    });
}

app.get('/books/:keywords', getBooks);

// END AMAZON COMM



// error-handler settings
require('./config/error-handler')(app);

app.listen(port);
console.log('listening at:', port);

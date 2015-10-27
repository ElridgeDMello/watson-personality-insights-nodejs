var Twitter = require('twitter'),
    app = require('express')();

var twitterClient = new Twitter({
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
            });
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


// start app listening
var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);

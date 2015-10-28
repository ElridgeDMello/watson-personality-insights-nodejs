var amazon = require('amazon-product-api'),
    app = require('express')();

var amazonClient = amazon.createClient({
    awsId: process.env.AMAZON_ASSOC_AWS_ID,
    awsSecret: process.env.AMAZON_ASSOC_AWS_SECRET,
    awsTag: process.env.AMAZON_ASSOC_AWS_TAG
});

function getBooks(req, res) {
    "use strict";
    var params = {
        keywords: req.params.keywords,
        searchIndex: 'Books',
        responseGroup: 'Images,ItemAttributes,Offers',
        sort: 'relevancerank'
    };

    amazonClient.itemSearch(params).then(function(results) {
        res.json(results);
    }).catch(function(err) {
        console.error(err);
        res.status(500).json({error: 'Something went wrong talking to Amazon!'});
    });
}

app.get('/books/:keywords', getBooks);

// start app listening
var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);
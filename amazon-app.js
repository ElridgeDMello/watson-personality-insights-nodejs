var amazon = require('amazon-product-api');

var client = amazon.createClient({
    awsId: process.env.AMAZON_ASSOC_AWS_ID,
    awsSecret: process.env.AMAZON_ASSOC_AWS_SECRET,
    awsTag: process.env.AMAZON_ASSOC_AWS_TAG
});

client.itemSearch({
    director: 'Quentin Tarantino',
    actor: 'Samuel L. Jackson',
    searchIndex: 'DVD',
    audienceRating: 'R',
    responseGroup: 'ItemAttributes,Offers,Images'
}).then(function(results){
    console.log(results);
}).catch(function(err){
    console.log(err);
});
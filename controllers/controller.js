// ************************************************************
// Program: News-Review
// Authors: Rod Skoglund
// File: controller.js
// Description: Provides the code for the routes
// ************************************************************

// Node Dependencies
var express = require('express');
var router = express.Router();
var request = require('request'); // for web-scraping
var cheerio = require('cheerio'); // for web-scraping

// Import the Comment and Article models
var Comment = require('../models/Comment.js');
var Article = require('../models/Article.js');

// Index Page Render (first visit to the site)
router.get('/', function (req, res){

  // Scrape data
  res.redirect('/scrape');

});


// Articles Page Render
router.get('/articles', function (req, res){

  // Query MongoDB for all article entries (sort newest to top, assuming Ids increment)
  Article.find().sort({_id: -1})

    // populate all of the comments associated with the articles.
    .populate('comments')

    // Send them to the handlebars template to be rendered
    .exec(function(err, doc){
      // log any errors
      if (err){
        console.log(err);
      } 
      // or send the doc to the browser as a json object
      else {
        var hbsObject = {articles: doc}
        res.render('index', hbsObject);
      }
    });

});


// Web Scrape Route
router.get('/scrape', function(req, res) {

  // Grab the body of the html with request
  request('http://www.foxnews.com/', function(error, response, html) {

    // Load the html into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);

    // Define he error handler to test for duplicate articles on the Fox News website
    var titlesArray = [];

    // Grab everything with a class of "info" with each "article" tag
    $('article .info').each(function(i, element) {

        // Create an empty result object
        var result = {};

        // Collect the Article Title (contained in the "h2" of the "header" of "this")
        result.title = $(this).children('header').children('h2').text().trim() + "";

        // Collect the Article Link (contained within the "a" tag of the "h2" in the "header" of "this")
        result.link = $(this).children('header').children('h2').children('a').attr('href').trim();

        // Collect the Article Summary (contained in the next "div" inside of "this")
        result.summary = $(this).children('div').text().trim() + "";
      
        // Test for empty summary and, if it is empty, provide a default value so it is not empty
        if (result.summary == "") {
          result.summary = "No summary available for " + result.title;
        }

        // Error handling to ensure there are no empty scrapes
        if (result.title !== "") {
          // Check within each scrape for duplicate articles since Fox News can have duplicates
          if (titlesArray.indexOf(result.title) == -1) {

            // Push the saved item to our titlesArray to prevent duplicates thanks Fox News...
            titlesArray.push(result.title);

            // Only add the entry to the database if is not already there
            Article.count({ title: result.title}, function (err, test) {

              // If the count is 0, then the entry is unique and should be saved
              if (test == 0) {

                // Using the Article model, create a new entry (comment that the "result" object has the exact same key-value pairs of the model)
                var entry = new Article (result);

                // Save the entry to MongoDB
                entry.save(function(err, doc) {
                  // log any errors
                  if (err) {
                    console.log(err);
                  } 
                  // or log the doc that was saved to the DB
                  else {
                    console.log(doc);
                  }
                });

              }
              // Log that scrape is working, just the content was already in the Database
              else {
                console.log('Redundant Database Content. Not saved to DB.')
              }
            });
        }
        // Log that scrape is working, just the content was missing parts
        else {
          console.log('Redundant Fox News Content. Not Saved to DB.')
        }
      }
      // Log that scrape is working, just the content was missing parts
      else{
        console.log('Empty Content. Not Saved to DB.')
      }
    });

    // Redirect to the Articles Page, done at the end of the request for proper scoping
    res.redirect("/articles");

  });
});


// Add a Comment Route
router.post('/add/comment/:id', function (req, res){

  // Collect article id
  var articleId = req.params.id;
  
  // Collect Author Name
  var commentAuthor = req.body.name;

  // Collect Comment Content
  var commentContent = req.body.comment;

  // "result" object has the exact same key-value pairs of the "Comment" model
  var result = {
    author: commentAuthor,
    content: commentContent
  };

  // Using the Comment model, create a new comment entry
  var entry = new Comment (result);

  // Save the entry to the database
  entry.save(function(err, doc) {
    // log any errors
    if (err) {
      console.log(err);
    } 
    // Or, relate the comment to the article
    else {
      // Push the new Comment to the list of comments in the article
      Article.findOneAndUpdate({'_id': articleId}, {$push: {'comments':doc._id}}, {new: true})
      // execute the above query
      .exec(function(err, doc){
        // log any errors
        if (err){
          console.log(err);
        } else {
          // Redirect to the Articles Page, done at the end of the request for proper scoping
          res.redirect("/articles");
        }
      });
    }
  });

});

// Delete a Comment Route
router.post('/remove/comment/:id', function (req, res){

  // Collect comment id
  var commentId = req.params.id;

  // Find and Delete the Comment using the Id
  Comment.findByIdAndRemove(commentId, function (err, todo) {  
    
    if (err) {
      console.log(err);
    } 
    else {
      // Redirect to the Articles Page, done at the end of the request for proper scoping
      res.redirect("/articles");
    }

  });

});


// Export Router for use in Server.js
module.exports = router;
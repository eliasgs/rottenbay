var uuid = 'F03B61B9-87B3-4A1D-8FD6-263F254E0D82';
var request = require('request');
var $ = require('cheerio');
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

module.exports = (function (){
  var progress = new EventEmitter();
  var movies = [];
  var getRatings = function (movieList, callback){
    var _movie = movieList.pop();
    request('http://www.rottentomatoes.com/search/?search='+_movie.name.replace(/\s+/g, '+'), function (err, res, body){
      if (!err && res.statusCode == 200){
        var rating = '';
        var tmp = $('#movie_results_ul .tMeterScore', body);
        if ($(tmp).length > 0){
          rating = $(tmp).first().text().replace('%', '');  
        }
        tmp = $('.fan_side .meter', body);
        if ($(tmp).length > 0){
          rating = $(tmp).first().text();
        }
        var movie = {seeds: _movie.seeds, name: _movie.name, rating: rating};
        movies.push(movie);
        progress.emit('movie', movie);
        if (movieList.length == 0){
          movies.sort(function (a, b){ return b.rating - a.rating; });
          // Save in cache (don't wait for async call to finish)
          fs.writeFile('/tmp/'+uuid, JSON.stringify(movies));
          callback(movies);
        }
        else{
          getRatings(movieList, callback);
        }
      }
    });
  };
  var get = function (callback){
    request('http://pirateproxy.net/top/201', function (err, res, body){
      if (err) throw err;
      if (res.statusCode == 200){
        var count = 1;
        var movieList = [];
        $('.detLink', body).each(function (i, e){
          var val = $(e).text();
          var seeds = $(e).parent().parent().next().text();
          if (/.*rip.*/i.test(val)){
            val = val
              .replace(/(dvd|br|bd)rip.*/i, '')
              .replace(/\d{4}.*/, '')
              .replace(/[^\w]/g, ' ')
              .replace(/\s+$/, '');
            movieList.push({name: val, seeds: seeds});
          }
        });
        progress.emit('movieList', movieList);
        // If cache file exists and the movie list hasn't changed,
        // use the cache
        fs.exists('/tmp/'+uuid, function (exists){
          if (exists){
            fs.readFile('/tmp/'+uuid, function (err, data){
              if (err) throw err;
              var pbList = [], cachedList = [], cachedMovies = JSON.parse(data);
              movieList.map(function (movie){ pbList.push(movie.name); });  
              cachedMovies.map(function (movie){ cachedList.push(movie.name); });  
              pbList.sort(); cachedList.sort();
              if (JSON.stringify(pbList) == JSON.stringify(cachedList)){
                callback(cachedMovies);
                progress.emit('done');
              } 
              else{
                getRatings(movieList, callback);
              }
            });     
          } 
          else{
            getRatings(movieList, callback);
          } 
        });
      }
    });
  };
  return {
    get: get,
    progress: progress
  };
})();

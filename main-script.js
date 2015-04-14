/*
 * (c) Copyright 2014 Charlie Harvey, 2015 Bogdan Mihaila
 * 
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 */

function testMain() {
  var e = {};
  e.parameter = {};
  e.parameter.user = "ciderpunx";
  // e.parameter.replies = "on";
  // e.parameter.tweetscount = "100";
  doGet(e);
}

function doGet(e) {
  var user = e.parameter.user;
  if (!user)
    return ContentService.createTextOutput("Error: no user specified!");
  var include_replies = false;
  if (e.parameter.replies === "on")
    include_replies = true;
  var tweets_count = 100;
  var tweets_count_param = parseInt(e.parameter.tweetscount);
  if (!isNaN(tweets_count_param) && tweets_count_param > 0)
    tweets_count = tweets_count_param;

  var tweets = tweetsFor(user, include_replies, tweets_count);
  if (!tweets)
    return ContentService.createTextOutput("Error: no tweets could be parsed!");
  var rss = makeRSS(user, tweets);
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.RSS);
  output.append(rss);
  return output;
}

function tweetsFor(user, include_replies, tweets_count) {
  var with_replies = '';
  if (include_replies)
    with_replies = 'with_replies';
  var parsedText;
  var yql = "http://query.yahooapis.com/v1/public/yql?q=SELECT%20*%20FROM%20html%20WHERE%20url%3D%22https%3A%2F%2Ftwitter.com%2F"
          + user
          + "%2F"
          + with_replies
          + "?count="
          + tweets_count
          + "%22%20AND%20xpath%3D%22%2F%2Fdiv%5Bcontains(%40class%2C'js-stream-item')%5D%22&format=json"

  var options = {
    "method": "get"
  };
  var result = UrlFetchApp.fetch(yql, options);
  if (result.getResponseCode() != 200) {
    Logger.log("Problems running query" + result.getResponseCode());
    return;
  }
  var data = JSON.parse(result.getContentText());
  if (null == data.query.results) {
    Logger.log("Couldn't retrieve anything from Twitter for " + user);
    return;
  }
  var tweets = extractTweets(data.query.results, tweets_count);
  return tweets;
}

function makeHTML(user, tweets) {
  html = "<h2>Twitter feed for " + user + "</h2>\n" + "<ul>";
  for (i = 0; i < tweets.length; i++) {
    t = tweets[i];
    if (!t)
      continue;
    html += "\n\t<li>\n\t\t<blockquote>" + t.tweetHTML + "</blockquote>\n\t\t<p>Posted: " + t.tweetDate
            + ' by <a href="' + t.authorTwitterURL + '">' + t.authorTwitterName + ' (' + t.authorFullName
            + ')</a> | <a href="' + t.tweetURL + '">Original Tweet</a>\n\t</li>\n'
  }
  return html + "</ul>"
}

function makeRSS(user, tweets) {
  rss = '<?xml version="1.0" encoding="UTF-8"?>'
          + "\n\n"
          + '<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:georss="http://www.georss.org/georss" xmlns:twitter="http://api.twitter.com" version="2.0">'
          + "\n"
          + "<channel>\n\t<title>Twitter Search / "
          + user
          + "</title>\n\t<link>http://twitter.com/"
          + user
          + "</link>\n\t<description>Twitter feed for: "
          + user
          + ". Generated by scripts from TwitRSS.me/JS</description>\n\t<language>en-us</language>\n\t<ttl>40</ttl>\n\n"
          + "<image>\n\t<link>http://twitter.com/" + user
          + "</link>\n\t<url>http://abs.twimg.com/favicons/favicon.ico</url>\n\t" + "<title>Twitter</title>\n"
          + "</image>\n";
  for (i = 0; i < tweets.length; i++) {
    t = tweets[i];
    if (!t)
      continue;
    rss += "<item>\n\t<title><![CDATA["
    // Note: removed as no need for the author name to appear in the title.
    // There is the author field for that!
    // + t.authorTwitterName
    // + ' '
    + t.tweetHTML + "]]></title>\n\t<author><![CDATA[" + t.authorFullName + "]]></author>\n\t<description><![CDATA["
            + t.tweetHTML + "]]></description>\n\t<pubDate>" + t.tweetDate + "</pubDate>\n\t<guid>" + t.tweetURL
            + "</guid>\n\t<link>" + t.tweetURL + "</link>\n\t<twitter:source />\n\t<twitter:place />\n</item>\n";
  }
  rss += "</channel>\n</rss>";
  return rss;
}

function extractTweets(tweets, max) {
  var toReturn = [];
  for (i = 0; i < max; i++) {
    if (tweets.div[i]) {
      var tweet = tweets.div[i].div;
      var header = tweet.div[0];
      var body = tweet.div[1];
      var metadiv;
      var rt;
      if (!header)
        continue; // no tweet but probably a list of followers
      if (header.div.a) { // we have a normal tweet
        metadiv = header.div;
        rt = 0;
      } else { // its a re-tweet
        metadiv = header.div[1];
        rt = 1;
      }
      var authorFullName = metadiv.a.span.b.content;
      var authorTwitterName = '@' + metadiv.a.span.span.content.replace(/\s+/, '');
      var authorTwitterURL = "https://twitter.com" + metadiv.a.href;
      var tweetURL = "https://twitter.com" + metadiv.span[1].a.href;
      var tweetDate = '';
      if (metadiv.span[1].a.span[0]) {
        tweetDate = new Date(parseInt(metadiv.span[1].a.span[0]["data-time"]) * 1000).toUTCString();
      } else {
        tweetDate = new Date(parseInt(metadiv.span[1].a.span["data-time"]) * 1000).toUTCString();
      }

      var tweetHTML = '';
      if (body.p.content) {
        tweetHTML = body.p.content;
      } else if (body.p[1] && body.p[1].content) {
        // newer style commented re-tweet (should look for
        // class=="ProfileTweet-text js-tweet-text u-dir")
        tweetHTML = body.p[1].content;
      }

      var tweetLinks = body.p.a;
      if (tweetLinks) {
        for (j = 0; j < tweetLinks.length; j++) {
          var link = '<a href="#">UNDEFINED LINK TYPE!</a> ';
          if (tweetLinks[j].class == "twitter-timeline-link") {
            link = '<a href="' + tweetLinks[j].title + '">' + tweetLinks[j].title + '</a> ';
          } else if (tweetLinks[j].class.indexOf('twitter-hashtag') > -1) {
            link = '<a href="https://twitter.com/' + tweetLinks[j].href + '">#' + tweetLinks[j].b + '</a> ';
          } else if (tweetLinks[j].class.indexOf('twitter-atreply') > -1) {
            link = '<a href="https://twitter.com' + tweetLinks[j].href + '">@' + tweetLinks[j].b + '</a> ';
          }
          // TODO: two whitespaces is not always working. But do not know of a
          // better heuristic where to insert the tweets.
          tweetHTML = tweetHTML.replace(/\s{2}/, link);
        }
      }
      toReturn[i] = {
        'authorFullName': authorFullName,
        'authorTwitterName': authorTwitterName,
        'authorTwitterURL': authorTwitterURL,
        'tweetURL': tweetURL,
        'tweetDate': tweetDate,
        'tweetHTML': tweetHTML,
        'tweetLinks': tweetLinks
      }
    }
  }
  return toReturn;
}

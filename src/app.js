const express = require('express');
require('dotenv').load();
var cors = require('cors')
var SpotifyWebApi = require('spotify-web-api-node');

const app = express();
app.set('port', process.env.PORT || 8888);
const port = process.env.PORT || 8888; 
const party_id = makeid();
var playlist_id = "7MkrOB6DfoDsLmwETqnXL4";
// var spotifyAuth = false;
var playlistObj = [];
var accessToken;

var corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.use(cors(corsOptions))

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";  
  for (var i = 0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

function handleErrors(response) {
  if (!response.ok) {
      response.json().then(res => console.dir(res));
      throw Error(response.statusText);
  }
  return response;
}

const client_id = process.env.CLIENT_ID; // Your client id
const client_secret = process.env.CLIENT_SECRET; // Your secret
const redirect_uri = process.env.REDIRECT_URI; // Your redirect uri

const scopes = ['user-read-private', 'user-read-email','playlist-modify-public', 'playlist-modify-private'];
const showDialog = false;

var spotifyApi = new SpotifyWebApi({
  clientId : client_id,
  clientSecret : client_secret,
  redirectUri : redirect_uri
});


// app.get('/logout' , function(req,res,next) {
//   spotifyApi.resetAccessToken();
//   spotifyApi.resetRefreshToken();
//   code = '';
//   spotifyAuth = false;
//   res.send('Thanks for using CrowdBeats ');
// });

app.get('/', function(req, res) {

  if(playlistObj.length === 0){
    res.redirect('/begin');
  }
  else{
  res.redirect('/party_id');
  }
});
app.get('/begin', function(req, res) {
  var authorizeURL = spotifyApi.createAuthorizeURL(scopes, null, showDialog);
  res.redirect(authorizeURL);
});

app.get('/access', function(req, res, next) {
    const code = req.query.code;
    spotifyApi.authorizationCodeGrant(code)
    .then(function(data) {
      accessToken = data.body.access_token
      // spotifyAuth = true;
      res.redirect('/party_id');
    }, function(err) {
      console.log('Something went wrong when retrieving the access token!', err);
      next(err)
    })
}) 

app.get('/party_id', function(req, res, next) {
  res.send("Your party code is "+party_id);
})

app.get('/newguest', function(req, res, next){
  if(req.query.party_id === party_id){
    res.send({"success" : true})
  }
  else{
    res.send({"success" : false});
  }
})

app.get('/profile', function(req, res, next) {
  spotifyApi.setAccessToken(accessToken);
  spotifyApi.getMe()
  .then(function(data) {
    res.send(data.body);
  }, function(err) {
    console.error(err);
    next(err)
  });
}) 

app.get('/search', function(req, res, next) {
  spotifyApi.setAccessToken(accessToken);
  var searchObj = [];
  if(req.query.party_id == party_id){
  const search = req.query.search;
  spotifyApi.searchTracks(search)
  .then(function(data) {
    for(var i = 0; i< data.body.tracks.items.length; ++i){
      const item = data.body.tracks.items[i];
      searchObj.push({id:item.id, name: item.name, artist: item.artists[0].name})
    }
    res.send(searchObj);
  }, function(err) {
    console.error(err);
  });
}
else{
  res.send("Party ID Incorrect/Missing");
}
})

app.get('/setplaylist', function(req, res, next){
playlist_id = req.query.id;
res.redirect('/playlist');
});

app.get('/playlist', function(req, res, next) {
  spotifyApi.setAccessToken(accessToken);
  playlistObj = [];
  spotifyApi.getPlaylist(playlist_id)
  .then(function(data) {
    for(var i = 0; i< data.body.tracks.items.length; ++i){
        const item = data.body.tracks.items[i].track;
        playlistObj.push({id:item.id, name: item.name, artist: item.artists[0].name, votes: 1})
      }
      res.send(playlistObj);
    }, function(err) {
    console.log('Something went wrong!', err);
  });
})


app.get('/addsong', function(req, res, next) {
  spotifyApi.setAccessToken(accessToken);
  var addtracks = ["spotify:track:"+req.query.id];
  spotifyApi.addTracksToPlaylist(playlist_id, addtracks)
  .then(function(data) {
    res.send({"success" : true , "id" : req.query.id});
  }, function(err) {
    console.log('Something went wrong!', err);
  });
})

app.get('/vote', function(req, res, next) {
  const oldPlayList = playlistObj.slice();
  for( var i = 0; i< playlistObj.length; ++i){
     if(playlistObj[i].id === req.query.id){
       var objectToUpdate = playlistObj[i];
       objectToUpdate.votes += 1;
       playlistObj[i] = objectToUpdate;
     }
   }
   playlistObj.sort(function(a,b){return b.votes - a.votes})
   
   for(var i = 0; i< oldPlayList.length; ++i){
     for(var j = 0; j < playlistObj.length; ++j){
      if(playlistObj[j].id == oldPlayList[i].id){
        if(!(i===j)){
          reorder(i, j);
          break;
        }
      }
   }
  }
  res.send(playlistObj);
})

function reorder(initial, final){
spotifyApi.setAccessToken(accessToken);
var options = { "range_start":0,"range_length" : playlistObj.length };
spotifyApi.reorderTracksInPlaylist(playlist_id, initial, final, options)
  .then(function(data) {
    console.log('Tracks reordered in playlist!', data);
  }, function(err) {
    console.log('Something went wrong!', err);
  });
}

app.listen(port, () => console.log(`CrowdBeats listening on port ${port}!`))
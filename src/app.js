const express = require('express');
require('dotenv').load();
var cors = require('cors')
var SpotifyWebApi = require('spotify-web-api-node');

const app = express();
app.set('port', process.env.PORT || 8888);
const port = process.env.PORT || 8888;
var party_id = makeid();
var playlist_id = "";
var spotifyAuth = false;
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

const scopes = ['user-read-private', 'user-read-email', 'playlist-modify-public', 'playlist-modify-private'];
const showDialog = false;

var spotifyApi = new SpotifyWebApi({
  clientId: client_id,
  clientSecret: client_secret,
  redirectUri: redirect_uri
})




app.get('/', function (req, res) {
  if (playlistObj.length === 0) {
    res.redirect('/login');
  }
  else {
    res.redirect('/party_id');
  }
})



// Step 1 of Authorization Code Flow
// DO NOT MODIFY
app.get('/login', function (req, res) {
  var authorizeURL = spotifyApi.createAuthorizeURL(scopes, null, showDialog);
  res.redirect(authorizeURL);
})

// Step 2 of Authorization Code Flow, sets spotifyAuth to TRUE.
// DO NOT MODIFY
app.get('/access', function (req, res, next) {
  const code = req.query.code;
  spotifyApi.authorizationCodeGrant(code)
    .then(function (data) {
      accessToken = data.body.access_token
      spotifyAuth = true;
      res.redirect(process.env.SETUP_URL);
    }, function (err) {
      console.log('Something went wrong when retrieving the access token!', err);
      next(err)
    })
})

// Returns true if server has logged into Spotify
app.get('/authstatus', function (req, res, next) {
  if (spotifyAuth) {
    res.send({ "auth_status": true });
  }
  else {
    res.send({ "auth_status": false });
  }
})

// Endpoint hit by setup to logout and clear session
app.get('/logout', function (req, res, next) {
  spotifyApi.resetAccessToken();
  spotifyApi.resetRefreshToken();
  code = ''; // clears auth code
  party_id = makeid(); // clears party id
  accessToken = ''; // clears stored access token
  playlistObj = []; // clears loaded playlist object
  playlist_id = ''; // clears loaded playlist ID
  spotifyAuth = false;
  res.redirect(process.env.SETUP_URL);
})

// when provided a playlist_id (that belongs to logged in user), loads playlist into playlistObj
// TODO : create corresponding vote map for tracks
// function populatePlaylist(playlist_id, playlistObj) {
//   playlistObj = []; //clears any existing playlist data
//   spotifyApi.setAccessToken(accessToken);
//   spotifyApi.getPlaylist(playlist_id)
//     .then(function (data) {
//       for (var i = 0; i < data.body.tracks.items.length; ++i) {
//         const item = data.body.tracks.items[i].track;
//         playlistObj.push({ id: item.id, name: item.name, artist: item.artists[0].name, votes: 1 }) // initializes with 1 vote
//       }
//     }, function (err) {
//       console.log(' #### populatePlaylist failed for' + playlist_id, err);
//     });
// }

// Endpoing hit by setup to specify playlist to load into party
// TODO : Error Handling for Playlist Setting
app.get('/setplaylist', function (req, res, next) {
  if (spotifyAuth) {
    playlist_id = req.query.id;
    playlistObj = []; //clears any existing playlist data
    spotifyApi.setAccessToken(accessToken);
    spotifyApi.getPlaylist(playlist_id)
      .then(function (data) {
        for (var i = 0; i < data.body.tracks.items.length; ++i) {
          var item = data.body.tracks.items[i].track;
          playlistObj.push({ id: item.id, name: item.name, artist: item.artists[0].name, votes: 1 }) // initializes with 1 vote
        }
        res.send(playlistObj);
      }, function (err) {
        console.log(' #### populatePlaylist failed for' + playlist_id, err);
      });
  }
  else {
    res.send({ "playlist_id": "You're not logged in" });
  }
})

app.get('/party_id', function (req, res, next) {
  if (spotifyAuth && !playlistObj.length == 0) {
    res.send({ "party_id": party_id });
  }
  else {
    res.send({ "party_id": "Please enter playlist above" });
  }
})

// Gets Profile info of logged-in user
// To be used in setup dashboard
app.get('/profile', function (req, res, next) {
  spotifyApi.setAccessToken(accessToken);
  spotifyApi.getMe()
    .then(function (data) {
      res.send(data.body);
    }, function (err) {
      console.error(err);
      next(err);
    });
})

//*****************************************************************
// Endpoints for Guest Client
// Do not access using a browser
//*****************************************************************

app.get('/newguest', function (req, res, next) {
  if (req.query.party_id === party_id) {
    res.send({ "success": true })
  }
  else {
    res.send({ "success": false });
  }
})

app.get('/search', function (req, res, next) {
  spotifyApi.setAccessToken(accessToken);
  var searchObj = [];
  if (req.query.party_id == party_id) {
    const search = req.query.search;
    spotifyApi.searchTracks(search)
      .then(function (data) {
        for (var i = 0; i < data.body.tracks.items.length; ++i) {
          const item = data.body.tracks.items[i];
          searchObj.push({ id: item.id, name: item.name, artist: item.artists[0].name })
        }
        res.send(searchObj);
      }, function (err) {
        console.error(err);
      });
  }
  else {
    res.send("Party ID Incorrect/Missing");
  }
})

app.get('/playlist', function (req, res, next) {
  playlistObj = []; //clears any existing playlist data
  spotifyApi.setAccessToken(accessToken);
  spotifyApi.getPlaylist(playlist_id)
    .then(function (data) {
      for (var i = 0; i < data.body.tracks.items.length; ++i) {
        const item = data.body.tracks.items[i].track;
        playlistObj.push({ id: item.id, name: item.name, artist: item.artists[0].name, votes: 1 }) // initializes with 1 vote
      }
      res.send(playlistObj);
    }, function (err) {
      console.log(' #### populatePlaylist failed for' + playlist_id, err);
    });
})

app.get('/addsong', function (req, res, next) {
  spotifyApi.setAccessToken(accessToken);
  var addtracks = ["spotify:track:" + req.query.id];
  spotifyApi.addTracksToPlaylist(playlist_id, addtracks)
    .then(function (data) {
      res.send({ "success": true, "id": req.query.id });
    }, function (err) {
      console.log('Something went wrong!', err);
    });
})

app.get('/vote', function (req, res, next) {
  const oldPlayList = playlistObj.slice();
  for (var i = 0; i < playlistObj.length; ++i) {
    if (playlistObj[i].id === req.query.id) {
      var objectToUpdate = playlistObj[i];
      objectToUpdate.votes += 1;
      playlistObj[i] = objectToUpdate;
    }
  }
  playlistObj.sort(function (a, b) { return b.votes - a.votes })

  for (var i = 0; i < oldPlayList.length; ++i) {
    for (var j = 0; j < playlistObj.length; ++j) {
      if (playlistObj[j].id == oldPlayList[i].id) {
        if (!(i === j)) {
          reorder(i, j);
          break;
        }
      }
    }
  }
  res.send(playlistObj);
})

function reorder(initial, final) {
  spotifyApi.setAccessToken(accessToken);
  var options = { "range_start": 0, "range_length": playlistObj.length };
  spotifyApi.reorderTracksInPlaylist(playlist_id, initial, final, options)
    .then(function (data) {
      console.log('Tracks reordered in playlist!', data);
    }, function (err) {
      console.log('Something went wrong!', err);
    });
}

app.listen(port, () => console.log(`CrowdBeats listening on port ${port}!`))
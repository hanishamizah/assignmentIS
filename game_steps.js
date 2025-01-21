
const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const {verifyhash} = require('./auth.js');
const { ObjectId } = require('mongodb');

const config = require('./config.json');

const {uri} = require('./index.js')

const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

const app = express();      // this need copy-paste to all files
app.use(express.json()) 

// Define the game loop
function playGame() {
  while (true) {
    // Display the current state of the board
    console.log(board.map(row => row.join(' ')).join('\n'));

    // Get the user's move
    let row, col;
    do {
      row = parseInt(prompt(`Player ${currentPlayer}, enter the row (0-2):`));
      col = parseInt(prompt(`Player ${currentPlayer}, enter the column (0-2):`));
    } while (!makeMove(row, col));

    // Check if the game has been won or tied
    const winner = checkWin();
    if (winner === PLAYER_X) {
      console.log('Player X wins!');
      break;
    } else if (winner === PLAYER_O) {
      console.log('Player O wins!');
      break;
    } else if (winner === 'tie') {
      console.log('The game is a tie!');
      break;
    }
  }
}


//Game lobby
app.post("/lobby", verifyhash, async (req, res) => {

    if(!res.locals.success) {
        if(typeof res.locals.output !== 'undefined') {
            res.send(res.locals.output);
            return
        }
        else {
            res.send("Unknown error occured.");
            return
        }
    }

    _id = new ObjectId(res.locals.output.id);

    let result1 = await client.db("general").collection("lobby").findOne({
        $or:[{player1_id: _id} , {player2_id: _id}]
    })
    if(result1===null) {
        let result = await client.db("general").collection("lobby").insertOne({
        player1_id : _id,
        player2_id : null,
        progress : 0
    });
    res.send({"Lobby Id: " : result.insertedId, "Status: " : "You are now in a lobby."})
    }
    else{
        res.send("You are already in a lobby " + result1._id + ".")
    }
    
})


app.post("/joinlobby", verifyhash, async(req, res) => {
    
    if(!res.locals.success) {
        if(typeof res.locals.output !== 'undefined') {
            res.send(res.locals.output);
            return
        }
        else {
            res.send("Unknown error occured.");
            return
        }
    }

    roomid = new ObjectId(req.body.roomid);
    _id = new ObjectId(res.locals.output.id);


    let result1 = await client.db("general").collection("lobby").findOne({          // Check if user is already in a lobby
        $or:[{player1_id: _id} , {player2_id: _id}]
    })

    let result2 = await client.db("general").collection("lobby").findOne({          // Check if lobby is full
         _id: roomid 
    })

    if(result1 === null) {
        if(result2 === null) {
            res.send("Room not found.")
            return
        }
        if (result2.player2_id === null) {
        let result = await client.db("general").collection("lobby").updateOne(
            {_id:   roomid}, {$set: {player2_id: _id}}
        );
        res.send({"Status: " : "You have joined the lobby."});
        }
        else {
            res.send("The lobby is already full.");
        }
    } 
    else 
    {                                                    // if the user is not in a lobby
        res.send("You are already in a lobby " + result1._id + ".")
    }

})

app.get("/getlobby", verifyhash, async(req, res) => {
     if(!res.locals.success) {
        if(typeof res.locals.output !== 'undefined') {
            res.send(res.locals.output);
            return
        }
        else {
            res.send("Unknown error occured.");
            return
        }
    }

     _id = new ObjectId(res.locals.output.id);

    let result1 = await client.db("general").collection("lobby").findOne({          // Check if user is already in a lobby
        $or:[{player1_id: _id} , {player2_id: _id}]
    })
    if(result1) {   //If so, lets give the id of the lobby
        res.send("You are in lobby with id: " + result1._id + ".")
    }
    else {  //Otherwise, say not.
        res.send("You are not in any lobby.")
    }
})

app.delete("/leavelobby", async(req, res) => {              // When the games end, the lobby will be deleted
    roomid = new ObjectId(req.body.roomid);
    let result_find = await client.db("general").collection("lobby").findOne( {$and: [{$or: [{ progress: 1},{player2_id : null}]}, {_id: roomid}]}); 
    console.log(result_find);
    if(result_find){
        let result = await client.db("general").collection("lobby").deleteOne( {_id: roomid})
        console.log(result);
        if(result.deletedCount === 1) {
            res.send("You have successfully left the lobby.");
            console.log(result);
        }
        else {
            res.send("Error occured during leaving lobby.");
        }
    }

    else{
        res.send("Hold on, the game is still in progress.");
    }
})

app.patch("/endgame", async(req, res) => {
    roomid = new ObjectId(req.body.roomid);
    let result_find = await client.db("general").collection("lobby").findOne({_id: roomid});
    if(result_find){
        if(result_find.player2_id === null){
            res.send("The lobby isn't full, direct end the game by leaving the lobby.")
        }

        else{
            let result = await client.db("general").collection("lobby").updateOne({_id: roomid}, {$set: {progress: 1}});
            res.send("Game "+ roomid + "has been ended.");
        }

    }
    else{
        res.send("Game not found.");
    }
})

// // Define the initial state of the board
// app.post("/init", async (req, res) => {
//     roomid = new ObjectId(req.body.roomid);
//     let result_find = await client.db("general").collection("lobby").findOne({_id: roomid})
//     console.log(result_find)
//     if(!result_find) {
//         res.send("Room not found. Unable to initialize game.")
//         return
//     }
//     else{
//         let result = await client.db("general").collection("gamedata").insertOne({
//             _roomid: roomid,
//             });
//         res.send({"Status: " : "Game has been initialized."});
//         console.log(result);
//     }

// })









// Start the game
app.post("/play", async(req, res) => { 
    res.json(board);
    playGame();
    res.json(board);
})

module.exports = app;

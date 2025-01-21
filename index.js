//Main index file, handles files.

//Dependencies
const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');

//Things, main variables, etc.
const app = express();
const parse = require('./paramparse.js')

port = parse.getport()
const credentials = 'x509.pem'

app.set('trust proxy', '127.0.0.1'); //Trust yourself, perhaps.

//Other files
const auth = require("./auth.js")
const admin = require("./adminauth.js")
const fortune = require("./fortune.js")
//const gamestep = require("./game_steps.js")
// const gamestart = require("./gamelogic.js")

app.use(express.json())

/*
const client = new MongoClient(uri, {
   serverApi: {
     version: ServerApiVersion.v1,
     tlsCertificateKeyFile: credentials,
     strict: true,
     deprecationErrors: true,
   }
 });
*/

app.listen(port, () => {
   console.log(`Main file OK, listening on port ${port}`)
})

app.use("/auth", auth.app) //Authentication Code.
app.use("/admin", admin.app) //Admin Code
app.use("/fortune", fortune.app) //Fortune Cookies!
//app.use("/game",  gamestep)
// app.use("/game1", gamestart)

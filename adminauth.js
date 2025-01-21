const express = require('express');
const { MongoClient, ServerApiVersion} = require('mongodb');
//const config = require('./config.json'); superseeded by env
const bcrypt = require('bcrypt');
var QRCode = require('qrcode');
const {TOTPGenA, TOTPKeyGen} = require('./totp.js');

const {verifyhash, authencheck, admincheck, LOWFPS, timepenalty, timepenaltycheckA, admin} = require('./shared.js');
const parse = require('./paramparse.js')

const app = express();
//const {uri, secret, saltrounds, master} = require('./index.js')
uri = parse.geturi()
//secret = parse.getsecret()
saltrounds = parse.getrounds()
master = parse.getmpass()

const { rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
	windowMs: 12 * 60 * 1000, // 12 minutes
	limit: 100, // Limit each IP to 75requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    message: "IP Address request overloaded, try again later."
	// store: ... , // Redis, Memcached, etc. See below.
})

//const master = config.masterpass //Please pretend this is encrypted, might forget if it is really encrypted.

const credentials = 'x509.pem'
const client = new MongoClient(uri, {
  tlsCertificateKeyFile: credentials,
  serverApi: ServerApiVersion.v1
});


app.use(express.json())
app.use(limiter)

app.get("/", async(req, res) => {
    res.send("Admin Interface root, UI unavailable, use postman, thanks.");
})

app.post("/register", async (req, res) => {
    if(!(req.body.password && req.body.name && req.body.masterpassword)) {
        res.send("Name and password required for registering a admin, and Master Password.");
        return;
    }

    if(req.body.masterpassword != master) {
        res.send("Invalid Authorization.")
        return
    }

   let namecheck = await client.db("general").collection("Admins").findOne({
        name: req.body.name
    })

    if(namecheck) {
        res.send("Admin username already taken.");
        return;
    }

    const hash = bcrypt.hashSync(req.body.password, saltrounds);

    key = TOTPKeyGen()

    let regresult = await client.db("general").collection("Admins").insertOne({
        name: req.body.name,
        password: hash,
        TOTPKey: key.base32
    });

    if(regresult) {
        QRCode.toDataURL(key.otpauth_url, function(err, data_url) {
        res.send('<img src="' + data_url + '">' + '<b>' + key.base32 + '</b>')

        // Display this data URL to the user in an <img> tag
        // Example:
        });
    }
    else {
        console.log ("[ERR] Registeration failed unexpectedly")
        res.send("Something failed...?")
    }
})

app.post("/login", limiter, timepenaltycheckA, admin, TOTPGenA,timepenalty, LOWFPS, (req, res) => {
    /*
    if(!(req.body.password && req.body.name)) {
        res.send("Please login with password (pass) and admin name (name)");
        return;
    }
    const token = await authencheck(req.body.name, req.body.password, "30m", "Admins");
    if(!token) {
        //await delay(3000 + Math.random()*5000)
        res.send("Authentication failure, check your info.");
        return;
    }
    nonsense = "Welcome admin.";
    */
    //res.send({"Token":token, "Auth":"Success"});
    if(res.locals.success == false) {
        if(res.locals.otp == false) {
            res.send("OTP failed, please try again.") //This shouldn't call unless the whole thing gone through.'
            return;
        }
        if(res.locals.output){
            res.send(res.locals.output)
            return;
        }
        else {
            res.send("Invalid Authenication, please try again.") //This shouldn't call unless the whole thing gone through.'
            return;
        }
    }
    res.send("Login successful!\n" + "Token:" + res.locals.token)
    return;
})

app.delete('/eraseuser', verifyhash, admincheck, async (req, res) => {
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

    if(!req.body.name) {
        res.send("Insert the target name!")
        return;
    }

    let result = await client.db("general").collection("Users").findOne({
        name: req.body.name
    })

    if(!result) {
        res.send("Name does not match any user.")
        return
    }

    let delresult = await client.db("general").collection("Users").deleteOne({
        name: req.body.name
    })
    res.send({"Status": delresult, "Message": "User has been deleted."})
    console.log(delresult)
})


app.delete('/eraseself', verifyhash, admincheck, async (req, res) => {
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

    let result = await client.db("general").collection("Admins").findOne({
        name: res.locals.output.name
    })

    if(!result) {
        res.send("ID does not match any user.")
        return
    }

    let delresult = await client.db("general").collection("Admins").deleteOne({
        name: res.locals.output.name
    })
    res.send({"Status": delresult, "Message": "Self Destructed."})
    console.log(delresult)
})


app.delete('/eraseadmin', async (req, res) => {
    if(!req.body.name) {
        res.send("Admin name required to delete target.")
        return;
    }
    if(!req.body.masterpassword) {
        res.send("Show your sign of authority.")
        return;
    }

    if(req.body.masterpassword != master) {
        res.send("Masterpassword invalid!")
        return;
    }

    let result = await client.db("general").collection("Admins").findOne({
        name: req.body.name
    })

    if(!result) {
        res.send("No result found.")
        return
    }

    let delresult = await client.db("general").collection("Admins").deleteOne({
        name: req.body.name
    })
    res.send({"Status": delresult, "Message": "Admin dismissed"})
    console.log(delresult)
})

app.get('/adminlist', async (req, res) => {
    if(!req.body.masterpassword) {
        res.send("Show your sign of authority.")
        return;
    }

    if(req.body.masterpassword != master) {
        res.send("Masterpassword invalid!")
        return;
    }

    client.db("general").collection('Admins').find().toArray().then(result => res.send(result))
})

app.get('/userlistad', verifyhash, admincheck, async (req, res) => { //Admin Variant
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

    client.db("general").collection('Users').find({}).project({name:1, email:1, TOTPKey:1}).toArray().then(result => res.send(result))  //TOTPKey Left allowed to allow admin to help users. OH A SNAKE!
})


app.post('/userlist', async (req, res) => { //Not intended to be used.
    if(!req.body.masterpassword) {
        res.send("Show your sign of authority.")
        return;
    }

    if(req.body.masterpassword != master) {
        res.send("Masterpassword invalid!")
        return;
    }
    client.db("general").collection('Users').find({}).project({name:1, email:1, TOTPKey:1}).toArray().then(result => res.send(result))  //TOTPKey Left allowed to allow admin to help users. OH A SNAKE!
})

module.exports = {app}

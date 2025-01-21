const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
//const config = require('./config.json');
const bcrypt = require('bcrypt');
const parse = require('./paramparse.js')
const {verifyhash, usercheck, user, LOWFPS, timepenalty, timepenaltycheckU} = require('./shared.js');
const {TOTPGenU, TOTPKeyGen, TOTPCheck} = require('./totp.js');
var QRCode = require('qrcode');

const app = express();

uri = parse.geturi()

const credentials = 'x509.pem'
const client = new MongoClient(uri, {
  tlsCertificateKeyFile: credentials,
  serverApi: ServerApiVersion.v1
});

const { rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 5 minutes
	limit: 5, // Limit each IP to 75requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    message: "IP Address request overloaded, try again later."
	// store: ... , // Redis, Memcached, etc. See below.
})

app.use(express.json())
app.use(limiter)

app.get("/", async(req, res) => {
    res.send("Authentication control root, use postman for features.");
})

app.post("/register", async (req, res) => {


    if(!(req.body.name && req.body.email && req.body.password)) {
        res.send("Username, E-mail, and password required as 'username' , 'email', and 'password' respectively!");
        return;
    }

    let namecheck = await client.db("general").collection("Users").findOne({
        name: req.body.name
    })
    if(namecheck) {
        res.send("Sorry, username occupied, use another.");
        return;
    }
    let emailcheck = await client.db("general").collection("Users").findOne({
        email: req.body.email
    })
    if(emailcheck) {
        res.send("Your e-mail has been registered to a account.");
        return;
    }
    //Async implementation, can't continue.
    /*
    bcrypt.hash(req.body.password, saltrounds, function(err, hash) {
        let regresult = await client.db("general").collection("Users").insertOne({
            user: req.body.user,
            name: req.body.name,
            email: req.body.email,
            password: hash
        });
        if(regresult) {
            console.log(regresult);
            res.send(regresult);
        }
        else {
            console.log ("[ERR] Registeration failed unexpectedly");
            res.send("???");
        }
    });
    */
    //Sync implementation of bcrypt, because I have no idea otherwise.
    const hash = bcrypt.hashSync(req.body.password, saltrounds);

    key = TOTPKeyGen()

    let regresult = await client.db("general").collection("Users").insertOne({
        name: req.body.name,
        email: req.body.email,
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
        res.send("???")
    }
})

app.post("/login", timepenaltycheckU, user, TOTPGenU, timepenalty, LOWFPS ,async(req, res) => {
    /*
    const token = await authencheck(req.body.name, req.body.password,"15m", "Users")
    if(!token) {
        //await delay(3000 + Math.random()*7000)
        res.send("Authentication failure, check your info.");
        return;
    }
    nonsense = "Welcome user " + req.body.name; //I would use MOTD at this point, but that is unneccessary
    res.send({"Token":token, "Auth":"Success"});
    */
    //Unhealthy as hell.
    if(res.locals.success == false) {
        if(res.locals.output){
            if(res.locals.placeholder) {
            res.send(res.locals.output)
            return;
            }
        }
        if(res.locals.otp == false) {
            res.send("OTP failed, please try again.") //This shouldn't call unless the whole thing gone through.'
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

//Parameters: password (in body) and id in params
app.patch("/changepass", verifyhash, usercheck, async(req, res) => {
    if(!res.locals.success) {   //JWT check failed ?
        if(typeof res.locals.output !== 'undefined') {
            res.send(res.locals.output);
            return
        }
        else {
            res.send("Unknown error occured.");
            return
        }
    }
    if(!req.body.password) {    //Check if Password is provided, if not, stop.
        res.send("Input new password!")
        return
    }
    let result = await client.db("general").collection("Users").findOne({
        name: res.locals.output.name
    })

    if(!result) {
        res.send("Name does not match any user, did you delete account ?")  //I should be diasbling the token too, but... nah.
        return
    }

    pass = toString(req.body.password)
    const hash = bcrypt.hashSync(pass, saltrounds); //I somehow forgot to hash it first!
    let patchresult = await client.db("general").collection("Users").updateOne(
    //    {_id: _id}, {$set: {password: req.body.password}}
        {name: res.locals.output.name}, {$set: {password: hash}}
    )
    res.send(patchresult)
    console.log(patchresult)
})

//Same as changepasssword, with email instead
app.patch("/changeemail", verifyhash, usercheck, async(req, res) => {
    if(!req.body.email) {
        res.send("Input new email!")
        return
    }
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

    let result = await client.db("general").collection("Users").findOne({
        name: res.locals.output.name
    })

    if(!result) {
        res.send("ID not matching any user, did you delete account ?")
        return
    }

    let emailresult = await client.db("general").collection("Users").findOne({
        email: req.body.email
    })

    if(emailresult) {
        res.send("New email already occupied.")
        return
    }

    let patchresult = await client.db("general").collection("Users").updateOne(
        {name: res.locals.output.name}, {$set: {email: req.body.email}}
    )
    res.send(patchresult)
    console.log(patchresult)
})

//Erases the whole account, no double warning.
app.delete('/erase', verifyhash, usercheck, async (req, res) => {
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

    //Check if said user exists.
    let result = await client.db("general").collection("Users").findOne({
        name: res.locals.output.name
    })

    //Gone ?
    if(!result) {
        res.send("Name mismatch, but token exists, perhaps you deleted account already ?")
        return
    }

    //Delete user.
    let delresult = await client.db("general").collection("Users").deleteOne({
        name: res.locals.output.name
    })
    res.send({"Status": delresult, "Message": "Goodbye."})
    console.log(delresult)
})


module.exports = {app};

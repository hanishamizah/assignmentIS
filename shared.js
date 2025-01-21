//This file contains shared functions used by other part of the code!
const { MongoClient, ServerApiVersion} = require('mongodb');

const bcrypt = require('bcrypt');
const parse = require('./paramparse.js')
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs')

const uri = parse.geturi()
var secret = parse.getsecret()
const credentials = 'x509.pem'
const client = new MongoClient(uri, {
  tlsCertificateKeyFile: credentials,
  serverApi: ServerApiVersion.v1
});

async function admin(req,res,next) {
    res.locals.type = "Admins"
    var token
    if(res.locals.success==false) {
        return next() //Something failed before it started.
    }
    if(!req.body.name) {
        res.locals.success = false
        res.locals.output = "Please insert user credentials!"
        return next()
    }
    if(!req.body.password) {
        res.locals.success = false
        res.locals.output = "Please insert user credentials!"
        return next()
    }
    let namecheck = await client.db("general").collection(res.locals.type).findOne({
        name: req.body.name
    })
    if(namecheck) {
        res.locals.exist = true
        token = await authencheck(req.body.name, req.body.password, namecheck.password,"30m", "Admins")
    }
    else {
        token = false
    }
    /*
    if(!token) {
        //await delay(3000 + Math.random()*7000)
        //res.send("Authentication failure, check your info.");
        //return;
        res.locals.success = false;
        res.locals.token = "Authorization failed, please try again later after 3 minutes and check your credentials."
        return next()
    }
    else {
    //nonsense = "Welcome user " + req.body.name; //I would use MOTD at this point, but that is unneccessary
    //res.send({"Token":token, "Auth":"Success"});
        res.locals.token = token
        res.locals.success = true;
        return next()
    }
    */
    res.locals.token = token
    if(!token) res.locals.success = false; else res.locals.success = true;
    return next()
}

async function user(req,res,next) {
    res.locals.type = "Users"
    var token
    if(res.locals.success==false) {
        return next() //Something failed before it started.
    }
    if(!req.body.name) {
        res.locals.success = false
        res.locals.output = "Please insert user credentials!"
        return next()
    }
    if(!req.body.password) {
        res.locals.success = false
        res.locals.output = "Please insert user credentials!"
        return next()
    }
    let namecheck = await client.db("general").collection(res.locals.type).findOne({
        name: req.body.name
    })
    if(namecheck) {
        res.locals.exist = true
        token = await authencheck(req.body.name, req.body.password, namecheck.password,"15m", "Users")
    }
    else {
        token = false
    }
    /*
    if(!token) {
        //await delay(3000 + Math.random()*7000)
        //res.send("Authentication failure, check your info.");
        //return;
        res.locals.success = false;
        res.locals.token = token
        next()
    }
    else {
        res.locals.token = token
        res.locals.success = true;
    //nonsense = "Welcome user " + req.body.name; //I would use MOTD at this point, but that is unneccessary
    //res.send({"Token":token, "Auth":"Success"});
        next()
    }
    */

    res.locals.token = token
    if(!token) {
        res.locals.success = false
    }
    else {
        res.locals.success = true
    };
    return next()
}

async function authencheck(username, password, password2,time, category) {
    token = false;

    secret = parse.getsecret()
    const hashpass = await bcrypt.compare(password, password2);
    if(hashpass) {
        token = jwt.sign({"name":username, "type": category}, secret, {expiresIn:time});
    }
    return token;
}

function LOWFPS (req, res, next) {
    if(!res.locals.success) {//Failed ? Penalty.
        setTimeout(next, 500+Math.random()*1500)
    }
    else {
        return next()
    }
}

async function timepenalty (req, res, next) {
    rapidfire = 0;
    if(!res.locals.placeholder) {   //Placeholder: Check if the user is within timeout
        if(!res.locals.exist) { //Exist: Check if the user exists
            return next() //No timeout if the user does not exist.
        }
    }
    else {
        rapidfire = 1;  //A little bruteforce mark, useful if the accoutnt is being attacked, but eh, implementation ends here.
    }
    if(res.locals.success) {
        if(res.locals.otp) {
            return next()  //Skip this if BOTH success.
        }
    }
    curtime = dayjs();
    nextallow = curtime.add(11, 'seconds');
    nextallow = nextallow.format("YYYY/MM/DD HH:mm:ss");
    let check = await client.db("logtime").collection(res.locals.type).findOne({
        name: req.body.name
    })
    if (!check) {
        let insertpenalty = await client.db("logtime").collection(res.locals.type).insertOne({
            name: req.body.name,
            timeout: nextallow
        })
        return next()
    }
    else {
        let updatepenalty = await client.db("logtime").collection(res.locals.type).updateOne(
            {name:req.body.name},{$set: {timeout: nextallow}, $inc: {rapidfire: rapidfire}}
        )
        return next()
    }
}

//Split because I have no idea how to get it before the call to check
async function timepenaltycheckU (req,res,next) {
    let check = await client.db("logtime").collection("Users").findOne({
        name: req.body.name
    })
    if(!check) {
        //res.locals.success = true;
        return next() //Does nothing
    }
    else {
        if(dayjs().isBefore(check.timeout)) {
            res.locals.output = "You are still within 10 seconds timeout, please try again later."
            //res.locals.success = false;
            res.locals.placeholder = true;
            return next();
        }
        else {
        //res.locals.success = true;
        return next() //Does nothing
        }
    }
}

//Admins
async function timepenaltycheckA (req,res,next) {
    let check = await client.db("logtime").collection("Admins").findOne({
        name: req.body.name
    })
   if(!check) {
        //res.locals.success = true;
        return next() //Does nothing
    }
    else {
        if(dayjs().isBefore(check.timeout)) {
            res.locals.output = "You are still within 10 seconds timeout, please try again later."
            //res.locals.success = false;
            res.locals.placeholder = true;
            return next();
        }
        else {
        //res.locals.success = true;
        return next() //Does nothing
        }
    }
}

function verifyhash (req,res, next) {
    if(!req.headers.authorization) {
        res.locals.success = false;
        res.locals.output = "Authorization token missing."
        return next();
    }

    TokenArray =req.headers.authorization.split(" ");

    try {
        const output = jwt.verify(TokenArray[1], secret);
        res.locals.output = output
        res.locals.success = true
        next();
    }
    catch(err) {
        res.locals.success = false;
        if(err.name == "TokenExpiredError") {
            res.locals.success = false;
            res.locals.output = "Token is Expired.";
            next();
            }
        else if(err.name == "JsonWebTokenError") {
            res.locals.output = err.message;
            next();
            }
        else {
            res.locals.output = "Generic Unknown Error";
            next();
        }
    }
}

function admincheck (req, res, next) {
    if (res.locals.output.type != "Admins" && res.locals.success==true) {
        res.locals.output = "User is not an Admin";
        res.locals.success = false;
        return next()
    }
    else {
        return next()
    }
}

function usercheck (req, res, next) {
    if (res.locals.output.type != "Users" && res.locals.success==true) {
        res.locals.output = "User is a admin.";
        res.locals.success = false;
        return next()
    }
    else {
        return next()
    }
}

//This is a thing? NO, IT CRASHES AZURE
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {verifyhash, authencheck, admincheck, usercheck, delay, LOWFPS, timepenalty, timepenaltycheckU, timepenaltycheckA, user, admin}

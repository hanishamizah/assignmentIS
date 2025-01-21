//TOTP - Time Based One Time Password Implementation based on TOTP Generator

const { MongoClient, ServerApiVersion } = require('mongodb');

const speakeasy  = require("speakeasy")
const crypto = require('crypto')

//Personal implementation, remove it and replace with something else.
const parse = require('./paramparse.js')
uri = parse.geturi()
//End of specific personal implementation.

const credentials = 'x509.pem'
const client = new MongoClient(uri, {
  tlsCertificateKeyFile: credentials,
  serverApi: ServerApiVersion.v1
});

//Split, once again because I forgot how otherwise.

async function TOTPGenA(req, res, next) {
    if(res.locals.success==false) {
        res.locals.otp = true; //This is stupid.
        return next() //Something failed before it started.
    }
    if(!req.body.otp) {
        res.locals.success = false;
        res.locals.otp = false;
        return next()
    }
    let namecheck = await client.db("general").collection("Admins").findOne({
        name: req.body.name
    })
    if(namecheck) {
        if(namecheck.TOTPKey) { //This should work, and no other situation sohuld occur, rightt ?
            var verified = speakeasy.totp.verify({ secret: namecheck.TOTPKey, encoding: 'base32', token: req.body.otp });
            res.locals.otp = verified
            res.locals.success = verified;
            return next();
        }
    }
    else {
        res.locals.success = false;
        res.locals.otp = false;
        return next();
    }
}

async function TOTPGenU(req, res, next) {
    if(res.locals.success==false) {
        res.locals.otp = true; //This is stupid.
        return next() //Something failed before it started.
    }
    if(!req.body.otp) {
        res.locals.success = false;
        res.locals.otp = false;
        return next()
    }
    let namecheck = await client.db("general").collection("Users").findOne({
        name: req.body.name
    })
    if(namecheck) {
        if(namecheck.TOTPKey) { //This should work, and no other situation sohuld occur, rightt ?
            var verified = speakeasy.totp.verify({ secret: namecheck.TOTPKey, encoding: 'base32', token: req.body.otp });
            res.locals.otp = verified
            res.locals.success = verified;
            return next();
        }
    }
    else {
        res.locals.success = false;
        res.locals.otp = false;
        return next();
    }
}

function TOTPKeyGen() {
    var secret = speakeasy.generateSecret();
    return secret
}

module.exports = {TOTPGenA, TOTPGenU, TOTPKeyGen}

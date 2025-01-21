const config = require('./config.json')
const crypto = require('crypto')
const { MongoClient, ServerApiVersion } = require('mongodb');
const dayjs = require('dayjs')

//Randomly taken code.
var generatePassword = (
  length = 14,
  characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@-#$'
) =>
  Array.from(crypto.getRandomValues(new Uint32Array(length)))
    .map((x) => characters[x % characters.length])
    .join('')


const port = config.port || 5200; //Eh.
const uri = config.db; //Database uri, no default here...

const credentials = 'x509.pem'
const client = new MongoClient(uri, {
  tlsCertificateKeyFile: credentials,
  serverApi: ServerApiVersion.v1
});

secret = config.secret || "secret"; //Secret for Json Web Tokens, random by default once every reboot
//const secret = generatePassword(); //Disabled out of fear.
var secret = "sekret";
const saltrounds = config.saltrounds || 15; //Pew pew, salt rounds for hashing
const master = config.masterpassword || "Quantium"; //Master password for admin.

async function getsecretPLUS() {
    var secret1 = generatePassword()
    var secretnew
    curtime = dayjs();
    nextrefresh = curtime.add(1, 'days');
    thyme = nextrefresh.format("YYYY/MM/DD");
    let secretcheck = await client.db("general").collection("SECRET").findOne({
        PLACEHOLDER: "PLACEHOLDER"
    })
    if(!secretcheck) {
      let secretcheck = await client.db("general").collection("SECRET").insertOne({
        PLACEHOLDER: "PLACEHOLDER",
        secret: secret1,
        time: thyme
      })
      console.log("New secret installed:" + secret1 + "\n" + secretcheck);
      secret = secret1
    }
    else {
      secret = secretcheck.secret
    }
    if(dayjs().isAfter(secretcheck.time)) {   //Refrersh time!
      let secretrefresh = await client.db("general").collection("SECRET").updateOne(
        {PLACEHOLDER: "PLACEHOLDER",},
        {$set:{secret: secret1, time: thyme}}   //Whoops, the bugs.
      )
      console.log("New secret installed:" + secret1 + "\n" + secretrefresh);
      let secretcheck = await client.db("general").collection("SECRET").findOne({
        PLACEHOLDER: "PLACEHOLDER"
      })
      secret = secretcheck.secret
      //This hurts my brain
    }
    return secret
}

function setsecret(tgt) {
  secret = tgt;
}

getsecretPLUS().then(result => {
    setsecret(result)
})

function getport() {
   return port
}

function geturi() {
   return uri
}

function getsecret() {
  return secret
}

/*
function getsecret() {
  return secret
}
*/

function getrounds() {
   return saltrounds
}

function getmpass() {
   return master
}

module.exports =
{getport:getport,
geturi:geturi,
getsecret:getsecret,
getrounds:getrounds,
getmpass:getmpass}

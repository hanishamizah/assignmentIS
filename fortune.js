//Supposedly the fortune cookie system
const express = require('express');
const dayjs = require('dayjs')

const { rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	limit: 75, // Limit each IP to 75requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    message: "Overlimit! Please try again later!"
	// store: ... , // Redis, Memcached, etc. See below.
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const {verifyhash, admincheck} = require('./shared.js');

const parse = require('./paramparse.js')

const uri = parse.geturi()

const credentials = 'x509.pem'
const client = new MongoClient(uri, {
  tlsCertificateKeyFile: credentials,
  serverApi: ServerApiVersion.v1
});

//Remains for init purposes...?
async function getfortunecount() {
    let counter = await client.db("general").collection("counter").findOne({
        object: "counter"
    })

    if(!counter) {
        let result = await client.db("general").collection("counter").insertOne({
            object: "counter",
            valcount: 0
        })
        if(result) {
            console.log('Fortune counter missing, and has been created.')
            return getfortunecount();
        }
        else {
            console.log('Fortune counter missing, and failed to create...?')
            return 0; //I HOPE THIS WON'T OCCUR.'
        }
    }
    else {
        console.log("Current value is: " + counter.valcount)
        return counter.valcount //What the fuck
    }
}

var count

function setcount(count2) {
    count = count2
}

getfortunecount().then(result => {
    setcount(result)
})

//Removed this for being horrid and unusable
//Who the fuck made it const LMAO
//var count = getfortunecount() //This get the fortune count within the system. //Promise{0}

const app = express();
app.use(express.json())
app.use(limiter)

async function updatecount() {
    let result = await client.db("general").collection("counter").updateOne(
        {object: "counter"},
        {$set: {valcount: count}}
    )
    if (!result) {
        console.log("Update Count failed, desync confirmed.")
    }
}

//I would make it daily fortune but... what is the fun of that ?
//User-side, why do it need hash ? I don't know!'
app.get("/", verifyhash, async (req, res) => {
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

    intcount = count

    if (count == 0) {
        res.send("No fortune is in system currently, mind to propose some ?")
        return
    }

    val = Math.ceil(Math.random()*count);
    console.log(val)
    console.log(intcount)
    //This should work.
    let tgt = await client.db("general").collection("fortune").findOne({
        fid: val
    })

    if(tgt) {
        res.send(tgt.fortune) //This sucks.
        return
    }
    //return tgt
    res.send("End of function")
})

//This don't though.

app.get("/viewlist",async (req, res) => {
    client.db("general").collection('fortune').find().toArray().then(result => res.send(result))
})


app.get("/checkcount", async(req, res) =>{
        res.send("Currently there is " + count + " randomized 'fortune' in the database.")
})

//On further thought, let it be so stupidly annoying that you can add however many fortune you want.
app.post("/newfortune", verifyhash, async (req, res) => {
    //Expected to be replaced by two step functions.
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
    console.log(res.locals.output.name)
    commandday = dayjs();
    nextday = commandday.add(1, 'day');
    nextday = nextday.format("YYYY/MM/DD");
    console.log(nextday)
    let userlastuse = await client.db("control").collection(res.locals.output.type).findOne({  //This looks like a noSQL injection point.
        name: res.locals.output.name
    })
    if(!userlastuse) {
        let useruse = await client.db("control").collection(res.locals.output.type).insertOne({  //This looks like a noSQL injection point.
        name: res.locals.output.name,
        lastuse: nextday
        })
        if(useruse) {
            //Does nothing, just wanted to make the error shut up.
        }
    }
    else {
        if (dayjs().isBefore(userlastuse.lastuse)) {
            res.send("You have already proposed for today, please come back tomorrow!")
            return
        }
        else {
            let update = await client.db("control").collection(res.locals.output.type).updateOne(
                {name: res.locals.output.name},
                {$set: {lastuse: nextday}}
            )
            if(update) {
                //AH YES, UNUSED.
            }
        }
    }

    if(!req.body.fortune) {
        res.send("Please write the fortune you propose to add.")
        return
    }

    if(!isNaN(Number(req.body.fortune))) {
        res.send("This is just numbers, please don't try that.")
        return
    }

    let check = await client.db("general").collection("fortune").findOne({
        fortune: req.body.fortune
    })

    if(check) {
        res.send("Fortune already exist, thanks though.")
        return
    }
    else {
        let add = await client.db("general").collection("fortune").insertOne({
            fid: count+1,
            fortune: req.body.fortune,
            contributor: res.locals.output.name
        })
        if(add){
            count += 1
            updatecount()
            res.send("Thanks for proposing a new fortune!")
            return
        }
        else {
            res.send("Failed to add.")
            return
        }
    }
})

//Admin.
//Deletefortune, needs form "id" in the body.
app.delete("/deletefortune", verifyhash, admincheck, async(req, res) => {
    if(!req.body.id) {
        res.send("Input the ID.")
        return
    }
    if(isNaN(Number(req.body.id))) {
        res.send("ID should be in numbers.")
        return
    }
    id = Number(req.body.id)
    console.log(id)
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

    let result = await client.db("general").collection("fortune").findOne({
        fid: id
    })
    if(!result) {
        res.send("ID does not match any fortune")
        return
    }

    let delresult = await client.db("general").collection("fortune").deleteOne({
        fid: id
    })
    if(delresult) {
        let update = await client.db("general").collection("fortune").updateMany(
            {fid: {$gt: id}},
            {$inc: {fid: -1}} //This works right???
        )
        if(update) {
            console.log(update)
            count -= 1
            updatecount()
            res.send(delresult)
            console.log(delresult)
            return
        }
        else {
            res.send("Error: Something really bad happened.")
            return
        }
    }
    else {
        res.send("Delete failed.")
        return
    }
})

module.exports = {app}

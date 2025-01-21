async function adminhash(req, res, next) {
    if(!req.headers.authorization) {
        res.locals.success = false;
        res.locals.output + "Authorization token missing."
        return;
    }

    TokenArray =req.headers.authorization.split(" ");
    console.log(TokenArray)

    _id = new ObjectId(output.id)
    try {
        const output = jwt.verify(TokenArray[1], secret);
        res.locals.output = output
            //Due to same JWT implementation, this check is completely forgotten.
            let check = await client.db("general").collection("Admins").findOne({
                _id: _id
            })
            if(check) {
                res.locals.success = true
            }
            else {
                res.locals.success = false
                res.locals.output = "User is not an Admin Account."
            }
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

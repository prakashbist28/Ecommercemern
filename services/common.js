const passport = require('passport')

exports.isAuth = (req, res, done)=>{
    return passport.authenticate('jwt')
}

exports.sanitizeUser = (user)=>{
    return {id:user.id, role:user.role} //takes user and returns only id and role
}

exports.cookieExtractor = function(req) {
    var token = null;
    if (req && req.cookies) {
        token = req.cookies['jwt'];
    }
//token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2NDFjYzE3MTUzN2ExMjdmNzE1Y2I3YyIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzE1NTg4MTE5fQ.keDk0pNstjWnjYNyDLQIr-BJ6uhLvwS1ZB-2LhqO9YE"
    return token;
  };   
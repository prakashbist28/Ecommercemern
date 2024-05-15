const express = require("express");
const server = express();
const mongoose = require("mongoose");
const productRouter = require("./routes/Products");
const categoriesRouter = require("./routes/Categories");
const brandsRouter = require("./routes/Brands");
const usersRouter = require("./routes/Users");
const authRouter = require("./routes/Auth");
const cartRouter = require("./routes/Cart");
const ordersRouter = require("./routes/Order");
const cors = require("cors");
require('dotenv').config()

const session = require("express-session");
const passport = require("passport");
const { User } = require("./model/User");
const LocalStrategy = require("passport-local").Strategy;

const crypto = require("crypto");
const jwt = require('jsonwebtoken');
const { isAuth, sanitizeUser, cookieExtractor } = require("./services/common");

const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const cookieParser = require('cookie-parser')

const path = require('path');
const { Order } = require("./model/Order");


//webhhook
const endpointSecret = process.env.ENDPOINT_SECRET;

server.post('/webhook', express.raw({type: 'application/json'}), async(request, response) => {
  const sig = request.headers['stripe-signature'];

  let event; 

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object;

      const order = await Order.findById(paymentIntentSucceeded.metadata.orderId);
      order.paymentStatus = 'received';
      await order.save()
     
      // Then define and call a function to handle the event payment_intent.succeeded
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  response.send();
});



const opts = {};
opts.jwtFromRequest = cookieExtractor;
opts.secretOrKey = process.env.JWT_SECRET_KEY;

//JWT options
server.use(
  cors({
    exposedHeaders: ["X-Total-count"],
  })
);

//middlewares
server.use(express.static( path.resolve(__dirname,'build') ))
server.use(cookieParser())

server.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
  })
);

server.use(passport.authenticate("session"));

// server.use(express.raw({type: 'application/json'}))
server.use(express.json()); // to expect json type body from frontend , to parse req.body
server.use("/products", isAuth(), productRouter.router);
server.use("/categories",isAuth(), categoriesRouter.router);
server.use("/brands",isAuth(), brandsRouter.router);
server.use("/users",isAuth(), usersRouter.router);
server.use("/auth", authRouter.router);
server.use("/cart",isAuth(), cartRouter.router);
server.use("/orders",isAuth(), ordersRouter.router);
// this line we add to make react router work in case of other routes doesnt match
server.get('*', (req, res) => res.sendFile(path.resolve('build', 'index.html')));

//passport strategies
passport.use('local', new LocalStrategy({usernameField:'email'} ,async function (email, password, done) {
    try {
      const user = await User.findOne({ email: email }).exec();

      if (!user) {
        return done(null, false, { message: "invalid credentials" });
      }

      crypto.pbkdf2(
        password,
        user.salt,
        310000,
        32,
        "sha256",
        async function (err, hashedPassword) {
          if (!crypto.timingSafeEqual(user.password, hashedPassword)) {
            // TODO: We will make addresses independent of login
            return done(null, false, { message: "invalid credentials" });
          } else {
            const token = jwt.sign(sanitizeUser(user), process.env.JWT_SECRET_KEY)

            done(null, {id:user.id, role:user.role, token});
          }
        }
      );
      // TODO: this is just temporary, we will use strong password auth
    } catch (err) {
      done(err);
    }
  })
);

passport.use('jwt', new JwtStrategy(opts,async function (jwt_payload, done) {
  console.log({jwt_payload})
  
  try {
    const user = await User.findById(jwt_payload.id)

    if (user) {
      return done(null, sanitizeUser(user));
    } else {
      return done(null, false);
    }

  }catch(err){
    return done(err, false);
  } 
    
  })
);

passport.serializeUser(function (user, cb) {
  console.log("serialize", user);
  process.nextTick(function () {
    return cb(null, { id: user.id, role: user.role });
  });
});

passport.deserializeUser(function (user, cb) {
  console.log("deserialize", user);
  process.nextTick(function () {
    return cb(null, user);
  });
});

//payments
const stripe = require("stripe")(process.env.STRIPE_SERVER_KEY);

server.post("/create-payment-intent", async (req, res) => {
  const { totalAmount, orderId } = req.body;

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount*100,
    currency: "inr",
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
    metadata:{
      orderId
    }
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});





main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("database connected");
}

server.listen(process.env.PORT, () => {
  console.log("server started");
});

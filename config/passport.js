const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const randomBytes = require('crypto').randomBytes;
require('dotenv').config();

function generateRandomPassword(length) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?';
    const randomBytesBuffer = randomBytes(length);
    const password = Array.from(randomBytesBuffer)
        .map(byte => charset[byte % charset.length])
        .join('');
    return password;
}

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,        
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Use the first email from the profile.
      const email = profile.emails[0].value;
      // Look for an existing user with this email.
      let user = await User.findOne({ where: { email } });
      if (!user) {
        // Create a new user with the profile information.
        user = await User.create({
          name: profile.displayName,
          email,
          password: generateRandomPassword(12),
        });
      }
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
  
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;

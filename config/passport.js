const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const randomBytes = require("crypto").randomBytes;
require("dotenv").config();

function generateRandomPassword(length) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?";
  const randomBytesBuffer = randomBytes(length);
  const password = Array.from(randomBytesBuffer)
    .map((byte) => charset[byte % charset.length])
    .join("");
  return password;
}

function getDisplayName(profile) {
  // First try to use the display name from Google
  if (profile.displayName) {
    return profile.displayName;
  }

  // If no display name, try to use the email's local part
  if (profile.emails && profile.emails[0]) {
    const email = profile.emails[0].value;
    const localPart = email.split("@")[0];
    // Convert email format to a more readable name
    return localPart
      .replace(/[._-]/g, " ") // Replace dots, underscores, and hyphens with spaces
      .replace(/\b\w/g, (l) => l.toUpperCase()); // Capitalize first letter of each word
  }

  // If all else fails, return a generic name
  return "Google User";
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google Profile:", JSON.stringify(profile, null, 2));

        if (!profile.emails || !profile.emails[0]) {
          return done(new Error("No email found in Google profile"), null);
        }

        const email = profile.emails[0].value;
        const name = getDisplayName(profile);

        // Look for an existing user with this email
        let user = await User.findOne({ where: { email } });

        if (!user) {
          user = await User.create(
            {
              name,
              email,
              password: generateRandomPassword(12),
            },
            {
              fields: ["name", "email", "password"],
            }
          );
        }

        return done(null, user);
      } catch (error) {
        console.error("Google authentication error:", error);
        return done(error, null);
      }
    }
  )
);

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

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Hardcoded user for local version
// Email: "admin", Password: "1234"
const LOCAL_USER = {
  email: "admin",
  // Hashed "1234"
  passwordHash: "$2a$10$3sP6NqE7.l.l.l.l.l.l.e3sP6NqE7.l.l.l.l.l.l.e"
};

const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Local Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      //@ts-ignore error-bypass
      async authorize(credentials) {
        //@ts-ignore error-bypass
        const { email, password } = credentials;

        // Simple check
        if (email === "admin" && password === "1234") {
          return {
            id: "1",
            email: email,
            name: "Admin User"
          };
        }

        return null;
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/",
  },
  callbacks: {
    //@ts-ignore error-bypass
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
      }
      return session;
    },
    //@ts-ignore error-bypass
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
};

const handler = NextAuth(authOptions);

export const POST = handler;
export const GET = handler;

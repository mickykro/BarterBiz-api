import dotenv from "dotenv";

// Load environment variables from .env file if it exists
dotenv.config();

// Validate required environment variables
const required = ["DATABASE_URL", "JWT_SECRET"] as const;
const missing: string[] = [];

required.forEach((key) => {
  if (!process.env[key]) {
    missing.push(key);
  }
});

if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
  console.error("Please set these variables in your Railway project settings.");
  process.exit(1);
}

export const env = {
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  port: Number(process.env.PORT ?? 4000),
};

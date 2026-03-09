import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"] as const;

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env var ${key}`);
  }
});

export const env = {
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  port: Number(process.env.PORT ?? 8080),
};

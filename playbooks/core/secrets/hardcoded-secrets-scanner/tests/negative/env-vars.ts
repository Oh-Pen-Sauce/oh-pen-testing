// Fixture: uses process.env correctly. Scanner must NOT flag.

export const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION ?? "us-east-1",
};

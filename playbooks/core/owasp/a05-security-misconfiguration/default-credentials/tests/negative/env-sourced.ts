// Fixture: env-sourced credentials. Must NOT flag.
export const adminUser = {
  username: process.env.ADMIN_USER!,
  password: process.env.ADMIN_PASSWORD!,
};

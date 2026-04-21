// Fixture: uses AWS SDK's built-in credential provider. Must NOT flag.
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export async function whoami() {
  const sts = new STSClient({});
  const res = await sts.send(new GetCallerIdentityCommand({}));
  return res.Arn;
}

import { upload } from "scp-next";

await upload({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  privateKeyFile: process.env.SCP_NEXT_PRIVATE_KEY_FILE,
  localPath: "./dist",
  remotePath: "/var/www/example",
  recursive: true,
  overwrite: true,
  postUploadCommands: [
    "cd /var/www/example && npm install --omit=dev",
    "pm2 reload example"
  ]
});

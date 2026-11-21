
require('dotenv').config();

const { ImapFlow } = require('imapflow');

async function main() {
  const client = new ImapFlow({
    host: process.env.ZOHO_HOST,
    port: Number(process.env.ZOHO_PORT || 993),
    secure: true,
    auth: {
      user: process.env.ZOHO_USER,
      pass: process.env.ZOHO_PASSWORD,
    },
    logger: false,
  });

  try {
    await client.connect();

    console.log('Connected to Zoho IMAP successfully.');

    const folders = await client.list();

    console.log('\nAvailable folders:');

    for (const folder of folders) {
      console.log(`- ${folder.path}`);
    }

    const folderName = process.env.ZOHO_FOLDER;
    const folder = folders.find(
      (f) => f.path === folderName ||
        f.name === folderName
    );

    if (!folder) {
      console.log(
        `\nFolder "${folderName}" not found. Check its IMAP path above.`
      );
      return;
    }

    const lock = await client.getMailboxLock(folder.path, {
      readOnly: true,
    });

    try {
      console.log(`\nReading folder: ${folder.path}`);
      console.log(`Messages: ${client.mailbox.exists}`);

      const total = client.mailbox.exists;

      if (total > 0) {
        const start = Math.max(1, total - 4);

        for await (const message of client.fetch(
          `${start}:*`,
          {
            envelope: true,
            uid: true,
          }
        )) {
          console.log({
            uid: message.uid,
            subject: message.envelope?.subject,
            from: message.envelope?.from?.[0]?.address,
            date: message.envelope?.date,
          });
        }
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('IMAP error:', error.message);
  console.error('\nIMAP ERROR DETAILS');
  console.error('Message:', error.message);
  console.error('Code:', error.code);
  console.error('Response:', error.response);
  console.error('Response code:', error.responseCode);
  console.error('Command:', error.command);
    process.exitCode = 1;
  } finally {
    await client.logout().catch(() => {});
  }
}

main();

import { ImapFlow } from "imapflow";
import { createHash } from "node:crypto";
import { db } from "../lib/db";
import { importAlert } from "../lib/import-alert";

const maxBytes = 8 * 1024 * 1024;
const lookbackDays = 60;
let stage = "configuration";

async function collect() {
	const { ZOHO_HOST, ZOHO_PORT, ZOHO_USER, ZOHO_PASSWORD, ZOHO_FOLDER } = process.env;
	const port = Number(ZOHO_PORT || 993);
	if (!ZOHO_HOST || !ZOHO_USER || !ZOHO_PASSWORD || !Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error("Missing or invalid IMAP settings");
	}
	const mailboxName = ZOHO_FOLDER || "Job Alerts";
	const mailboxKey = createHash("sha256")
		.update(JSON.stringify([ZOHO_HOST.toLowerCase(), port, ZOHO_USER, mailboxName]))
		.digest("hex");
	const client = new ImapFlow({
		host: ZOHO_HOST,
		port,
		secure: true,
		auth: { user: ZOHO_USER, pass: ZOHO_PASSWORD },
		logger: false,
		disableAutoIdle: true,
	});
	client.on("error", () => client.close());
	try {
		stage = "IMAP connection";
		await client.connect();
		stage = "opening the mailbox";
		const lock = await client.getMailboxLock(mailboxName, { readOnly: true });
		try {
			const mailbox = client.mailbox;
			if (!mailbox) throw new Error("Mailbox unavailable");
			const uidValidity = mailbox.uidValidity;
			const upperUid = mailbox.uidNext - 1;
			const rescan = process.argv.includes("--rescan");
			stage = "reading the collection checkpoint";
			const checkpoint = rescan ? null : await db.importedMessage.findFirst({
				where: { mailbox: mailboxKey, uidValidity },
				orderBy: { uid: "desc" },
				select: { uid: true },
			});
			const lowerUid = checkpoint ? Number(checkpoint.uid) + 1 : 1;
			const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
			const totals = { processed: 0, added: 0, noVacancies: 0, oversized: 0, conflicts: 0 };
			if (lowerUid <= upperUid) {
				stage = "searching the mailbox";
				const range = { uid: `${lowerUid}:${upperUid}` };
				const criteria = checkpoint ? range : { ...range, since: new Date(cutoff - 24 * 60 * 60 * 1000) };
				const results = await client.search(criteria, { uid: true });
				if (!results) throw new Error("IMAP search failed");
				for (const uid of results.sort((first, second) => first - second)) {
					stage = "reading message metadata";
					const header = await client.fetchOne(uid, { internalDate: true, size: true, envelope: true }, { uid: true });
					if (!header) throw new Error("Message metadata unavailable");
					const receivedAt = header.internalDate ? new Date(header.internalDate) : null;
					if (!receivedAt || !Number.isFinite(receivedAt.valueOf())) throw new Error("Missing message date");
					if (!checkpoint && receivedAt.valueOf() < cutoff) continue;
					const identity = { mailbox: mailboxKey, uidValidity, uid: BigInt(uid) };
					if (header.size === undefined) throw new Error("Missing message size");
					if (header.size > maxBytes) {
						stage = "recording oversized message metadata";
						await db.importedMessage.upsert({
							where: { mailbox_uidValidity_uid: identity },
							update: {},
							create: { ...identity, receivedAt, subject: header.envelope?.subject, messageId: header.envelope?.messageId },
						});
						totals.oversized++;
						continue;
					}
					stage = "fetching message content";
					const message = await client.fetchOne(uid, { source: true }, { uid: true });
					if (!message) throw new Error("Message content unavailable");
					if (!message.source) throw new Error("Missing message content");
					stage = "extracting and saving vacancies";
					const result = await importAlert(identity, message.source, receivedAt);
					totals.processed++;
					totals.added += result.added;
					totals.conflicts += result.conflicted;
					if (!result.matched) totals.noVacancies++;
				}
			}
			console.log("Collection complete", totals);
		} finally {
			lock.release();
		}
		stage = "closing the mailbox";
		await client.logout();
	} finally {
		client.close();
	}
}

collect()
	.catch(() => {
		console.error(`Collection stopped during ${stage}. Check the database, mailbox settings and connectivity, then retry.`);
		process.exitCode = 1;
	})
	.finally(() => db.$disconnect());

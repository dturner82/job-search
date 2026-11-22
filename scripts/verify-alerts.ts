import assert from "node:assert/strict";
import { db } from "../lib/db";
import { importAlert } from "../lib/import-alert";
import { advertisedTravel, matchJob } from "../lib/matching";

function message(type: string, body: string) {
	return Buffer.from([
		"From: Alerts <alerts@example.com>",
		"To: Reader <reader@example.com>",
		"Subject: Synthetic job alert",
		"Message-ID: <fixture@example.com>",
		"MIME-Version: 1.0",
		`Content-Type: ${type}; charset=utf-8`,
		"Content-Transfer-Encoding: 8bit",
		"",
		body,
	].join("\r\n"));
}

async function verify() {
	const receivedAt = new Date("2026-11-20T12:00:00.000Z");
	const identity = { mailbox: "synthetic", uidValidity: BigInt(123), uid: BigInt(10) };
	const html = message("text/html", `
		<article>
			<a href="https://uk.indeed.com/rc/clk?jk=abcdef1234&amp;utm_source=email">Senior Next.js Developer</a>
			<p class="company">Example Software</p>
			<p class="location">Birmingham</p>
			<p class="salary">£25–35k per year</p>
			<p>Hands-on React and TypeScript. 2 days in office per month. Travel time: 90 minutes.</p>
		</article>
		<article>
			<a href="https://uk.indeed.com/viewjob?jk=1234abcdef">Graphic Designer</a>
			<p class="salary">£27,500 per year</p>
		</article>
	`);
	const plain = message("text/plain", [
		"Senior Next.js Developer",
		"https://uk.indeed.com/viewjob?jk=abcdef1234",
		"",
		"Web Designer",
		"Company: Example Studio",
		"Location: UK Remote",
		"https://example.com/jobs/web-designer?utm_source=email",
	].join("\r\n"));

	assert.deepEqual(await importAlert(identity, html, receivedAt), { added: 2, matched: 2, conflicted: 0 });
	assert.deepEqual(await importAlert(identity, html, receivedAt), { added: 0, matched: 2, conflicted: 0 });
	const newEpoch = { ...identity, uidValidity: BigInt(124) };
	assert.deepEqual(await importAlert(newEpoch, plain, receivedAt), { added: 1, matched: 2, conflicted: 0 });
	assert.equal(await db.importedMessage.count(), 2);
	assert.equal(await db.job.count(), 3);

	const roles = await db.job.findMany();
	const senior = roles.find((role) => role.title === "Senior Next.js Developer");
	const graphic = roles.find((role) => role.title === "Graphic Designer");
	const web = roles.find((role) => role.title === "Web Designer");
	assert(senior && graphic && web);
	assert.equal(senior.officeAttendance, "2 days in office per month");
	assert.equal(advertisedTravel(senior.alertExcerpt), "Travel time: 90 minutes");
	assert.equal(senior.company, "Example Software");
	assert.equal(senior.canonicalUrl, "https://uk.indeed.com/viewjob?jk=abcdef1234");
	assert.equal(web.canonicalUrl, "https://example.com/jobs/web-designer");
	assert.equal(matchJob(senior, 30_000).payLabel, "Pay to confirm");
	assert.equal(matchJob(graphic, 30_000).below, true);
	assert.equal(matchJob(web, 30_000).below, false);
	assert.equal(matchJob({ ...web, salary: "From £28k" }, 30_000).below, false);
	assert.equal(matchJob({ ...web, salary: "£2,500/mo" }, 30_000).payLabel, "Pay to confirm");
	assert(matchJob(senior, 30_000).score > matchJob(web, 30_000).score);
	console.log("Synthetic alert import, deduplication and matching passed.");
}

if (!process.env.DATABASE_URL?.startsWith("file:/tmp/job-search-verify-")) {
	throw new Error("Use an isolated test database as described in the README.");
}
verify().finally(() => db.$disconnect());

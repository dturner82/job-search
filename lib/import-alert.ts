import { simpleParser } from "mailparser";
import { db } from "./db";
import { extractVacancies } from "./alerts";

export async function importAlert(
	identity: { mailbox: string; uidValidity: bigint; uid: bigint },
	source: Buffer,
	receivedAt: Date,
) {
	const email = await simpleParser(source, {
		skipImageLinks: true,
		skipHtmlToText: true,
		skipTextToHtml: true,
	});
	const vacancies = extractVacancies(email.html ?? false, email.text ?? "");
	return db.$transaction(async (transaction) => {
		const existingMessage = await transaction.importedMessage.findUnique({
			where: { mailbox_uidValidity_uid: identity },
			select: { id: true },
		});
		const message = existingMessage ?? await transaction.importedMessage.create({
			data: { ...identity, receivedAt, messageId: email.messageId ?? null, subject: email.subject ?? null },
			select: { id: true },
		});
		let added = 0;
		let conflicted = 0;
		for (const vacancy of vacancies) {
			const byUrl = await transaction.job.findUnique({ where: { canonicalUrl: vacancy.canonicalUrl } });
			const bySource = vacancy.sourceVacancyId
				? await transaction.job.findUnique({
					where: { source_sourceVacancyId: { source: vacancy.source, sourceVacancyId: vacancy.sourceVacancyId } },
				})
				: null;
			if (byUrl && bySource && byUrl.id !== bySource.id) {
				conflicted++;
				continue;
			}
			const existing = byUrl ?? bySource;
			if (existing) {
				await transaction.job.update({
					where: { id: existing.id },
					data: {
						company: existing.company ?? vacancy.company,
						location: existing.location ?? vacancy.location,
						salary: existing.salary ?? vacancy.salary,
						alertExcerpt: existing.alertExcerpt ?? vacancy.alertExcerpt,
						officeAttendance: existing.officeAttendance ?? vacancy.officeAttendance,
						sourceVacancyId: existing.sourceVacancyId ?? (existing.source === vacancy.source ? vacancy.sourceVacancyId : null),
						canonicalUrl: existing.canonicalUrl ?? vacancy.canonicalUrl,
					},
				});
			} else {
				await transaction.job.create({
					data: { ...vacancy, firstMessageId: message.id, discoveredAt: receivedAt },
				});
				added++;
			}
		}
		return { added, matched: vacancies.length, conflicted };
	});
}

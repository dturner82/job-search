import { load } from "cheerio";
import { isTargetRole, officeAttendance } from "./matching";

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function vacancyLink(href: string, unwrap = true): { source: string; sourceVacancyId: string | null; canonicalUrl: string } | null {
	let url: URL;
	try {
		url = new URL(href.replace(/[).,;]+$/, ""));
	} catch {
		return null;
	}
	if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
	const host = url.hostname.toLowerCase();
	if (unwrap && /(^|\.)(?:indeed\.(?:com|co\.uk)|linkedin\.com)$/.test(host)) {
		for (const key of ["url", "redirect", "redirectUrl", "destination"]) {
			const target = url.searchParams.get(key);
			if (target) {
				const result = vacancyLink(target, false);
				if (result?.source === "Indeed" || result?.source === "LinkedIn") return result;
			}
		}
	}
	if (/(^|\.)indeed\.(?:com|co\.uk)$/.test(host)) {
		const id = url.searchParams.get("jk") ?? url.searchParams.get("vjk");
		if (!id || !/^[\da-z_-]{6,80}$/i.test(id)) return null;
		return { source: "Indeed", sourceVacancyId: id, canonicalUrl: `https://uk.indeed.com/viewjob?jk=${id}` };
	}
	const linkedInId = /(^|\.)linkedin\.com$/.test(host) && url.pathname.match(/^\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/)?.[1];
	if (linkedInId) {
		return { source: "LinkedIn", sourceVacancyId: linkedInId, canonicalUrl: `https://www.linkedin.com/jobs/view/${linkedInId}/` };
	}
	const path = url.pathname.replace(/\/$/, "");
	const vacancyPath = /\/(?:jobs?|vacanc(?:y|ies)|careers|positions|job-details)\/.+[^/]$/i.test(path);
	const vacancyId = url.searchParams.get("jobId") ?? url.searchParams.get("jobid")
		?? url.searchParams.get("vacancyId") ?? path.match(/\/(?:jobs?|vacanc(?:y|ies))\/(\d{4,})(?:\/|$)/i)?.[1] ?? null;
	if (!vacancyPath && !vacancyId) return null;
	if (/\/(?:search|results|alerts?|recommendations|unsubscribe|saved)(?:\/|$)/i.test(path)) return null;
	const source = host.replace(/^www\./, "");
	url.hash = "";
	for (const key of [...url.searchParams.keys()]) {
		if (/^(?:utm_.+|gclid|fbclid|trackingId|refId|trk|source|ref)$/i.test(key)) url.searchParams.delete(key);
	}
	url.searchParams.sort();
	url.pathname = path;
	return { source, sourceVacancyId: vacancyId || null, canonicalUrl: url.toString() };
}

export function extractVacancies(html: string | false, plainText: string) {
	const jobs = new Map<string, ReturnType<typeof makeJob>>();

	function makeJob(href: NonNullable<ReturnType<typeof vacancyLink>>, title: string, lines: string[], company?: string, location?: string, salary?: string) {
		const excerpt = clean(lines.join(" ")
			.replace(/https?:\/\/[^\s<>]+/gi, "")
			.replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "")).slice(0, 800);
		const labelled = (label: string) => lines.find((line) => line.toLowerCase().startsWith(label))?.slice(label.length).trim();
		return {
			...href,
			title,
			company: (company || labelled("company:") || labelled("employer:") || null),
			location: (location || labelled("location:") || lines.find((line) => line.length < 100 && /\b(?:remote|hybrid|onsite|on-site|wolverhampton|birmingham|west midlands|walsall|cannock)\b/i.test(line) && line !== title) || null),
			salary: (salary || labelled("salary:") || lines.find((line) => line.length < 120 && /(?:£|\bGBP\s*)\s*\d/i.test(line) && line !== title) || null),
			alertExcerpt: excerpt || null,
			officeAttendance: officeAttendance(excerpt),
		};
	}

	if (html) {
		const $ = load(html);
		$("a[href]").each((_, anchor) => {
			const link = vacancyLink($(anchor).attr("href") ?? "");
			const title = clean($(anchor).text());
			if (!link || title.length > 140 || !isTargetRole(title) || jobs.has(link.canonicalUrl)) return;
			const candidates = $(anchor).parents("article, li, tr, table, div");
			let card = $(anchor).parent();
			for (const parent of candidates.toArray()) {
				const candidate = $(parent);
				const otherVacancy = candidate.find("a[href]").toArray().some((a) => {
					const other = vacancyLink($(a).attr("href") ?? "");
					return other && other.canonicalUrl !== link.canonicalUrl;
				});
				if (otherVacancy || candidate.text().length > 1600) break;
				card = candidate;
			}
			const lines = card.find("p, td, li, div, span").toArray()
				.filter((element) => $(element).children("p, td, li, div, span").length === 0)
				.map((element) => clean($(element).text())).filter(Boolean);
			const field = (selector: string) => clean(card.find(selector).first().text()).slice(0, 160);
			jobs.set(link.canonicalUrl, makeJob(link, title, lines.length ? lines : [clean(card.text())],
				field('[data-testid*="company"], [class*="company"], [itemprop="hiringOrganization"]'),
				field('[data-testid*="location"], [class*="location"], [itemprop="jobLocation"]'),
				field('[data-testid*="salary"], [class*="salary"], [itemprop="baseSalary"]')));
		});
	}

	const lines = plainText.split(/\r?\n/).map(clean).filter(Boolean);
	let start = 0;
	for (const [index, line] of lines.entries()) {
		const urls = line.match(/https?:\/\/[^\s<>"]+/gi) ?? [];
		for (const url of urls) {
			const link = vacancyLink(url);
			if (!link) continue;
			const context = lines.slice(Math.max(start, index - 7), index + 1);
			const title = [...context].reverse()
				.map((value) => clean(value.replace(/\s*<?https?:\/\/.*$/i, "")))
				.find((value) => value.length <= 140 && isTargetRole(value));
			if (title && !jobs.has(link.canonicalUrl)) jobs.set(link.canonicalUrl, makeJob(link, title, context));
			start = index + 1;
		}
	}
	return [...jobs.values()];
}

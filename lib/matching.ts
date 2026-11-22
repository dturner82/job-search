const preferredRole = /\b(?:full[ -]?stack|front[ -]?end|software engineer|php|laravel|next[. ]?js|web developer)\b/i;
const otherRole = /\b(?:website manager|web designer|graphic designer)\b/i;
const skills = ["PHP", "Laravel", "Vue", "React", "Next.js", "JavaScript", "TypeScript", "Node.js", "WordPress", "REST APIs"];

export function isTargetRole(title: string) {
	return preferredRole.test(title) || otherRole.test(title);
}

export function annualPay(salary: string | null) {
	if (!salary || /\b(?:hour(?:ly)?|day|daily|week(?:ly)?|month(?:ly)?|pro[ -]rata|OTE)\b|\/\s*(?:h|hr|d|wk|mo)\b/i.test(salary)) return [];
	const match = salary.match(/(?:£|\bGBP\s*)\s*(\d[\d,]*(?:\.\d+)?)\s*(k\b)?(?:\s*(?:[-–—]|\bto\b)\s*(?:£|GBP\s*)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k\b)?)?/i);
	if (!match) return [];
	const [, first, firstUnit, last, lastUnit] = match;
	const number = (value: string) => Number(value.replaceAll(",", ""));
	const firstPay = number(first) * (firstUnit || (lastUnit && number(first) < 1000) ? 1000 : 1);
	const lastPay = last ? number(last) * (lastUnit || (firstUnit && number(last) < 1000) ? 1000 : 1) : firstPay;
	return [firstPay, lastPay].every((pay) => Number.isFinite(pay) && pay >= 1000) ? [firstPay, lastPay] : [];
}

export function matchJob(job: {
	title: string;
	salary: string | null;
	location: string | null;
	alertExcerpt: string | null;
}, minimum: number) {
	const pay = annualPay(job.salary);
	const upper = pay.length ? Math.max(...pay) : undefined;
	const lower = pay.length ? Math.min(...pay) : undefined;
	const openEnded = /\b(?:from|starting at)\b|(?:\d|k)\+(?!\S)/i.test(job.salary ?? "");
	const below = upper !== undefined && upper < minimum && !openEnded;
	const confirmedPay = lower !== undefined && lower >= minimum && !/\b(?:up to|circa|approx(?:imately)?|estimated)\b/i.test(job.salary ?? "");
	const reasons: string[] = [];
	let score = 0;

	if (preferredRole.test(job.title)) {
		score += 30;
		reasons.push("Development role");
	} else if (otherRole.test(job.title)) {
		score += 24;
		reasons.push("Design or website role");
	}
	if (/\b(?:senior|lead)\b/i.test(job.title) && preferredRole.test(job.title)) {
		score += 8;
		reasons.push("Senior or lead");
	}
	const text = [job.title, job.alertExcerpt].filter(Boolean).join(" ");
	const matchingSkills = skills.filter((skill) => {
		const pattern = skill.replaceAll(".", "[. ]?").replace(/s$/, "s?");
		return new RegExp(`\\b${pattern}\\b`, "i").test(text);
	});
	score += Math.min(matchingSkills.length * 3, 18);
	if (matchingSkills.length) reasons.push(matchingSkills.join(", "));
	if (/\b(?:hands[ -]on|writing code|build(?:ing)? (?:web|software|applications))\b/i.test(text)) {
		score += 6;
		reasons.push("Hands-on work mentioned");
	}
	const location = job.location ?? "";
	if (/\b(?:UK remote|remote[ ,(-]*(?:UK|United Kingdom))\b/i.test(location)) {
		score += 8;
		reasons.push("UK remote");
	} else if (/\b(?:Wolverhampton|Essington|Walsall|Cannock|Dudley|Birmingham|West Midlands)\b/i.test(location)) {
		score += 6;
		reasons.push("West Midlands location");
	}
	if (confirmedPay) score += 5;
	return { score, below, payLabel: below ? "Below salary filter" : confirmedPay ? "Meets salary filter" : "Pay to confirm", reasons };
}

export function officeAttendance(text: string) {
	const match = text.match(/\b(?:\d+(?:(?:\s*[-–]\s*|\s+to\s+)\d+)?|one|two|three|four|five)\s+days?\s*(?:(?:per\s+|a\s+|\/\s*)(?:week|month)\s*)?(?:on[ -]?site|in (?:the )?office)(?:\s*(?:per\s+|a\s+|\/\s*)(?:week|month))?/i);
	return match?.[0]?.trim() ?? null;
}

export function advertisedTravel(text: string | null) {
	if (!text) return null;
	return text.match(/\b(?:commute|travel time|door[ -]to[ -]door)\s*(?:of|[:–-])?\s*(?:about\s+|~\s*)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|miles|km)\b(?:\s*(?:\/|\+|and)\s*(?:~\s*)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|miles|km)\b)?/i)?.[0] ?? null;
}

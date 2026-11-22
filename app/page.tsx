import { db } from "../lib/db";
import { advertisedTravel, matchJob } from "../lib/matching";
import { isApplicationStatus, statuses } from "./job-status";
import { updateJobStatus } from "./update-job-status";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
	dateStyle: "medium",
	timeZone: "Europe/London",
});

const feedbackMessages = {
	saved: "Status saved.",
	invalid: "Choose a valid vacancy and status.",
	missing: "This vacancy is no longer available.",
	error: "The status could not be saved. Try again.",
};

type Query = Record<string, string | string[] | undefined>;

export default async function Dashboard({ searchParams }: { searchParams: Promise<Query> }) {
	const query = await searchParams;
	const requestedMinimum = typeof query.salary === "string" && /^\d{1,7}$/.test(query.salary) ? Number(query.salary) : 30_000;
	const minimum = Math.min(requestedMinimum, 1_000_000);
	const showBelow = query.below === "yes";
	const newest = query.sort === "newest";
	const selectedStatus = query.status === "all" || isApplicationStatus(query.status) ? query.status : "NEW";
	const statusOptions = Object.entries(statuses);
	const view = new URLSearchParams({
		status: selectedStatus,
		sort: newest ? "newest" : "match",
		salary: String(minimum),
	});
	if (showBelow) view.set("below", "yes");
	const feedback = Object.entries(feedbackMessages).find(([code]) => query.feedback === code)?.[1];
	const jobs = await db.job.findMany({
		where: selectedStatus === "all" ? undefined : { status: selectedStatus },
		orderBy: [{ discoveredAt: "desc" }, { id: "desc" }],
		select: {
			id: true,
			title: true,
			company: true,
			location: true,
			salary: true,
			alertExcerpt: true,
			officeAttendance: true,
			source: true,
			discoveredAt: true,
			status: true,
			canonicalUrl: true,
		},
	});
	const ranked = jobs.map((job) => ({ ...job, match: matchJob(job, minimum) }));
	const visible = ranked.filter((job) => showBelow || !job.match.below);
	if (!newest) visible.sort((first, second) => second.match.score - first.match.score);
	const hasVacancies = jobs.length > 0 || Boolean(await db.job.findFirst({ select: { id: true } }));

	return (
		<main className="dashboard">
			<header className="dashboard-header">
				<h1>Job Search</h1>
				<p>{visible.length} of {jobs.length} {jobs.length === 1 ? "vacancy" : "vacancies"}</p>
			</header>
			<form className="filters" action="/">
				<label>
					Status
					<select name="status" defaultValue={selectedStatus}>
						{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
						<option value="all">All statuses</option>
					</select>
				</label>
				<label>
					Sort by
					<select name="sort" defaultValue={newest ? "newest" : "match"}>
						<option value="match">Best match</option>
						<option value="newest">Newest first</option>
					</select>
				</label>
				<label>
					Minimum annual pay (£)
					<input name="salary" type="number" min="0" max="1000000" step="1" defaultValue={minimum} required />
				</label>
				<label className="checkbox">
					<input type="checkbox" name="below" value="yes" defaultChecked={showBelow} />
					Show jobs below minimum
				</label>
				<button type="submit">Apply filters</button>
			</form>
			{feedback && <p className="status-feedback" role="status">{feedback}</p>}
			{visible.length === 0 ? (
				<section className="empty-state" aria-labelledby="empty-title">
					<h2 id="empty-title">{hasVacancies ? "No vacancies match these filters" : "No vacancies yet"}</h2>
					<p>{hasVacancies ? "Choose a different status or change the salary filter to see more vacancies." : "Vacancies will appear here after job alerts are collected."}</p>
				</section>
			) : (
				<ul className="vacancies" aria-label="Vacancies">
					{visible.map((job) => (
						<li key={job.id} className="vacancy">
							<div className="vacancy-heading">
								<div>
									<h2>{job.canonicalUrl && /^https?:\/\//i.test(job.canonicalUrl) ? <a href={job.canonicalUrl} rel="noreferrer">{job.title}</a> : job.title}</h2>
									{job.company && <p>{job.company}</p>}
								</div>
								<span className="status">{statuses[job.status]}</span>
							</div>
							<dl>
								<div><dt>Salary</dt><dd>{job.salary ?? "Unspecified"}<small>{job.match.payLabel}</small></dd></div>
								<div><dt>Location</dt><dd>{job.location ?? "Unspecified"}</dd></div>
								<div><dt>Office attendance</dt><dd>{job.officeAttendance ?? "Unspecified"}</dd></div>
								<div><dt>Advertised travel</dt><dd>{advertisedTravel(job.alertExcerpt) ?? "Unspecified"}</dd></div>
								<div><dt>Source</dt><dd>{job.source}</dd></div>
								<div>
									<dt>Discovered</dt>
									<dd><time dateTime={job.discoveredAt.toISOString()}>{dateFormat.format(job.discoveredAt)}</time></dd>
								</div>
							</dl>
							{job.match.reasons.length > 0 && <p className="match-reasons">{job.match.reasons.join(" · ")}</p>}
							<form className="status-form" action={updateJobStatus}>
								<input type="hidden" name="jobId" value={job.id} />
								<input type="hidden" name="view" value={view.toString()} />
								<select name="jobStatus" aria-label={`Application status for ${job.title}`} defaultValue={job.status}>
									{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
								</select>
								<button type="submit">Save status</button>
							</form>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}

import { db } from "../lib/db";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
	dateStyle: "medium",
	timeZone: "Europe/London",
});

const statuses = {
	NEW: "New",
	SHORTLISTED: "Shortlisted",
	APPLIED: "Applied",
	IGNORED: "Ignored",
};

export default async function Dashboard() {
	const jobs = await db.job.findMany({
		orderBy: [{ discoveredAt: "desc" }, { id: "desc" }],
		select: {
			id: true,
			title: true,
			company: true,
			location: true,
			salary: true,
			source: true,
			discoveredAt: true,
			status: true,
		},
	});

	return (
		<main className="dashboard">
			<header className="dashboard-header">
				<h1>Job Search</h1>
				<p>{jobs.length} {jobs.length === 1 ? "vacancy" : "vacancies"}</p>
			</header>
			{jobs.length === 0 ? (
				<section className="empty-state" aria-labelledby="empty-title">
					<h2 id="empty-title">No vacancies yet</h2>
					<p>Vacancies will appear here after they are added to your database.</p>
				</section>
			) : (
				<ul className="vacancies" aria-label="Vacancies">
					{jobs.map((job) => (
						<li key={job.id} className="vacancy">
							<div className="vacancy-heading">
								<div>
									<h2>{job.title}</h2>
									{job.company && <p>{job.company}</p>}
								</div>
								<span className="status">{statuses[job.status]}</span>
							</div>
							<dl>
								<div><dt>Salary</dt><dd>{job.salary ?? "Unspecified"}</dd></div>
								<div><dt>Location</dt><dd>{job.location ?? "Unspecified"}</dd></div>
								<div><dt>Source</dt><dd>{job.source}</dd></div>
								<div>
									<dt>Discovered</dt>
									<dd><time dateTime={job.discoveredAt.toISOString()}>{dateFormat.format(job.discoveredAt)}</time></dd>
								</div>
							</dl>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}

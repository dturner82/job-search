import type { ApplicationStatus } from "@prisma/client";

export const statuses = {
	NEW: "New",
	SHORTLISTED: "Shortlisted",
	APPLIED: "Applied",
	EXPIRED: "Expired",
	UNSUITABLE: "Unsuitable",
	REJECTED: "Rejected",
	IGNORED: "Ignored",
} satisfies Record<ApplicationStatus, string>;

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
	return typeof value === "string" && Object.hasOwn(statuses, value);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../lib/db";
import { isApplicationStatus } from "./job-status";

export async function updateJobStatus(formData: FormData) {
	const idValue = formData.get("jobId");
	const id = typeof idValue === "string" && /^\d{1,10}$/.test(idValue) ? Number(idValue) : 0;
	const status = formData.get("jobStatus");
	const currentView = formData.get("view");
	const supplied = new URLSearchParams(typeof currentView === "string" && currentView.length <= 180 ? currentView : "");
	const nextView = new URLSearchParams();
	for (const key of ["status", "sort", "salary", "below"]) {
		const value = supplied.get(key);
		if (value !== null) nextView.set(key, value);
	}

	let feedback = "invalid";
	if (id > 0 && id <= 2_147_483_647 && isApplicationStatus(status)) {
		try {
			const result = await db.job.updateMany({ where: { id }, data: { status } });
			feedback = result.count === 1 ? "saved" : "missing";
		} catch {
			feedback = "error";
		}
	}
	if (feedback === "saved") revalidatePath("/");
	nextView.set("feedback", feedback);
	redirect(`/?${nextView}`);
}

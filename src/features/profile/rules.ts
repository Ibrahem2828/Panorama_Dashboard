export const FULL_NAME_MAX = 150;
export const JOB_TITLE_MAX = 120;

export interface ProfileForm { full_name: string; job_title: string }
export interface ProfileErrors { full_name?: "required" | "tooLong"; job_title?: "tooLong" }

export function validateProfile(form: ProfileForm): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = form.full_name.trim();
  if (!name) errors.full_name = "required";
  else if (name.length > FULL_NAME_MAX) errors.full_name = "tooLong";
  if (form.job_title.trim().length > JOB_TITLE_MAX) errors.job_title = "tooLong";
  return errors;
}

/** Only what actually changed is sent (a PATCH), trimmed; an empty object means nothing to save. */
export function profileChanges(saved: ProfileForm, form: ProfileForm): Partial<ProfileForm> {
  const changes: Partial<ProfileForm> = {};
  if (form.full_name.trim() !== saved.full_name.trim()) changes.full_name = form.full_name.trim();
  if (form.job_title.trim() !== saved.job_title.trim()) changes.job_title = form.job_title.trim();
  return changes;
}

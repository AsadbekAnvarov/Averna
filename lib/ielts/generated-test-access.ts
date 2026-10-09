/** Admins oversee the library; teachers manage only their own single-test drafts. */
export function generatedTestOwnerFilter(user: { id: string; role?: string }) {
  if (user.role === "ADMIN") return {};
  if (user.role === "TEACHER" && user.id) return { createdById: user.id };
  throw new Error("Teacher or admin access required");
}

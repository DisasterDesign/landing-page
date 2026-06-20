import { redirect } from "next/navigation";

// "הודעות" was merged into "לידים ופניות" — both screens operated over the
// same ContactSubmission table, which caused conflicting status/state. The
// leads screen is now the single canonical view.
export default function ContactsPage() {
  redirect("/admin/leads");
}

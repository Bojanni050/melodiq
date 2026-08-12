import { redirect } from "next/navigation";

// Style is merged into the Melody page (Music Builder). Kept as a redirect
// so existing links/bookmarks to /style don't 404.
export default function StyleRedirectPage() {
  redirect("/melody");
}

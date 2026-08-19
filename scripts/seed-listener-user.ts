import { ensureListenerUser, LISTENER_EMAIL } from "../src/lib/listener-user";

async function main() {
  console.log(`Ensuring listener user (${LISTENER_EMAIL})...`);
  const user = await ensureListenerUser();
  console.log(`Listener user ready: ID=${user.id}, Email=${user.email}, Role=${user.role}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error ensuring listener user:", err);
  process.exit(1);
});

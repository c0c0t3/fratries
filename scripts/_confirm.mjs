import readline from "node:readline/promises";

export async function confirmer(message, motAttendu) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const reponse = await rl.question(`${message}\nTape "${motAttendu}" pour confirmer : `);
  rl.close();
  return reponse.trim() === motAttendu;
}

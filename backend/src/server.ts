import "dotenv/config";
import { createApp } from "./app";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`Fikat Proforma API listening on http://localhost:${port}`);
});

import { runDeepResearch } from "./index.ts";

const parseArgs = (argv: string[]) => {
  const args = argv.slice(2);
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current.startsWith("--")) {
      continue;
    }
    const key = current.slice(2);
    const next = args[index + 1];
    options[key] = next && !next.startsWith("--") ? next : true;
  }
  return options;
};

const main = async () => {
  const options = parseArgs(process.argv);
  const topic = String(options.topic || options.t || "");
  if (!topic) {
    throw new Error("请使用 --topic 提供研究主题");
  }

  const result = await runDeepResearch({
    topic,
    outputDir: typeof options.output === "string" ? options.output : undefined,
    language: typeof options.language === "string" ? options.language : undefined,
    dryRun: Boolean(options["dry-run"] || options.dryRun)
  });

  process.stdout.write(
    JSON.stringify(
      {
        title: result.title,
        reportPath: result.reportPath,
        sources: result.stats.sources,
        iterations: result.stats.iterations
      },
      null,
      2
    )
  );
  process.stdout.write("\n");
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

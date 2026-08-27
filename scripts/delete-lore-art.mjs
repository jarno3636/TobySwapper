import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = "tobyswap-lore-art";
const FOLDER = "canonical";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

async function listAllFiles() {
  const files = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(FOLDER, {
        limit,
        offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    for (const file of data) {
      /*
       * Skip folder placeholders if any exist.
       */
      if (file.id) {
        files.push(`${FOLDER}/${file.name}`);
      }
    }

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  return files;
}

async function deleteInBatches(paths) {
  const batchSize = 500;

  for (
    let i = 0;
    i < paths.length;
    i += batchSize
  ) {
    const batch = paths.slice(
      i,
      i + batchSize,
    );

    const { data, error } =
      await supabase.storage
        .from(BUCKET)
        .remove(batch);

    if (error) {
      throw error;
    }

    console.log(
      `Deleted ${Math.min(
        i + batch.length,
        paths.length,
      )} / ${paths.length}`,
    );
  }
}

async function main() {
  console.log(
    `Scanning ${BUCKET}/${FOLDER}...`,
  );

  const paths =
    await listAllFiles();

  console.log(
    `Found ${paths.length} files.`,
  );

  if (!paths.length) {
    console.log(
      "Nothing to delete.",
    );
    return;
  }

  console.log(
    "Deleting canonical Lore artwork...",
  );

  await deleteInBatches(paths);

  const remaining =
    await listAllFiles();

  console.log(
    `Finished. Remaining files: ${remaining.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

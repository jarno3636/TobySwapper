import PublicPouchPage from "@/components/pouch/PublicPouchPage";

export const dynamic = "force-static";
export const revalidate = 86400;

export default function Page({ params }: { params: { slug: string } }) {
  return <PublicPouchPage slug={params.slug} />;
}

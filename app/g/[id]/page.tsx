import GroupExperience from "../../GroupExperience";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupExperience id={id} />;
}

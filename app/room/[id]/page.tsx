import Whiteboard from "@/components/Whiteboard";

interface RoomPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;

  return <Whiteboard roomId={id} />;
}